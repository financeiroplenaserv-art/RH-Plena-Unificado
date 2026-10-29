// Cruza a lista da Riocard (quem tem Bilhete Único ativado) com o cadastro do
// CORH. Fatos: BU habilitado Sim/Não é a fonte oficial; o CORH tem o tipo de
// cartão que a operação acredita que a pessoa tem. Saída: console + revisao.xlsx
// em dados-locais/riocard_2026-10-28/. SÓ LEITURA — nada é gravado no banco.
import { readFileSync, writeFileSync } from 'node:fs'
import * as XLSX from '@e965/xlsx'

const PASTA = 'dados-locais/riocard_2026-10-28'

interface Colab {
  id: string
  nome_completo: string
  cpf: string | null
  status: string
  vt_optante: boolean | null
  vt_tipo_cartao: string | null
}

// O banco perdeu o zero à esquerda em parte dos CPFs (importação antiga) —
// normaliza SEMPRE para 11 dígitos dos dois lados.
const cpf11 = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '').padStart(11, '0')

const colaboradores = JSON.parse(readFileSync(`${PASTA}/colaboradores.json`, 'utf-8')) as Colab[]
const porCpf = new Map<string, Colab>()
for (const c of colaboradores) {
  const cpf = cpf11(c.cpf)
  if (cpf !== '00000000000') porCpf.set(cpf, c)
}

const wb = XLSX.read(readFileSync('dados-locais/Bilhete_Unico_Riocard.xlsx'))
const linhas = XLSX.utils.sheet_to_json(wb.Sheets['Cartões'], { header: 1, defval: '' }) as unknown[][]
const corpo = linhas.slice(1).filter((l) => String(l[2] ?? '').trim())

interface Cruzamento {
  matricula: string
  nomeRiocard: string
  cpf: string
  cartaoNro: string
  situacaoRiocard: string
  buHabilitado: boolean
  colabId: string | null
  nomeCorh: string | null
  statusCorh: string | null
  optante: boolean | null
  cartaoCorh: string | null
  classe: string
}

const rotuloCorh = (t: string | null) =>
  t === 'bun' ? 'BUN' : t === 'bui' ? 'BUI' : t === 'jae' ? 'JAE' : t === 'comum' ? 'Sem cartão' : 'não informado'

const cruzamentos: Cruzamento[] = []
const idsCasados = new Set<string>()
for (const l of corpo) {
  const cpf = cpf11(String(l[2]))
  const c = porCpf.get(cpf)
  if (c) idsCasados.add(c.id)
  const bu = String(l[5]).trim().toLowerCase() === 'sim'
  let classe: string
  if (!c) classe = 'fora_do_corh'
  else if (bu && c.vt_tipo_cartao === 'bui') classe = 'ok_bui'
  else if (bu) classe = 'bu_ativado_mas_corh_outro'
  else if (!bu && c.vt_tipo_cartao === 'bui') classe = 'CRITICO_bui_sem_bu_ativado'
  else classe = 'ok_sem_bui'
  cruzamentos.push({
    matricula: String(l[0]),
    nomeRiocard: String(l[1]),
    cpf: String(l[2]),
    cartaoNro: String(l[3]),
    situacaoRiocard: String(l[4]),
    buHabilitado: bu,
    colabId: c?.id ?? null,
    nomeCorh: c?.nome_completo ?? null,
    statusCorh: c?.status ?? null,
    optante: c?.vt_optante ?? null,
    cartaoCorh: c ? rotuloCorh(c.vt_tipo_cartao) : null,
    classe,
  })
}

const optantesFora = colaboradores.filter((c) => c.vt_optante && !idsCasados.has(c.id))

const contar = (cl: string) => cruzamentos.filter((x) => x.classe === cl).length
console.log('Total na Riocard:', cruzamentos.length)
console.log('Casados no CORH por CPF:', idsCasados.size)
console.log('OK (BUI e BU ativado):', contar('ok_bui'))
console.log('OK (sem BUI e BU não habilitado):', contar('ok_sem_bui'))
console.log('BU ativado mas CORH diz outro cartão:', contar('bu_ativado_mas_corh_outro'))
console.log('CRÍTICO (cadastro diz BUI mas BU NÃO habilitado):', contar('CRITICO_bui_sem_bu_ativado'))
console.log('Na Riocard sem cadastro ativo/afastado no CORH:', contar('fora_do_corh'))
console.log('Optantes do CORH FORA da lista Riocard:', optantesFora.length)
console.log()
for (const x of cruzamentos.filter((x) => x.classe === 'CRITICO_bui_sem_bu_ativado')) {
  console.log('CRÍTICO:', x.nomeCorh, '|', x.situacaoRiocard, '| optante:', x.optante)
}
console.log()
console.log('Optantes fora da lista Riocard:')
for (const c of optantesFora) console.log('-', c.nome_completo, '| cartão CORH:', rotuloCorh(c.vt_tipo_cartao))

const saida = cruzamentos.map((x) => ({
  'Matrícula': x.matricula,
  'Nome (Riocard)': x.nomeRiocard,
  CPF: x.cpf,
  'Nº do Cartão': x.cartaoNro,
  'Situação do BU (site)': x.situacaoRiocard,
  'BU habilitado?': x.buHabilitado ? 'Sim' : 'Não',
  'Nome (CORH)': x.nomeCorh ?? '— sem cadastro —',
  'Status CORH': x.statusCorh ?? '',
  Optante: x.optante === null ? '' : x.optante ? 'Sim' : 'Não',
  'Cartão no CORH': x.cartaoCorh ?? '',
  Classe: x.classe,
}))
const wbOut = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbOut, XLSX.utils.json_to_sheet(saida), 'Cruzamento')
XLSX.utils.book_append_sheet(
  wbOut,
  XLSX.utils.json_to_sheet(
    optantesFora.map((c) => ({
      Nome: c.nome_completo,
      CPF: c.cpf,
      Status: c.status,
      'Cartão no CORH': rotuloCorh(c.vt_tipo_cartao),
    }))
  ),
  'Optantes fora da Riocard'
)
writeFileSync(`${PASTA}/revisao_riocard.xlsx`, XLSX.write(wbOut, { type: 'buffer', bookType: 'xlsx' }))
console.log('\nPlanilha de revisão:', `${PASTA}/revisao_riocard.xlsx`)
