/**
 * POC — Google Routes API × classificador de bilhetes (VT, 02/11/2026).
 *
 * Roteiriza os trajetos de amostra pela Routes API (modo TRANSIT), converte as
 * pernas para o formato neutro e classifica o bilhete com o motor de regras
 * (src/lib/vt/classificarRota.ts), comparando com o bilhete cadastrado.
 * NÃO grava nada — gera relatório para conferência da gestora.
 *
 * Pré-requisitos:
 *   - Chave do Google Cloud com "Routes API" ativada (docs/VT_GOOGLE_API_KEY.md)
 *   - GOOGLE_MAPS_API_KEY no .env (NUNCA commitar; a chave de produção fica em
 *     secret do Supabase — aqui é só a POC local)
 *
 * Uso:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/vt/poc-rotas-api.ts [--n=10] [--ids=<uuid,uuid,...>]
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { textoDestinoPosto, textoOrigemCasa } from '../../src/lib/vt/enderecos'
import { classificarRota, type ModalRota, type PernaRota } from '../../src/lib/vt/classificarRota'

function carregarEnv(caminho: string) {
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  // O .env local usa SUPABASE_SERVICE_KEY; aceita também o nome do AGENTS.md.
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!
)
const API_KEY = process.env.GOOGLE_MAPS_API_KEY
if (!API_KEY) {
  console.error('Falta GOOGLE_MAPS_API_KEY no .env — veja docs/VT_GOOGLE_API_KEY.md')
  process.exit(1)
}

const args = process.argv.slice(2)
const argN = args.find((a) => a.startsWith('--n='))
const argIds = args.find((a) => a.startsWith('--ids='))
const N = argN ? Number(argN.slice(4)) : 10
const IDS = argIds ? argIds.slice(6).split(',') : null

/** Google TransitVehicleType → nosso modal. BRT vem como BUS (sem distinção). */
function modalDoVeiculo(tipo: string | undefined): ModalRota {
  switch (tipo) {
    case 'SUBWAY':
      return 'metro'
    case 'TRAIN':
    case 'HEAVY_RAIL':
    case 'COMMUTER_TRAIN':
      return 'trem'
    case 'TRAM':
    case 'LIGHT_RAIL':
      return 'vlt'
    case 'FERRY':
      return 'barca'
    default:
      return 'onibus'
  }
}

interface TransitStepGoogle {
  travelMode?: string
  transitDetails?: {
    transitLine?: {
      name?: string
      nameShort?: string
      vehicle?: { type?: string }
      agencies?: { name?: string }[]
    }
  }
}

/**
 * Empresa operadora da linha → escopo da perna (POC 02/11/2026 — caso 516M:
 * o Google sugere linha intermunicipal no meio de trajeto "municipal" e a
 * perna cobra tarifa intermunicipal; classificar pela cidade da casa errou).
 * Empresas intermunicipais conhecidas da região (Rio Ita, Auto Litoral,
 * Nossa Senhora da Penha etc. operam SG/Maricá/Itaboraí ↔ Niterói/RJ).
 * Desconhecida: null — a perna vai como está e o relatório marca "revisar".
 */
// Semove = a federação das empresas de ônibus do estado (não é operadora):
// no Google ela publica os feeds como "Semove - Intermunicipal" (linhas
// intermunicipais) e "Semove - São Gonçalo" (municipais de SG). "Semove" sozinho
// é ambíguo — fica desconhecida. (Gestora, 02/11/2026.)
const EMPRESAS_INTERMUNICIPAIS = /semove - intermunicipal|rio ita|auto litoral|litoral rio|1001|nossa senhora|santo antonio|inbornsa|esperan[cç]a|intermunicipal/i
const EMPRESAS_MUNICIPAIS_NITEROI = /prefeitura de niter/i
const EMPRESAS_MUNICIPAIS_RIO = /prefeitura (do|de) rio|riocard|ja[eé]/i
const EMPRESAS_MUNICIPAIS_SG = /semove - s[aã]o gon/i

function escopoDaPerna(agencia: string | undefined): { intermunicipal: boolean | null; municipio: string } {
  if (!agencia) return { intermunicipal: null, municipio: '' }
  if (EMPRESAS_MUNICIPAIS_SG.test(agencia)) return { intermunicipal: false, municipio: 'São Gonçalo' }
  if (EMPRESAS_INTERMUNICIPAIS.test(agencia)) return { intermunicipal: true, municipio: '' }
  if (EMPRESAS_MUNICIPAIS_NITEROI.test(agencia)) return { intermunicipal: false, municipio: 'Niterói' }
  if (EMPRESAS_MUNICIPAIS_RIO.test(agencia)) return { intermunicipal: false, municipio: 'Rio de Janeiro' }
  return { intermunicipal: null, municipio: '' }
}

async function rotear(origem: string, destino: string) {
  // Horário fixo (segunda 06:00 de Brasília): a malha de transporte muda com
  // o horário — sem isso, cada rodada da POC traz alternativas diferentes.
  const agora = new Date()
  const diasAteSegunda = (8 - agora.getDay()) % 7 || 7
  const segunda = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + diasAteSegunda, 6, 0, 0)
  const partida = new Date(segunda.getTime() - 3 * 60 * 60 * 1000) // 06:00 BRT = 09:00 UTC
  const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY!,
      'X-Goog-FieldMask':
        'routes.legs.steps.travelMode,routes.legs.steps.transitDetails,routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: { address: origem },
      destination: { address: destino },
      travelMode: 'TRANSIT',
      departureTime: partida.toISOString(),
      computeAlternativeRoutes: true,
    }),
  })
  if (!resp.ok) {
    const corpo = await resp.text()
    throw new Error(`Routes API HTTP ${resp.status}: ${resp.statusText} — ${resp.status === 403 ? 'chave sem Routes API ativada?' : ''} ${corpo.slice(0, 200)}`)
  }
  return resp.json()
}

interface LinhaPoc {
  id: string
  colaboradores: {
    nome_completo: string
    cidade: string | null
    endereco: string | null
    cep: string | null
    vt_bu_ativado: boolean | null
    vt_bu_situacao: string | null
  } | null
  departamentos: {
    nome_curto: string | null
    nome: string
    cidade: string | null
    endereco: string | null
    cep: string | null
  } | null
  vt_bilhetes: { nome: string } | null
}

async function main() {
  // Amostra: ids explícitos ou os N primeiros trajetos confirmados.
  let query = supabase
    .from('vt_trajetos')
    .select('id, status, escopo, bilhete_id, colaborador_id, departamento_id, colaboradores(nome_completo, cidade, endereco, cep, vt_bu_ativado, vt_bu_situacao), departamentos(nome_curto, nome, cidade, endereco, cep), vt_bilhetes!vt_trajetos_bilhete_id_fkey(nome)')
    .eq('status', 'confirmado')
  if (IDS) query = query.in('id', IDS)
  else query = query.limit(N)
  const { data: trajetos, error } = await query
  if (error) throw error

  console.log(`\nPOC Routes API — ${trajetos?.length ?? 0} trajetos\n`)
  const linhas: string[] = []
  for (const t of (trajetos ?? []) as unknown as LinhaPoc[]) {
    const c = t.colaboradores
    const d = t.departamentos
    const bilheteAtual = t.vt_bilhetes?.nome ?? '—'
    const origem = textoOrigemCasa(c?.endereco, c?.cidade, c?.cep)
    const destino = textoDestinoPosto(d)
    try {
      const rota = await rotear(origem, destino)
      const rotas: { legs?: { steps?: TransitStepGoogle[] }[] }[] = rota?.routes ?? []
      const cidadesDiferentes = norm(c?.cidade) !== norm(d?.cidade)
      // Classifica POR ROTA: a sugestão vale pela melhor rota (routes[0]); a
      // alternativa com linha intermunicipal vira aviso (as linhas da Semove
      // cortam Niterói e aparecem como alternativa em trajetos municipais —
      // a união cega marcava BUI em 107 trajetos, falso positivo em massa).
      let agenciasDesconhecidas = 0
      const pernasPorRota: PernaRota[][] = rotas.map((r) => {
        const pernas: PernaRota[] = []
        for (const s of r.legs?.[0]?.steps ?? []) {
          if (s.travelMode !== 'TRANSIT' || !s.transitDetails) continue
          const agencia = s.transitDetails.transitLine?.agencies?.[0]?.name
          const escopo = escopoDaPerna(agencia)
          if (escopo.intermunicipal === null) agenciasDesconhecidas++
          pernas.push({
            modal: modalDoVeiculo(s.transitDetails.transitLine?.vehicle?.type),
            municipio: escopo.municipio || c?.cidade || '',
            intermunicipal: escopo.intermunicipal ?? cidadesDiferentes,
          })
        }
        return pernas
      })
      const cls = classificarRota(pernasPorRota[0] ?? [], { buAtivado: c?.vt_bu_ativado ?? null, buSituacao: c?.vt_bu_situacao })
      const melhorSemInter = !(pernasPorRota[0] ?? []).some((p) => p.intermunicipal)
      const alternativaInter = pernasPorRota.slice(1).some((pernas) => pernas.some((p) => p.intermunicipal))
      if (melhorSemInter && alternativaInter && cls.bilhetes.length > 0) {
        cls.avisos.push('Há alternativa de rota por linha INTERMUNICIPAL (Semove/Rio Ita) — se a pessoa pega essa linha, o bilhete é o BUI. Confirme.')
        cls.confianca = 'media'
      }
      const vistosTexto = new Set<string>()
      const linhasTexto = rotas
        .flatMap((r) => r.legs?.[0]?.steps ?? [])
        .filter((s) => s.travelMode === 'TRANSIT')
        .map((s) => {
          const l = s.transitDetails?.transitLine
          const nome = l?.nameShort ?? l?.name ?? '?'
          const agencia = l?.agencies?.[0]?.name
          return agencia ? `${nome} [${agencia}]` : nome
        })
        .filter((texto) => (vistosTexto.has(texto) ? false : (vistosTexto.add(texto), true)))
      const bate = classificacaoBate(bilheteAtual, cls.bilhetes) ? 'OK' : 'DIVERGE'
      console.log(`${bate} | ${c?.nome_completo} | atual: ${bilheteAtual} | sugerido: ${cls.bilhetes.join(' + ') || '—'} (${cls.confianca})`)
      console.log(`      pernas: ${linhasTexto.join(' → ') || 'sem transporte público'}`)
      if (agenciasDesconhecidas > 0) console.log(`      atenção: ${agenciasDesconhecidas} perna(s) com empresa fora da tabela — escopo inferido por casa×posto`)
      for (const a of cls.avisos) console.log(`      aviso: ${a}`)
      linhas.push(
        [bate, c?.nome_completo, origem, destino, bilheteAtual, cls.bilhetes.join(' + '), cls.confianca, linhasTexto.join(' → '), cls.avisos.join(' | ')].join(';')
      )
    } catch (e) {
      console.log(`ERRO | ${c?.nome_completo} | ${(e as Error).message}`)
      linhas.push(['ERRO', c?.nome_completo, origem, destino, bilheteAtual, '', '', '', (e as Error).message].join(';'))
    }
  }
  const out = `dados-locais/poc_rotas_api_${new Date().toISOString().slice(0, 10)}.csv`
  fs.writeFileSync(out, 'resultado;colaborador;origem;destino;bilhete_atual;sugerido;confianca;pernas;avisos\n' + linhas.join('\n'))
  console.log(`\nRelatório: ${out}`)
}

function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
}

function classificacaoBate(atual: string, sugeridos: string[]): boolean {
  if (sugeridos.length === 0) return false
  return sugeridos.some((s) => norm(s) === norm(atual))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
