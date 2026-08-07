// Consolidação de locais duplicados (decisão da gestão, 07/08/2026):
//  - ROSAS + CHÁCARA ITAGUAÍ (x2)      -> keeper ROSAS (542d) renomeado CHÁCARA ITAGUAÍ
//  - ENSEADA + ENSEADA PARK            -> keeper ENSEADA (713d) renomeado ENSEADA PARK
//  - GREAT + GREAT PLACE               -> keeper GREAT (445d) renomeado GREAT PLACE
//  - MARINO + MARINO RESIDENCIAL       -> keeper MARINO (299d)
//  - QUINTAS + QUINTAS DE ICARAÍ       -> keeper QUINTAS (237d) renomeado QUINTAS DE ICARAÍ
//  - TATHIANA + THATIANA               -> keeper TATHIANA (134d)
//  - NUTRINDO IDEAIS duplicado (0d)    -> excluído; keeper renomeado NUTRINDO IDEAIS
// Novos: local LAS PALMAS + 10 mapeamentos (CRISTIANA, LAS PALMAS, FLOR DE LOTUS,
// ROSAS, DALIAS, ENSEADA, GREAT, MARINO, QUINTAS, TATHIANA).
// Backup em dados-locais/ antes de qualquer escrita.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

// keeper: id que fica | absorver: ids que somem | novoNome: rename final do keeper (null = mantém)
const FUSOES: Array<{ keeper: string; novoNome: string | null; absorver: string[]; rotulo: string }> = [
  { keeper: 'ROSAS', novoNome: 'CHÁCARA ITAGUAÍ', absorver: ['CHÁCARA ITAGUAÍ', 'CHÁCARA ITAGUAI'], rotulo: 'ROSAS+CHÁCARA' },
  { keeper: 'ENSEADA', novoNome: 'ENSEADA PARK', absorver: ['ENSEADA PARK'], rotulo: 'ENSEADA' },
  { keeper: 'GREAT', novoNome: 'GREAT PLACE', absorver: ['GREAT PLACE'], rotulo: 'GREAT' },
  { keeper: 'MARINO', novoNome: null, absorver: ['MARINO RESIDENCIAL'], rotulo: 'MARINO' },
  { keeper: 'QUINTAS', novoNome: 'QUINTAS DE ICARAÍ', absorver: ['QUINTAS DE ICARAÍ'], rotulo: 'QUINTAS' },
  { keeper: 'TATHIANA', novoNome: null, absorver: ['THATIANA'], rotulo: 'TATHIANA' },
]

const { data: locaisRows, error: eL } = await sb.from('locais_trabalho').select('id, nome, nome_curto')
if (eL) falhar('buscar locais', eL)
const porNomeCurto = new Map((locaisRows || []).map((l) => [(l.nome_curto || '').toUpperCase(), l]))

// ---------- Fase 0: backup ----------
const idsEnvolvidos = new Set<string>()
for (const f of FUSOES) {
  const k = porNomeCurto.get(f.keeper)
  if (!k) falhar(`local keeper ${f.keeper} não encontrado`, '')
  f.keeper = k.id
  idsEnvolvidos.add(k.id)
  f.absorver = f.absorver.map((nc) => {
    const a = porNomeCurto.get(nc.toUpperCase())
    if (!a) falhar(`local a absorver ${nc} não encontrado (${f.rotulo})`, '')
    idsEnvolvidos.add(a.id)
    return a.id
  })
}
const nutrindoDup = (locaisRows || []).find((l) => l.nome === 'NUTRINDO IDEAIS' && l.nome_curto === 'NUTRINDO IDEAIS')
const nutrindoKeeper = (locaisRows || []).find((l) => l.nome === 'FLOR DE LOTUS CONSULTORIO MEDICO LTDA')
if (!nutrindoDup || !nutrindoKeeper) falhar('locais NUTRINDO não encontrados', '')
idsEnvolvidos.add(nutrindoDup.id)
idsEnvolvidos.add(nutrindoKeeper.id)

const { data: locaisBkp } = await sb.from('locais_trabalho').select('*').in('id', Array.from(idsEnvolvidos))
const { data: mapsBkp } = await sb.from('mapeamento_flit_local_trabalho').select('*').in('local_trabalho_id', Array.from(idsEnvolvidos))
const { data: diasBkp } = await sb
  .from('locais_trabalho_diario')
  .select('*')
  .in('local_trabalho_id', FUSOES.flatMap((f) => f.absorver))
fs.writeFileSync(
  path.resolve('dados-locais/backup_fusao_locais_2026-08-07.json'),
  JSON.stringify({ data_backup: new Date().toISOString(), motivo: 'Fusão de locais duplicados + novos mapeamentos — estado ANTES', locais: locaisBkp, mapeamentos: mapsBkp, dias_dos_locais_absorvidos: diasBkp }, null, 2)
)
console.log(`Backup salvo: ${locaisBkp?.length} locais, ${mapsBkp?.length} mapeamentos, ${diasBkp?.length} dias absorvidos`)

// ---------- Fase 1: fusões ----------
for (const f of FUSOES) {
  for (const absorvido of f.absorver) {
    const { data: movidos, error: e1 } = await sb
      .from('locais_trabalho_diario')
      .update({ local_trabalho_id: f.keeper })
      .eq('local_trabalho_id', absorvido)
      .select('id')
    if (e1) falhar(`mover dias (${f.rotulo})`, e1)
    const { error: e2 } = await sb.from('mapeamento_flit_local_trabalho').update({ local_trabalho_id: f.keeper }).eq('local_trabalho_id', absorvido)
    if (e2) falhar(`mover mapeamentos (${f.rotulo})`, e2)
    const { data: excluido, error: e3 } = await sb.from('locais_trabalho').delete().eq('id', absorvido).select('id')
    if (e3) falhar(`excluir local absorvido (${f.rotulo})`, e3)
    if (!excluido || excluido.length === 0) falhar(`excluir local absorvido (${f.rotulo})`, '0 linhas')
    console.log(`${f.rotulo}: absorvido excluído, ${movidos?.length} dias movidos`)
  }
  if (f.novoNome) {
    const { error: e4 } = await sb.from('locais_trabalho').update({ nome: f.novoNome, nome_curto: f.novoNome }).eq('id', f.keeper)
    if (e4) falhar(`renomear keeper (${f.rotulo})`, e4)
    console.log(`${f.rotulo}: keeper renomeado para ${f.novoNome}`)
  }
}

// NUTRINDO: exclui duplicado vazio e limpa o nome do keeper
const { error: eN1 } = await sb.from('locais_trabalho').delete().eq('id', nutrindoDup.id)
if (eN1) falhar('excluir NUTRINDO duplicado', eN1)
const { error: eN2 } = await sb.from('locais_trabalho').update({ nome: 'NUTRINDO IDEAIS', nome_curto: 'NUTRINDO IDEAIS' }).eq('id', nutrindoKeeper.id)
if (eN2) falhar('renomear NUTRINDO keeper', eN2)
console.log('NUTRINDO IDEAIS: duplicado excluído, keeper renomeado')

// ---------- Fase 2: novo local + novos mapeamentos ----------
const { data: lasPalmas, error: eLP } = await sb
  .from('locais_trabalho')
  .insert({ nome: 'LAS PALMAS', nome_curto: 'LAS PALMAS', status: 'Ativo', observacao: 'Cadastrado na consolidação de mapeamentos (07/08/2026)' })
  .select('id')
  .single()
if (eLP) falhar('criar local LAS PALMAS', eLP)
console.log('Local LAS PALMAS criado')

const cristiana = porNomeCurto.get('CRISTIANA')!
const novos: Array<{ local_trabalho_id: string; tipo_match: string; valor_flit: string }> = [
  { local_trabalho_id: cristiana.id, tipo_match: 'turno_departamento', valor_flit: 'CRISTIANA' },
  { local_trabalho_id: lasPalmas.id, tipo_match: 'turno_departamento', valor_flit: 'LAS PALMAS' },
  { local_trabalho_id: nutrindoKeeper.id, tipo_match: 'turno_departamento', valor_flit: 'FLOR DE LOTUS' },
]
const keeperPorRotulo = new Map(FUSOES.map((f) => [f.rotulo, f.keeper]))
for (const [rotulo, valor] of [
  ['ROSAS+CHÁCARA', 'ROSAS'],
  ['ROSAS+CHÁCARA', 'DALIAS'],
  ['ENSEADA', 'ENSEADA'],
  ['GREAT', 'GREAT'],
  ['MARINO', 'MARINO'],
  ['QUINTAS', 'QUINTAS'],
  ['TATHIANA', 'TATHIANA'],
] as const) {
  novos.push({ local_trabalho_id: keeperPorRotulo.get(rotulo)!, tipo_match: 'turno_departamento', valor_flit: valor })
}
const { error: eIns } = await sb.from('mapeamento_flit_local_trabalho').insert(novos.map((n) => ({ ...n, prioridade: 100, ativo: true })))
if (eIns) falhar('inserir novos mapeamentos', eIns)
console.log(`${novos.length} mapeamentos criados: ${novos.map((n) => n.valor_flit).join(', ')}`)
console.log('\nConcluído.')
