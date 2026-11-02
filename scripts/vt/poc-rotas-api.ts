/**
 * POC — Google Routes API × classificador de bilhetes (VT, 28/10/2026).
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

async function rotear(origem: string, destino: string) {
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
      computeAlternativeRoutes: false,
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
    .select('id, status, escopo, bilhete_id, colaborador_id, departamento_id, colaboradores(nome_completo, cidade, endereco, cep, vt_bu_ativado, vt_bu_situacao), departamentos(nome_curto, nome, cidade, endereco, cep), vt_bilhetes(nome)')
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
      const steps: TransitStepGoogle[] = rota?.routes?.[0]?.legs?.[0]?.steps ?? []
      const pernas: PernaRota[] = steps
        .filter((s) => s.travelMode === 'TRANSIT' && s.transitDetails)
        .map((s) => ({
          modal: modalDoVeiculo(s.transitDetails?.transitLine?.vehicle?.type),
          // O Google não informa o município da linha — na POC usamos a cidade
          // de origem do trajeto; intermunicipal = casa e posto em cidades
          // diferentes (aproximação assumida, conferida no relatório).
          municipio: c?.cidade ?? '',
          intermunicipal: norm(c?.cidade) !== norm(d?.cidade),
        }))
      const cls = classificarRota(pernas, { buAtivado: c?.vt_bu_ativado ?? null, buSituacao: c?.vt_bu_situacao })
      const linhasTexto = steps
        .filter((s) => s.travelMode === 'TRANSIT')
        .map((s) => s.transitDetails?.transitLine?.nameShort ?? s.transitDetails?.transitLine?.name ?? '?')
      const bate = classificacaoBate(bilheteAtual, cls.bilhetes) ? 'OK' : 'DIVERGE'
      console.log(`${bate} | ${c?.nome_completo} | atual: ${bilheteAtual} | sugerido: ${cls.bilhetes.join(' + ') || '—'} (${cls.confianca})`)
      console.log(`      pernas: ${linhasTexto.join(' → ') || 'sem transporte público'}`)
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
