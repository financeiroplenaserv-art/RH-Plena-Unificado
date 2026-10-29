/**
 * Grava o FATO oficial do site da Riocard no cadastro (decisão da gestora,
 * 28/10/2026): quem tem o Bilhete Único ATIVADO. Fonte:
 * "dados-locais/Bilhete_Unico_Riocard.xlsx" (aba "Cartões": Matrícula, Nome,
 * CPF, Nº do Cartão, Situação do BU (site), BU habilitado?).
 *
 * Por pessoa (casada por CPF normalizado para 11 dígitos — o banco tem CPFs
 * sem o zero à esquerda de importações antigas):
 *   - vt_bu_ativado      = "BU habilitado?" = Sim
 *   - vt_bu_situacao     = texto cru do site (Ativado / Suspenso Setrans / ...)
 *   - vt_bu_consultado_em = data do arquivo
 *   - vt_riocard_numero_cartao = Nº do Cartão (série — útil na Fase 4)
 *
 * NUNCA mexe em vt_tipo_cartao (a classificação operacional é decisão da
 * gestora, não do arquivo). CPF sem cadastro ativo/afastado é só listado
 * (prováveis desligados).
 *
 * PRÉ-REQUISITO: migration 167 aplicada (cria as 4 colunas).
 *
 * Uso:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/vt/importar-riocard-bu.ts [--arquivo=<xlsx>] [--data=AAAA-MM-DD] [--aplicar]
 *   padrão = dry-run (só relatório). --aplicar grava (e faz backup antes).
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from '@e965/xlsx'
import fs from 'fs'

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
const ARQUIVO = argArquivo ? argArquivo.slice('--arquivo='.length) : 'dados-locais/Bilhete_Unico_Riocard.xlsx'
const argData = process.argv.find((a) => a.startsWith('--data='))
const DATA_CONSULTA = argData ? argData.slice('--data='.length) : '2026-10-28'

const cpf11 = (v: unknown) => String(v ?? '').replace(/\D/g, '').padStart(11, '0')

async function main() {
  const wb = XLSX.read(fs.readFileSync(ARQUIVO))
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Cartões'], { header: 1, defval: '' }).slice(1)
  const cartoes = linhas
    .filter((l) => String(l[2] ?? '').trim())
    .map((l) => ({
      matricula: String(l[0] ?? ''),
      nome: String(l[1] ?? ''),
      cpf: cpf11(l[2]),
      numeroCartao: String(l[3] ?? ''),
      situacao: String(l[4] ?? ''),
      habilitado: String(l[5] ?? '').trim().toLowerCase() === 'sim',
    }))

  const { data: colaboradores, error } = await supabase
    .from('colaboradores')
    .select('id, nome_completo, cpf, status, vt_optante, vt_tipo_cartao, vt_bu_ativado, vt_bu_situacao, vt_bu_consultado_em, vt_riocard_numero_cartao')
    .in('status', ['Ativo', 'Afastado'])
  if (error) throw new Error(`Lendo colaboradores: ${error.message} — a migration 167 está aplicada?`)

  const porCpf = new Map<string, (typeof colaboradores)[number]>()
  for (const c of colaboradores ?? []) {
    const cpf = cpf11(c.cpf)
    if (cpf !== '00000000000') porCpf.set(cpf, c)
  }

  const gravar: { id: string; nome: string; antes: unknown; depois: unknown }[] = []
  const foraDoCorh: typeof cartoes = []
  for (const cartao of cartoes) {
    const c = porCpf.get(cartao.cpf)
    if (!c) {
      foraDoCorh.push(cartao)
      continue
    }
    const depois = {
      vt_bu_ativado: cartao.habilitado,
      vt_bu_situacao: cartao.situacao,
      vt_bu_consultado_em: DATA_CONSULTA,
      vt_riocard_numero_cartao: cartao.numeroCartao,
    }
    const mudou =
      c.vt_bu_ativado !== depois.vt_bu_ativado ||
      c.vt_bu_situacao !== depois.vt_bu_situacao ||
      c.vt_bu_consultado_em !== depois.vt_bu_consultado_em ||
      c.vt_riocard_numero_cartao !== depois.vt_riocard_numero_cartao
    if (mudou) {
      gravar.push({
        id: c.id,
        nome: c.nome_completo,
        antes: {
          vt_bu_ativado: c.vt_bu_ativado,
          vt_bu_situacao: c.vt_bu_situacao,
          vt_bu_consultado_em: c.vt_bu_consultado_em,
          vt_riocard_numero_cartao: c.vt_riocard_numero_cartao,
        },
        depois,
      })
    }
  }

  console.log(`Lista Riocard: ${cartoes.length} cartões`)
  console.log(`Casados no CORH por CPF: ${cartoes.length - foraDoCorh.length}`)
  console.log(`A gravar (mudou algo): ${gravar.length}`)
  console.log(`Sem cadastro ativo/afastado no CORH: ${foraDoCorh.length} (só listados)`)
  for (const f of foraDoCorh) console.log(`  - ${f.nome} (${f.matricula}) — ${f.situacao}`)

  if (!APLICAR) {
    console.log('\nDRY-RUN — nada gravado. Rode com --aplicar para gravar.')
    return
  }

  fs.mkdirSync('dados-locais/riocard_2026-10-28', { recursive: true })
  fs.writeFileSync(
    `dados-locais/riocard_2026-10-28/backup_antes_importacao_${Date.now()}.json`,
    JSON.stringify(gravar.map((g) => ({ id: g.id, nome: g.nome, antes: g.antes })), null, 2),
  )

  let ok = 0
  const erros: string[] = []
  for (const g of gravar) {
    const { data, error: erroUpd } = await supabase
      .from('colaboradores')
      .update(g.depois as Record<string, unknown>)
      .eq('id', g.id)
      .select('id')
    if (erroUpd || !data?.length) {
      erros.push(`${g.nome}: ${erroUpd?.message ?? '0 linhas (RLS?)'}`)
    } else ok++
  }
  console.log(`\nGravados: ${ok} de ${gravar.length}`)
  if (erros.length) {
    console.log('ERROS:')
    for (const e of erros) console.log('  -', e)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
