// Consolidação CBO em 2 postos (decisão da gestão, 06/08/2026):
//   NITERÓI: local b5f87b18 (antigo "ALIANÇA S/A...", 524 dias) renomeado para
//            "CBO NITERÓI" e absorve os 71 dias + 1 mapeamento do local 2ad4864d.
//   MACAÉ:   local 57787180 ("CBO MACAÉ") recebe os mapeamentos de Macaé;
//            local duplicado ae46ff3f (0 refs) é excluído.
// Depois, sincroniza os dias históricos do Excel mais recente: cada dia com
// assinatura CBO vai para o posto correto conforme os mapeamentos novos.
// Backups em dados-locais/ antes de cada fase de escrita.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { parseWorkbookBinary, agruparBatidasPorDia, encontrarColaborador } from '../src/lib/escalas/importarFlit'
import { inferirLocalTrabalho } from '../src/lib/escalas/inferirLocalTrabalho'
import type { MapeamentoFlitLocalTrabalho } from '../src/types/database'

const NITEROI = 'b5f87b18-b540-47b2-992c-0bae4ee56bb0'   // antigo "ALIANÇA S/A" -> vira CBO NITERÓI
const NITEROI_DUP = '2ad4864d-0240-4770-9954-7d486d888466' // antigo "CBO NITERÓI" (71 dias) -> absorvido
const MACAE = '57787180-3d9f-4c8f-ba08-c705e59dee43'     // "CBO MACAÉ" -> keeper de Macaé
const MACAE_DUP = 'ae46ff3f-a3d0-49d8-90b4-630c0317c52c' // "CBO SERVICOS MARITIMOS S.A." (0 refs) -> excluído

function carregarEnv(caminho: string) {
  if (!fs.existsSync(caminho)) return
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const sb = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function falhar(contexto: string, error: unknown): never {
  console.error(`ERRO em ${contexto}:`, error)
  process.exit(1)
}

// ---------- Fase 0: backup ----------
const { data: locais, error: eL } = await sb
  .from('locais_trabalho')
  .select('*')
  .in('id', [NITEROI, NITEROI_DUP, MACAE, MACAE_DUP])
if (eL) falhar('buscar locais', eL)

const { data: mapeamentosCbo, error: eM } = await sb
  .from('mapeamento_flit_local_trabalho')
  .select('*')
  .ilike('valor_flit', '%cbo%')
if (eM) falhar('buscar mapeamentos', eM)

const { data: diasDup, error: eD } = await sb
  .from('locais_trabalho_diario')
  .select('*')
  .eq('local_trabalho_id', NITEROI_DUP)
if (eD) falhar('buscar dias do local duplicado', eD)

const backup1 = {
  data_backup: new Date().toISOString(),
  motivo: 'Consolidação CBO em 2 postos (Niterói + Macaé) — estado ANTES das alterações',
  locais,
  mapeamentos_cbo: mapeamentosCbo,
  dias_do_local_absorvido: diasDup,
}
fs.writeFileSync(
  path.resolve('dados-locais/backup_cbo_consolidacao_2026-08-06.json'),
  JSON.stringify(backup1, null, 2)
)
console.log(`Backup 1 salvo: ${locais?.length} locais, ${mapeamentosCbo?.length} mapeamentos, ${diasDup?.length} dias do local absorvido`)

// ---------- Fase 1: locais e mapeamentos ----------
// 1a. Move os 71 dias do duplicado para o keeper
const { data: movidos, error: e1b } = await sb
  .from('locais_trabalho_diario')
  .update({ local_trabalho_id: NITEROI })
  .eq('local_trabalho_id', NITEROI_DUP)
  .select('id')
if (e1b) falhar('mover dias do duplicado', e1b)
console.log(`1a. ${movidos?.length} dias movidos de CBO NITERÓI (dup) para o keeper`)

// 1b. Move o mapeamento turno_departamento "CBO NITERÓI" para o keeper
const { error: e1c } = await sb
  .from('mapeamento_flit_local_trabalho')
  .update({ local_trabalho_id: NITEROI })
  .eq('local_trabalho_id', NITEROI_DUP)
if (e1c) falhar('mover mapeamento do duplicado', e1c)
console.log('1b. Mapeamento turno_departamento "CBO NITERÓI" apontado para o keeper')

// 1c. Exclui os locais duplicados (refs já zeradas/movidas) — antes do rename,
// pois há constraint UNIQUE em locais_trabalho.nome
for (const [id, rotulo] of [[NITEROI_DUP, 'CBO NITERÓI (dup)'], [MACAE_DUP, 'CBO SERVICOS MARITIMOS (dup)']] as const) {
  const { data: excluido, error: e1d } = await sb.from('locais_trabalho').delete().eq('id', id).select('id')
  if (e1d) falhar(`excluir ${rotulo}`, e1d)
  if (!excluido || excluido.length === 0) falhar(`excluir ${rotulo} (0 linhas)`, 'nenhuma linha excluída')
  console.log(`1c. Local ${rotulo} excluído`)
}

// 1d. Renomeia o keeper de Niterói (agora o nome está livre)
const { error: e1a } = await sb
  .from('locais_trabalho')
  .update({ nome: 'CBO NITERÓI', nome_curto: 'CBO NITERÓI' })
  .eq('id', NITEROI)
if (e1a) falhar('renomear local Niterói', e1a)
console.log('1d. Local ALIANÇA renomeado para CBO NITERÓI')

// 1e. Mapeamentos de Macaé passam a apontar para o local de Macaé
const { error: e1e } = await sb
  .from('mapeamento_flit_local_trabalho')
  .update({ local_trabalho_id: MACAE })
  .ilike('valor_flit', '%MACAÉ%')
if (e1e) falhar('apontar mapeamentos Macaé', e1e)
console.log('1e. Mapeamentos "CBO MACAÉ" (dispositivo + turno_departamento) apontados para CBO MACAÉ')

// 1f. Novos mapeamentos para os nomes de departamento sem regra
const novos = [
  { local_trabalho_id: NITEROI, tipo_match: 'turno_departamento', valor_flit: 'ALIANCA S A INDUSTRIA NAVAL', prioridade: 100, ativo: true },
  { local_trabalho_id: MACAE, tipo_match: 'turno_departamento', valor_flit: 'CBO SERVICOS MARITIMOS', prioridade: 100, ativo: true },
]
const { error: e1f } = await sb.from('mapeamento_flit_local_trabalho').insert(novos)
if (e1f) falhar('inserir novos mapeamentos', e1f)
console.log('1f. Mapeamentos criados: depto "ALIANCA S A INDUSTRIA NAVAL" -> Niterói; depto "CBO SERVICOS MARITIMOS" -> Macaé')

// ---------- Fase 2: sincronizar dias históricos pelo Excel ----------
const { data: arquivos, error: e2a } = await sb
  .from('escala_arquivos')
  .select('nome_arquivo, storage_path')
  .order('created_at', { ascending: false })
  .limit(1)
if (e2a) falhar('listar escala_arquivos', e2a)
const { data: blob, error: e2b } = await sb.storage.from('escala-arquivos').download(arquivos![0].storage_path)
if (e2b) falhar('baixar Excel', e2b)
const dias = agruparBatidasPorDia(await parseWorkbookBinary(Buffer.from(await blob!.arrayBuffer())))
console.log(`\nExcel: ${arquivos![0].nome_arquivo} — ${dias.length} dias`)

// Mapeamentos pós-ajuste (todos, para a inferência real)
const { data: mapTodos, error: e2c } = await sb
  .from('mapeamento_flit_local_trabalho')
  .select('id, local_trabalho_id, tipo_match, valor_flit, prioridade, ativo, created_at, updated_at')
if (e2c) falhar('buscar mapeamentos pós-ajuste', e2c)

const { data: colaboradores, error: e2d } = await sb
  .from('colaboradores')
  .select('id, nome_completo, matricula')
  .limit(5000)
if (e2d) falhar('buscar colaboradores', e2d)

// Alvo por (colaborador|data) apenas para dias com assinatura CBO
const alvos = new Map<string, { colaboradorId: string; data: string; localId: string; fonte: string; nome: string }>()
for (const dia of dias) {
  const assinatura = `${dia.nomeDispositivo} ${dia.departamento}`.toUpperCase()
  if (!assinatura.includes('CBO') && !assinatura.includes('ALIANCA')) continue
  const colaborador = encontrarColaborador(dia.nomeColaborador, dia.matricula, colaboradores as never)
  if (!colaborador) continue
  const inferido = inferirLocalTrabalho(mapTodos as MapeamentoFlitLocalTrabalho[], {
    tipoDispositivo: dia.tipoDispositivo,
    nomeDispositivo: dia.nomeDispositivo,
    perimetro: dia.perimetro,
    departamento: dia.departamento,
    turno: dia.turno,
  })
  if (!inferido || (inferido.localTrabalhoId !== NITEROI && inferido.localTrabalhoId !== MACAE)) continue
  const chave = `${colaborador.id}|${dia.data}`
  const anterior = alvos.get(chave)
  if (anterior && anterior.localId !== inferido.localTrabalhoId) {
    console.warn(`  CONFLITO ${chave}: ${anterior.localId} vs ${inferido.localTrabalhoId} — mantido o primeiro`)
    continue
  }
  alvos.set(chave, { colaboradorId: colaborador.id, data: dia.data, localId: inferido.localTrabalhoId, fonte: inferido.fonte, nome: dia.nomeColaborador })
}
console.log(`Dias com assinatura CBO no Excel: ${alvos.size} (Niterói: ${[...alvos.values()].filter((a) => a.localId === NITEROI).length}, Macaé: ${[...alvos.values()].filter((a) => a.localId === MACAE).length})`)

// Busca as linhas do diário desses colaboradores no período
const datas = [...alvos.values()].map((a) => a.data).sort()
const colabIds = [...new Set([...alvos.values()].map((a) => a.colaboradorId))]
const linhas: Array<{ id: string; colaborador_id: string; data: string; local_trabalho_id: string | null; fonte: string }> = []
let inicio = 0
while (true) {
  const { data: pagina, error: e2e } = await sb
    .from('locais_trabalho_diario')
    .select('id, colaborador_id, data, local_trabalho_id, fonte')
    .in('colaborador_id', colabIds)
    .gte('data', datas[0])
    .lte('data', datas[datas.length - 1])
    .range(inicio, inicio + 999)
  if (e2e) falhar('buscar diário para sincronização', e2e)
  if (!pagina || pagina.length === 0) break
  linhas.push(...pagina)
  if (pagina.length < 1000) break
  inicio += 1000
}
const porChave = new Map(linhas.map((l) => [`${l.colaborador_id}|${l.data}`, l]))

// Backup 2: valores atuais das linhas que serão alteradas
const alteracoes: Array<{ id: string; colaborador_id: string; data: string; de: string | null; para: string; fonte_antiga: string; fonte_nova: string | undefined }> = []
for (const alvo of alvos.values()) {
  const linha = porChave.get(`${alvo.colaboradorId}|${alvo.data}`)
  if (!linha || linha.local_trabalho_id === alvo.localId) continue
  alteracoes.push({
    id: linha.id,
    colaborador_id: linha.colaborador_id,
    data: linha.data,
    de: linha.local_trabalho_id,
    para: alvo.localId,
    fonte_antiga: linha.fonte,
    fonte_nova: linha.fonte === 'nao_identificado' ? alvo.fonte : undefined,
  })
}
fs.writeFileSync(
  path.resolve('dados-locais/backup_cbo_sincronizacao_excel_2026-08-06.json'),
  JSON.stringify({ data_backup: new Date().toISOString(), motivo: 'Valores ANTES da sincronização CBO pelo Excel', alteracoes }, null, 2)
)
console.log(`Backup 2 salvo: ${alteracoes.length} linhas do diário serão corrigidas`)

for (const alt of alteracoes) {
  const update: Record<string, unknown> = { local_trabalho_id: alt.para }
  if (alt.fonte_nova) update.fonte = alt.fonte_nova
  const { data: ok, error: eUp } = await sb.from('locais_trabalho_diario').update(update).eq('id', alt.id).select('id')
  if (eUp) falhar(`atualizar linha ${alt.id}`, eUp)
  if (!ok || ok.length === 0) falhar(`atualizar linha ${alt.id}`, '0 linhas')
}
console.log(`${alteracoes.length} linhas corrigidas no diário`)

// ---------- Fase 3: verificação ----------
const { data: locaisFim } = await sb.from('locais_trabalho').select('id, nome, nome_curto').or('nome.ilike.%cbo%,nome_curto.ilike.%cbo%,nome.ilike.%alianca%')
console.log('\n=== Locais finais ===')
console.log(locaisFim)
const { data: mapsFim } = await sb.from('mapeamento_flit_local_trabalho').select('tipo_match, valor_flit, local_trabalho:locais_trabalho(nome_curto)').or('valor_flit.ilike.%cbo%,valor_flit.ilike.%alianca%')
console.log('=== Mapeamentos finais ===')
for (const m of mapsFim || []) console.log(`  ${m.tipo_match} | "${m.valor_flit}" -> ${(m.local_trabalho as unknown as { nome_curto: string })?.nome_curto}`)
