/**
 * Preenche o VT inicial a partir da planilha de VT vigente (22/10/2026):
 * "dados-locais/valores de vt por colab.xlsx" (RAZAO SOCIAL, MATRICULA, NOME, VALOR UNITÁRIO).
 *
 * O que faz por linha:
 *   - casa o colaborador pela MATRÍCULA (normalizada: só dígitos, sem zeros à
 *     esquerda — a planilha mistura "0969" e "01090"); nome é só conferência
 *   - marca colaboradores.vt_optante = true e vt_tipo_cartao pelo bilhete
 *     (BU NITERÓI → 'bun', BILHETE ÚNICO INTERMUNICIPAL → 'bui', demais → null)
 *   - cria o trajeto (colaborador × posto atual do cadastro) com o bilhete
 *     casado pelo VALOR EXATO (valor_diario_centavos — cada um dos 9 bilhetes
 *     tem valor único), status 'confirmado', origem 'manual'
 *   - regra "importação nunca grava palpite": valor sem bilhete de mesmo valor,
 *     matrícula não encontrada/duplicada, colaborador sem posto → PENDÊNCIA,
 *     nunca grava
 *
 * Uso:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/vt/importar-vt-vigente.ts [--arquivo=<xlsx>] [--aplicar]
 *   padrão = dry-run (só relatório). --aplicar grava (e faz backup antes).
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from '@e965/xlsx'
import fs from 'fs'
import { escopoSugerido } from '../../src/lib/vt/trajetos'
import { precisaoDoEndereco } from '../../src/lib/vt/enderecos'

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
  { auth: { persistSession: false } },
)

const APLICAR = process.argv.includes('--aplicar')
const argArquivo = process.argv.find((a) => a.startsWith('--arquivo='))
const ARQUIVO = argArquivo ? argArquivo.slice('--arquivo='.length) : 'dados-locais/valores de vt por colab.xlsx'

const normMatricula = (v: unknown) => String(v ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '')
const normNome = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

async function main() {
  const wb = XLSX.read(fs.readFileSync(ARQUIVO))
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).slice(1)

  const [{ data: colaboradores }, { data: departamentos }, { data: bilhetes }] = await Promise.all([
    supabase.from('colaboradores').select('id, matricula, nome_completo, status, departamento_id, cidade, endereco'),
    supabase.from('departamentos').select('id, nome, nome_curto, cidade, status'),
    supabase.from('vt_bilhetes').select('id, nome, valor_diario_centavos').eq('ativo', true),
  ])
  if (!colaboradores || !departamentos || !bilhetes) throw new Error('Falha ao ler o banco')

  const bilhetePorValor = new Map(bilhetes.map((b) => [b.valor_diario_centavos, b]))
  const colabPorMatricula = new Map<string, typeof colaboradores>()
  for (const c of colaboradores) {
    const chave = normMatricula(c.matricula)
    if (!chave) continue
    const lista = colabPorMatricula.get(chave) ?? []
    lista.push(c)
    colabPorMatricula.set(chave, lista)
  }
  const depPorId = new Map(departamentos.map((d) => [d.id, d]))

  const prontos: { colab: (typeof colaboradores)[number]; bilhete: (typeof bilhetes)[number]; dep: (typeof departamentos)[number] }[] = []
  const optantesSemTrajeto: { colab: (typeof colaboradores)[number]; bilhete: (typeof bilhetes)[number] }[] = []
  const pendencias: string[] = []
  let inativosIgnorados = 0

  for (const l of linhas) {
    const nome = String(l[2] ?? '').trim()
    if (!nome) continue
    const valorCent = Math.round(Number(l[3]) * 100)
    const bilhete = bilhetePorValor.get(valorCent)
    if (!bilhete) { pendencias.push(`${nome} — valor R$ ${(valorCent / 100).toFixed(2)} sem bilhete de mesmo valor`); continue }
    const lista = colabPorMatricula.get(normMatricula(l[1])) ?? []
    const ativosOuAfastados = lista.filter((c) => c.status !== 'Inativo')
    if (lista.length > 0 && ativosOuAfastados.length === 0) { inativosIgnorados++; continue }
    if (ativosOuAfastados.length !== 1) {
      pendencias.push(`${nome} (matrícula ${String(l[1]).trim()}) — ${ativosOuAfastados.length === 0 ? 'não encontrado' : 'matrícula duplicada'}`)
      continue
    }
    const colab = ativosOuAfastados[0]
    const dep = colab.departamento_id ? depPorId.get(colab.departamento_id) : null
    if (!dep) optantesSemTrajeto.push({ colab, bilhete })
    else prontos.push({ colab, bilhete, dep })
  }

  console.log(`\n=== DRY-RUN ${APLICAR ? '(APLICANDO)' : '(nada gravado)'} ===`)
  console.log(`Linhas na planilha: ${linhas.filter((l) => String(l[2] ?? '').trim()).length}`)
  console.log(`Optantes a marcar + trajeto confirmado: ${prontos.length}`)
  console.log(`Optantes a marcar SEM trajeto (sem posto no cadastro): ${optantesSemTrajeto.length}`)
  console.log(`Inativos/demitidos ignorados: ${inativosIgnorados}`)
  console.log(`Pendências: ${pendencias.length}`)
  for (const p of pendencias.slice(0, 30)) console.log('  - ' + p)

  if (!APLICAR) {
    console.log('\nDry-run. Para gravar: rode de novo com --aplicar')
    return
  }

  // backup antes de gravar
  const pasta = `dados-locais/backup_vt_preenchimento_${new Date().toISOString().slice(0, 10)}`
  fs.mkdirSync(pasta, { recursive: true })
  const [{ data: bakColab }, { data: bakTraj }] = await Promise.all([
    supabase.from('colaboradores').select('id, matricula, vt_optante, vt_tipo_cartao'),
    supabase.from('vt_trajetos').select('*'),
  ])
  fs.writeFileSync(`${pasta}/colaboradores_vt.json`, JSON.stringify(bakColab, null, 2))
  fs.writeFileSync(`${pasta}/vt_trajetos.json`, JSON.stringify(bakTraj, null, 2))
  console.log(`Backup em ${pasta}/`)

  const tipoCartao = (nome: string) =>
    nome === 'BU NITERÓI' ? 'bun' : nome === 'BILHETE ÚNICO INTERMUNICIPAL' ? 'bui' : null

  let optantesOk = 0, trajetosOk = 0, erros = 0
  const todos = [...prontos, ...optantesSemTrajeto]
  for (const { colab, bilhete } of todos) {
    const { data: up, error } = await supabase
      .from('colaboradores')
      .update({ vt_optante: true, vt_tipo_cartao: tipoCartao(bilhete.nome) })
      .eq('id', colab.id)
      .select('id')
    if (error || !up?.length) { erros++; console.log(`  ERRO optante ${colab.nome_completo}: ${error?.message ?? '0 linhas'}`); continue }
    optantesOk++
  }
  for (const { colab, bilhete, dep } of prontos) {
    const { data: existente } = await supabase
      .from('vt_trajetos')
      .select('id')
      .eq('colaborador_id', colab.id)
      .eq('departamento_id', dep.id)
      .maybeSingle()
    if (existente) continue
    const { data: ins, error } = await supabase
      .from('vt_trajetos')
      .insert({
        colaborador_id: colab.id,
        departamento_id: dep.id,
        bilhete_id: bilhete.id,
        escopo: escopoSugerido(colab.cidade, dep.cidade),
        precisao_origem: precisaoDoEndereco(colab.endereco),
        origem: 'manual',
        status: 'confirmado',
        observacao: 'Importado da planilha de VT vigente em 22/10/2026',
        confirmado_em: new Date().toISOString(),
      })
      .select('id')
    if (error || !ins?.length) { erros++; console.log(`  ERRO trajeto ${colab.nome_completo}: ${error?.message ?? '0 linhas'}`); continue }
    trajetosOk++
  }

  console.log(`\nGravado: ${optantesOk} optantes, ${trajetosOk} trajetos confirmados, ${erros} erros`)
}

main().catch((e) => { console.error(e); process.exit(1) })
