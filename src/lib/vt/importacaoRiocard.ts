// Importação do PDF da Riocard "Cadastro de Funcionários da Empresa"
// (impressão de ImprimirPesquisaUsuarios.do) → situação do Bilhete Único no
// cadastro (colaboradores.vt_bu_*). Lógica pura, sem banco.
//
// Regras: casamento só por CPF de 11 dígitos; entre linhas repetidas do mesmo
// CPF vale o cadastro ATIVO na Riocard; no CORH só entram cadastros ATIVOS ou
// AFASTADOS. Dois ativos do mesmo CPF (ex.: nas duas contas) viram conflito —
// nunca se escolhe um por palpite.

import type { PaginaPDF } from '@/lib/ocorrencias/importacaoPonto'
import { cpf11 } from '@/lib/vt/importacaoAlterdata'

export interface LinhaRiocard {
  matricula: string
  nome: string
  cpf: string | null
  status: string // Ativo | Inativo
  cartao: string
  situacao: string // texto do site, já normalizado
  compra: string
  /** Rótulo da conta (empresa do cabeçalho do arquivo). */
  conta: string
}

export interface RelatorioRiocard {
  empresa: string
  cnpj: string
  emitidoEm: string | null // AAAA-MM-DD
  linhas: LinhaRiocard[]
}

const SITUACOES_CONHECIDAS = ['Ativado', 'Suspenso Setrans', 'Não possui BU', 'Desativado', 'Ativação Solicitada']

export function normalizarSituacaoBU(bruto: string): string {
  const t = bruto.replace(/\s+/g, ' ').trim()
  if (/^Solicitada Ativa/i.test(t)) return 'Ativação Solicitada'
  return t
}

export function situacaoBUConhecida(s: string): boolean {
  return SITUACOES_CONHECIDAS.includes(s)
}

export function extrairRiocard(paginas: PaginaPDF[]): RelatorioRiocard {
  let empresa = ''
  let cnpj = ''
  let emitidoEm: string | null = null
  const linhas: LinhaRiocard[] = []

  for (const pag of paginas) {
    const itens = pag.itens.filter((i) => i.texto.trim() !== '')
    for (const i of itens) {
      const mc = i.texto.match(/^CNPJ\s+([\d./-]+)/)
      if (mc && !cnpj) {
        cnpj = mc[1]
        const acima = itens.filter((o) => o.y > i.y && o.y - i.y < 30 && o.texto.trim() !== '-' && !/^CNPJ/.test(o.texto))
        const nome = acima.sort((a, b) => b.texto.length - a.texto.length)[0]
        if (nome) empresa = nome.texto.trim()
      }
      const me = i.texto.match(/Emitido em (\d{2})\/(\d{2})\/(\d{4})/)
      if (me && !emitidoEm) emitidoEm = `${me[3]}-${me[2]}-${me[1]}`
    }
  }
  const conta = empresa || 'Riocard'

  for (const pag of paginas) {
    const itens = pag.itens.filter((i) => i.texto.trim() !== '')
    const ancoras = itens.filter((i) => i.x < 80 && /^\d+[A-Z]?$/.test(i.texto.trim()))
    if (ancoras.length === 0) continue
    // Cada item pertence à linha-âncora mais próxima em y (até 12 de distância).
    const grupos = new Map<number, typeof itens>()
    ancoras.forEach((_, idx) => grupos.set(idx, []))
    for (const i of itens) {
      if (i.x < 80) continue
      let melhor = -1
      let dist = Infinity
      ancoras.forEach((a, idx) => {
        const d = Math.abs(a.y - i.y)
        if (d < dist) {
          dist = d
          melhor = idx
        }
      })
      if (melhor >= 0 && dist <= 12) grupos.get(melhor)!.push(i)
    }
    ancoras.forEach((a, idx) => {
      const g = grupos.get(idx) ?? []
      const col = (min: number, max: number) =>
        g.filter((i) => i.x >= min && i.x < max).sort((p, q) => q.y - p.y || p.x - q.x)
      const nome = col(80, 285).map((i) => i.texto.trim()).join(' ')
      const cpfTxt = col(285, 350).map((i) => i.texto.trim()).join('')
      const status = col(350, 380).map((i) => i.texto.trim()).join(' ')
      const cartao = col(380, 445).map((i) => i.texto.trim()).join('')
      const bu = normalizarSituacaoBU(col(445, 500).map((i) => i.texto.trim()).join(' '))
      const compra = col(500, 9999).map((i) => i.texto.trim()).join(' ')
      if (!nome && !status) return
      linhas.push({
        matricula: a.texto.trim(),
        nome,
        cpf: cpf11(cpfTxt),
        status,
        cartao,
        situacao: bu,
        compra,
        conta,
      })
    })
  }
  return { empresa, cnpj, emitidoEm, linhas }
}

// ----- Prévia -----

export interface ColaboradorRiocard {
  id: string
  nome_completo: string
  cpf: string | null
  status: string
  vt_optante: boolean | null
  vt_bu_ativado: boolean | null
  vt_bu_situacao: string | null
  vt_bu_consultado_em: string | null
  vt_riocard_numero_cartao: string | null
}

export interface MudancaBU {
  colaborador: ColaboradorRiocard
  linha: LinhaRiocard
  depois: {
    vt_bu_ativado: boolean
    vt_bu_situacao: string
    vt_bu_consultado_em: string
    vt_riocard_numero_cartao: string | null
  }
  /** true quando a situação mudou; false quando só a data de consulta/cartão. */
  mudouSituacao: boolean
}

export interface PreviaRiocard {
  mudancas: MudancaBU[]
  /** Casados cuja situação não mudou (a gravação só atualiza data/cartão). */
  semMudancaSituacao: MudancaBU[]
  semCadastroAtivoNoCorh: LinhaRiocard[]
  optantesSemCadastroNaRiocard: ColaboradorRiocard[]
  ativosNaRiocardNaoOptantes: { colaborador: ColaboradorRiocard; linha: LinhaRiocard }[]
  soInativoNaRiocard: { colaborador: ColaboradorRiocard; linha: LinhaRiocard }[]
  conflitosAtivoDuplicado: LinhaRiocard[]
  semCpf: LinhaRiocard[]
  situacoesDesconhecidas: LinhaRiocard[]
}

export function calcularPreviaRiocard(
  linhas: LinhaRiocard[],
  colaboradores: ColaboradorRiocard[],
  dataConsulta: string,
): PreviaRiocard {
  const previa: PreviaRiocard = {
    mudancas: [],
    semMudancaSituacao: [],
    semCadastroAtivoNoCorh: [],
    optantesSemCadastroNaRiocard: [],
    ativosNaRiocardNaoOptantes: [],
    soInativoNaRiocard: [],
    conflitosAtivoDuplicado: [],
    semCpf: [],
    situacoesDesconhecidas: [],
  }

  const porCpfCorh = new Map<string, ColaboradorRiocard[]>()
  for (const c of colaboradores) {
    const k = cpf11(c.cpf)
    if (k) porCpfCorh.set(k, [...(porCpfCorh.get(k) ?? []), c])
  }

  const porCpfRio = new Map<string, LinhaRiocard[]>()
  for (const l of linhas) {
    if (!l.cpf) {
      if (/^ativo$/i.test(l.status)) previa.semCpf.push(l)
      continue
    }
    porCpfRio.set(l.cpf, [...(porCpfRio.get(l.cpf) ?? []), l])
  }

  const cpfsComAtivoNaRiocard = new Set<string>()
  for (const [cpf, lista] of porCpfRio) {
    const ativos = lista.filter((l) => /^ativo$/i.test(l.status))
    const colab = porCpfCorh.get(cpf) ?? []
    if (ativos.length === 0) {
      if (colab.length === 1) previa.soInativoNaRiocard.push({ colaborador: colab[0], linha: lista[0] })
      continue
    }
    cpfsComAtivoNaRiocard.add(cpf)
    if (ativos.length > 1) {
      previa.conflitosAtivoDuplicado.push(...ativos)
      continue
    }
    const linha = ativos[0]
    if (!situacaoBUConhecida(linha.situacao)) {
      previa.situacoesDesconhecidas.push(linha)
      continue
    }
    if (colab.length !== 1) {
      // 0 = sem cadastro ativo no CORH; >1 = CPF repetido no CORH (não chuta).
      previa.semCadastroAtivoNoCorh.push(linha)
      continue
    }
    const c = colab[0]
    if (!c.vt_optante) previa.ativosNaRiocardNaoOptantes.push({ colaborador: c, linha })
    const depois = {
      vt_bu_ativado: linha.situacao === 'Ativado',
      vt_bu_situacao: linha.situacao,
      vt_bu_consultado_em: dataConsulta,
      vt_riocard_numero_cartao: linha.cartao || c.vt_riocard_numero_cartao,
    }
    const mudouSituacao = c.vt_bu_ativado !== depois.vt_bu_ativado || c.vt_bu_situacao !== depois.vt_bu_situacao
    const mudouAlgo =
      mudouSituacao ||
      c.vt_bu_consultado_em !== depois.vt_bu_consultado_em ||
      (c.vt_riocard_numero_cartao ?? null) !== (depois.vt_riocard_numero_cartao ?? null)
    const m: MudancaBU = { colaborador: c, linha, depois, mudouSituacao }
    if (mudouSituacao) previa.mudancas.push(m)
    else if (mudouAlgo) previa.semMudancaSituacao.push(m)
  }

  for (const c of colaboradores) {
    const k = cpf11(c.cpf)
    if (c.vt_optante && (!k || !cpfsComAtivoNaRiocard.has(k))) previa.optantesSemCadastroNaRiocard.push(c)
  }
  const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR')
  previa.mudancas.sort((a, b) => porNome(a.colaborador.nome_completo, b.colaborador.nome_completo))
  previa.semMudancaSituacao.sort((a, b) => porNome(a.colaborador.nome_completo, b.colaborador.nome_completo))
  previa.semCadastroAtivoNoCorh.sort((a, b) => porNome(a.nome, b.nome))
  previa.optantesSemCadastroNaRiocard.sort((a, b) => porNome(a.nome_completo, b.nome_completo))
  previa.ativosNaRiocardNaoOptantes.sort((a, b) => porNome(a.colaborador.nome_completo, b.colaborador.nome_completo))
  return previa
}
