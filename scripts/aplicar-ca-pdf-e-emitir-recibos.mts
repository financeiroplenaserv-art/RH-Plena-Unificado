// Aplica as decisões da gestão (04/08/2026) sobre CA e recibos do CEU:
//
//   fase1 — BACKUP de todas as entregas sem recibo (id, numero_recibo,
//           recibo_emitido, snapshot_item) em dados-locais/backup_ca_recibos_2026-08-04.json;
//           CORREÇÃO do snapshot_item.ca das 129 entregas da aba DIVERGENTE de
//           dados-locais/revisao_ca_entregas.xlsx com o CA do PDF formatado
//           (99.999); cálculo dos grupos de recibo (colaborador + data + EPI/
//           não-EPI) gravados em dados-locais/grupos_recibos_2026-08-04.json.
//
//   [entre fases] reservar N números na sequência ceu_recibo_seq via
//   `supabase db query --linked` (setval) — o script imprime o SQL exato.
//
//   fase2 <base> — EMISSÃO: atribui REC-2026-NNNNN a partir de <base>+1 para
//           cada grupo e grava numero_recibo + recibo_emitido=true; ao final,
//           VERIFICAÇÃO completa (contagens, duplicados, spot-checks, CAs).
//
// Uso:
//   npx tsx --tsconfig tsconfig.scripts.json scripts/aplicar-ca-pdf-e-emitir-recibos.mts fase1
//   npx tsx --tsconfig tsconfig.scripts.json scripts/aplicar-ca-pdf-e-emitir-recibos.mts fase2 176

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import XLSX from '@e965/xlsx'

const FASE = process.argv[2]
const BASE = process.argv[3] ? Number(process.argv[3]) : null
if (FASE !== 'fase1' && FASE !== 'fase2') {
  console.error('Uso: ... aplicar-ca-pdf-e-emitir-recibos.mts fase1 | fase2 <base>')
  process.exit(1)
}
if (FASE === 'fase2' && (!BASE || Number.isNaN(BASE))) {
  console.error('fase2 exige a base numérica da sequência (ex.: fase2 176)')
  process.exit(1)
}

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
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

const ARQ_BACKUP = 'dados-locais/backup_ca_recibos_2026-08-04.json'
const ARQ_GRUPOS = 'dados-locais/grupos_recibos_2026-08-04.json'
const ARQ_XLSX = 'dados-locais/revisao_ca_entregas.xlsx'

interface Entrega {
  id: string
  colaborador_id: string
  data_entrega: string
  quantidade: number
  numero_recibo: string | null
  recibo_emitido: boolean
  snapshot_item: Record<string, unknown> | null
  colaboradores: { nome_completo: string } | null
}

async function buscarEntregasSemRecibo(): Promise<Entrega[]> {
  const linhas: Entrega[] = []
  const PASSO = 1000
  for (let i = 0; ; i += PASSO) {
    const { data, error } = await supabase
      .from('entregas')
      .select('id, colaborador_id, data_entrega, quantidade, numero_recibo, recibo_emitido, snapshot_item, colaboradores(nome_completo)')
      .eq('recibo_emitido', false)
      .range(i, i + PASSO - 1)
    if (error) throw new Error('entregas: ' + error.message)
    if (!data || data.length === 0) break
    linhas.push(...(data as unknown as Entrega[]))
    if (data.length < PASSO) break
  }
  return linhas
}

/** Formata o CA: só dígitos; se > 3 dígitos, ponto antes dos 3 últimos. */
function formatarCA(ca: string): string {
  const d = ca.replace(/\D/g, '')
  if (d.length <= 3) return d
  return `${d.slice(0, -3)}.${d.slice(-3)}`
}

/** Espelha tipoDe() do app (src/lib/ceu/emissaoRecibos.ts): EPI vs não-EPI. */
function grupoTipo(e: Entrega): 'EPI' | 'NAO_EPI' {
  const tipo = (e.snapshot_item?.tipo as string | undefined) || 'Uniforme'
  return tipo === 'EPI' ? 'EPI' : 'NAO_EPI'
}

function numeroRecibo(n: number): string {
  return `REC-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`
}

// ============================================================ FASE 1
async function fase1() {
  const entregas = await buscarEntregasSemRecibo()
  console.log(`Entregas sem recibo: ${entregas.length}`)

  // ---- 1. BACKUP (antes de qualquer escrita; nunca sobrescreve) ----
  if (fs.existsSync(ARQ_BACKUP)) {
    console.log(`Backup já existe (${ARQ_BACKUP}) — mantido (não sobrescreve).`)
  } else {
    fs.mkdirSync('dados-locais', { recursive: true })
    fs.writeFileSync(
      ARQ_BACKUP,
      JSON.stringify(
        entregas.map((e) => ({
          id: e.id,
          numero_recibo: e.numero_recibo,
          recibo_emitido: e.recibo_emitido,
          snapshot_item: e.snapshot_item,
        })),
        null,
        2
      )
    )
    console.log(`Backup gravado: ${ARQ_BACKUP} (${entregas.length} entregas)`)
  }

  // ---- 2. CORREÇÃO dos 129 DIVERGENTE ----
  // XLSX.readFile falha com caminho relativo sob tsx/ESM — ler via buffer
  const wb = XLSX.read(fs.readFileSync(ARQ_XLSX))
  const divergentes = XLSX.utils.sheet_to_json<{ entrega_id: string; ca_pdf: string; ca_sistema: string }>(
    wb.Sheets['DIVERGENTE']
  ).filter((r) => r.entrega_id)
  console.log(`Linhas DIVERGENTE na planilha: ${divergentes.length}`)
  if (divergentes.length !== 129) throw new Error(`Esperava 129 DIVERGENTE, veio ${divergentes.length} — PARE`)

  const porId = new Map(entregas.map((e) => [e.id, e]))
  const exemplos: { id: string; antes: string; depois: string }[] = []
  let corrigidas = 0
  for (const d of divergentes) {
    const e = porId.get(d.entrega_id)
    if (!e) throw new Error(`Entrega ${d.entrega_id} da aba DIVERGENTE não está entre as sem recibo — PARE`)
    const caNovo = formatarCA(String(d.ca_pdf ?? ''))
    const caAntes = ((e.snapshot_item?.ca as string | undefined) ?? '').trim()
    if (caAntes === caNovo) continue // idempotente
    const novoSnapshot = { ...(e.snapshot_item ?? {}), ca: caNovo }
    const { data, error } = await supabase
      .from('entregas')
      .update({ snapshot_item: novoSnapshot })
      .eq('id', e.id)
      .eq('recibo_emitido', false)
      .select('id')
    if (error) throw new Error(`UPDATE snapshot ${e.id}: ${error.message}`)
    if (!data || data.length !== 1) throw new Error(`UPDATE snapshot ${e.id} afetou ${data?.length ?? 0} linhas — PARE`)
    e.snapshot_item = novoSnapshot // mantém em memória para a fase de grupos
    corrigidas++
    if (exemplos.length < 5) exemplos.push({ id: e.id, antes: caAntes, depois: caNovo })
  }
  console.log(`Snapshots corrigidos: ${corrigidas} (esperado até 129; 0 em reexecução idempotente)`)
  console.log('Exemplos antes→depois:')
  for (const x of exemplos) console.log(`  ${x.id}: '${x.antes}' → '${x.depois}'`)

  // ---- 3. GRUPOS de recibo (colaborador + data + EPI/não-EPI) ----
  const grupos = new Map<string, Entrega[]>()
  for (const e of entregas) {
    if (e.numero_recibo) throw new Error(`Entrega ${e.id} sem recibo mas com numero_recibo=${e.numero_recibo} — PARE`)
    const chave = `${e.colaborador_id}|${e.data_entrega}|${grupoTipo(e)}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(e)
  }
  const lista = [...grupos.entries()]
    .map(([chave, es]) => {
      const [colaborador_id, data_entrega, tipo] = chave.split('|')
      return { colaborador_id, data_entrega, tipo, nome: es[0].colaboradores?.nome_completo ?? '', ids: es.map((x) => x.id).sort() }
    })
    .sort((a, b) =>
      a.nome.localeCompare(b.nome) || a.data_entrega.localeCompare(b.data_entrega) || a.tipo.localeCompare(b.tipo)
    )

  fs.writeFileSync(ARQ_GRUPOS, JSON.stringify(lista, null, 2))
  const n = lista.length
  console.log(`\nGrupos de recibo: ${n} (cobrindo ${lista.reduce((s, g) => s + g.ids.length, 0)} entregas)`)
  console.log(`Grupos gravados: ${ARQ_GRUPOS}`)
  console.log('\n=== PRÓXIMO PASSO (reservar números na sequência) ===')
  console.log('mv .env .env.bak && npx supabase db query --linked "WITH cur AS (SELECT last_value, is_called FROM public.ceu_recibo_seq) SELECT (SELECT last_value FROM cur) AS base, (SELECT is_called FROM cur) AS is_called, setval(\'public.ceu_recibo_seq\', (SELECT last_value FROM cur) + ' + n + ', true) AS reservado_ate;" ; mv .env.bak .env')
  console.log(`Depois rode: fase2 <base>  (base = last_value ANTES do setval; números serão base+1 .. base+${n})`)
}

// ============================================================ FASE 2
async function fase2(base: number) {
  if (!fs.existsSync(ARQ_BACKUP)) throw new Error('Backup não encontrado — rode a fase1 primeiro')
  const grupos = JSON.parse(fs.readFileSync(ARQ_GRUPOS, 'utf-8')) as {
    colaborador_id: string; data_entrega: string; tipo: string; nome: string; ids: string[]
  }[]
  console.log(`Grupos carregados: ${grupos.length} | base da sequência: ${base}`)

  // ---- EMISSÃO: um número por grupo ----
  let emitidas = 0
  const faixa = { primeiro: base + 1, ultimo: base + grupos.length }
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i]
    const numero = numeroRecibo(base + 1 + i)
    ;(g as Record<string, unknown>).numero_recibo = numero
    const { data, error } = await supabase
      .from('entregas')
      .update({ numero_recibo: numero, recibo_emitido: true })
      .in('id', g.ids)
      .eq('recibo_emitido', false)
      .is('numero_recibo', null)
      .select('id')
    if (error) throw new Error(`UPDATE recibo grupo ${i + 1}/${grupos.length} (${numero}): ${error.message} — PARE`)
    if (!data || data.length !== g.ids.length) {
      throw new Error(
        `Grupo ${numero} (${g.nome}, ${g.data_entrega}, ${g.tipo}): esperava ${g.ids.length} linhas, afetou ${data?.length ?? 0} — PARE (emitidas até aqui: ${emitidas})`
      )
    }
    emitidas += data.length
    if ((i + 1) % 200 === 0) console.log(`  ... ${i + 1}/${grupos.length} grupos emitidos`)
  }
  console.log(`\nEmissão concluída: ${emitidas} entregas em ${grupos.length} recibos`)
  console.log(`Faixa de números: ${numeroRecibo(faixa.primeiro)} .. ${numeroRecibo(faixa.ultimo)}`)
  fs.writeFileSync(ARQ_GRUPOS, JSON.stringify(grupos, null, 2)) // agora com numero_recibo

  // ---- VERIFICAÇÃO FINAL ----
  console.log('\n=== VERIFICAÇÃO FINAL ===')
  const { count: total } = await supabase.from('entregas').select('id', { count: 'exact', head: true })
  const { count: comRecibo } = await supabase.from('entregas').select('id', { count: 'exact', head: true }).eq('recibo_emitido', true)
  const { count: semRecibo } = await supabase.from('entregas').select('id', { count: 'exact', head: true }).eq('recibo_emitido', false)
  console.log(`Total de entregas: ${total} | com recibo: ${comRecibo} | sem recibo: ${semRecibo}`)
  if (semRecibo !== 0) throw new Error(`Ainda há ${semRecibo} entregas sem recibo — PARE`)

  // Duplicados: mesmo número em grupos lógicos diferentes
  const todas: { id: string; colaborador_id: string; data_entrega: string; numero_recibo: string | null; snapshot_item: Record<string, unknown> | null }[] = []
  const PASSO = 1000
  for (let i = 0; ; i += PASSO) {
    const { data, error } = await supabase
      .from('entregas')
      .select('id, colaborador_id, data_entrega, numero_recibo, snapshot_item')
      .not('numero_recibo', 'is', null)
      .range(i, i + PASSO - 1)
    if (error) throw new Error('verificação: ' + error.message)
    if (!data || data.length === 0) break
    todas.push(...data)
    if (data.length < PASSO) break
  }
  const porNumero = new Map<string, Set<string>>()
  for (const e of todas) {
    const tipo = ((e.snapshot_item?.tipo as string | undefined) || 'Uniforme') === 'EPI' ? 'EPI' : 'NAO_EPI'
    const chaveLogica = `${e.colaborador_id}|${e.data_entrega}|${tipo}`
    if (!porNumero.has(e.numero_recibo!)) porNumero.set(e.numero_recibo!, new Set())
    porNumero.get(e.numero_recibo!)!.add(chaveLogica)
  }
  const duplicados = [...porNumero.entries()].filter(([, chaves]) => chaves.size > 1)
  console.log(`Números de recibo distintos: ${porNumero.size} | duplicados em grupos diferentes: ${duplicados.length}`)
  if (duplicados.length > 0) {
    for (const [n] of duplicados.slice(0, 10)) console.log(`  DUPLICADO: ${n}`)
    throw new Error('Há números duplicados — PARE')
  }

  // Spot-check de 3 grupos
  console.log('\nSpot-check de 3 grupos:')
  for (const g of [grupos[0], grupos[Math.floor(grupos.length / 2)], grupos[grupos.length - 1]]) {
    const { data } = await supabase.from('entregas').select('id, numero_recibo, recibo_emitido').in('id', g.ids)
    const numeros = new Set((data ?? []).map((d) => d.numero_recibo))
    const todasEmitidas = (data ?? []).every((d) => d.recibo_emitido)
    console.log(
      `  ${(g as Record<string, unknown>).numero_recibo} | ${g.nome} | ${g.data_entrega} | ${g.tipo} | ${g.ids.length} entregas | números distintos: ${numeros.size} | todas emitidas: ${todasEmitidas}`
    )
  }
  // EPI e não-EPI do mesmo colaborador/data devem ter números diferentes
  const par = new Map<string, Set<string>>()
  for (const g of grupos) {
    const k = `${g.colaborador_id}|${g.data_entrega}`
    if (!par.has(k)) par.set(k, new Set())
    par.get(k)!.add(`${g.tipo}:${(g as Record<string, unknown>).numero_recibo}`)
  }
  const conflito = [...par.values()].filter((s) => s.size === 2 && new Set([...s].map((x) => x.split(':')[1])).size === 1)
  console.log(`Grupos EPI+não-EPI no mesmo dia com mesmo número: ${conflito.length} (deve ser 0)`)

  // CAs corrigidos: 5 exemplos antes (backup) → depois (banco)
  const backup = JSON.parse(fs.readFileSync(ARQ_BACKUP, 'utf-8')) as { id: string; snapshot_item: Record<string, unknown> | null }[]
  const caAntes = new Map(backup.map((b) => [b.id, ((b.snapshot_item?.ca as string | undefined) ?? '').trim()]))
  const wb = XLSX.read(fs.readFileSync(ARQ_XLSX))
  const divergentes = XLSX.utils.sheet_to_json<{ entrega_id: string }>(wb.Sheets['DIVERGENTE']).filter((r) => r.entrega_id)
  console.log('\nCAs corrigidos (antes → depois), 5 exemplos:')
  for (const d of divergentes.slice(0, 5)) {
    const { data } = await supabase.from('entregas').select('snapshot_item').eq('id', d.entrega_id).single()
    console.log(`  ${d.entrega_id}: '${caAntes.get(d.entrega_id)}' → '${(data?.snapshot_item as Record<string, unknown>)?.ca}'`)
  }
  console.log('\nTUDO OK')
}

if (FASE === 'fase1') await fase1()
else await fase2(BASE!)
