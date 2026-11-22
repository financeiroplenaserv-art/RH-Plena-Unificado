// Importação dos relatórios do Alterdata de optantes do Vale-Transporte
// (aba VT → Importações do mês). Dois PDFs:
//  - "desconta VT": tabela com quem recebe VT (vira vt_optante = true);
//  - "Declaração de Não Beneficiário": uma página por pessoa que NÃO quer VT
//    (vira vt_optante = false).
// Casamento SOMENTE por CPF exato (11 dígitos) e, se o relatório não trouxer
// CPF, por matrícula exata normalizada — nunca por nome (regra "importação
// nunca grava palpite", AGENTS.md §11). Lógica pura: sem acesso a banco.

import type { PaginaPDF } from '@/lib/ocorrencias/importacaoPonto'

export type TipoRelatorioAlterdata = 'desconta' | 'nao_beneficiario'

export interface RegistroAlterdata {
  empresa: string
  matricula: string | null
  nome: string
  cpf: string | null
}

export interface RelatorioAlterdata {
  tipo: TipoRelatorioAlterdata | null
  registros: RegistroAlterdata[]
}

/** Só dígitos, completado com zeros à esquerda (o CORH tem CPF sem o zero inicial). */
export function cpf11(valor: unknown): string | null {
  const d = String(valor ?? '').replace(/\D/g, '')
  if (!d || d.length > 11) return null
  const c = d.padStart(11, '0')
  return c === '00000000000' ? null : c
}

/** Matrícula comparável: sem pontuação, sem zeros à esquerda, maiúscula. */
export function matriculaNormalizada(valor: unknown): string | null {
  const m = String(valor ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase().replace(/^0+/, '')
  return m || null
}

function rotuloEmpresa(razao: string): string {
  const t = ` ${razao.toUpperCase()} `
  if (t.includes(' TECH')) return 'TECH'
  if (t.includes(' EA ')) return 'EA'
  return razao.trim()
}

// ----- Relatório "desconta VT" (tabela) -----

function lerTabelaDesconta(paginas: PaginaPDF[]): RegistroAlterdata[] {
  const registros: RegistroAlterdata[] = []
  let cols: { cpf: number; nome: number; matricula: number; razao: number } | null = null

  for (const pag of paginas) {
    const achar = (t: string) => pag.itens.find((i) => i.texto.trim().toUpperCase() === t)
    const hCpf = achar('CPF')
    const hNome = achar('NOME')
    const hMat = achar('MATRICULA')
    const hRazao = achar('RAZAO SOCIAL')
    let yCab = Infinity
    if (hCpf && hNome && hMat && hRazao) {
      cols = { cpf: hCpf.x, nome: hNome.x, matricula: hMat.x, razao: hRazao.x }
      yCab = hCpf.y
    }
    if (!cols) continue
    const c = cols
    const perto = (x: number, alvo: number) => Math.abs(x - alvo) <= 12

    const ancoras = pag.itens.filter(
      (i) => perto(i.x, c.cpf) && /^\d{3,11}$/.test(i.texto.trim()) && i.y < yCab - 2,
    )
    for (const a of ancoras) {
      const linha = pag.itens.filter((i) => Math.abs(i.y - a.y) <= 4)
      const em = (alvo: number) =>
        linha
          .filter((i) => perto(i.x, alvo))
          .sort((p, q) => p.x - q.x)
          .map((i) => i.texto.trim())
          .join(' ')
          .trim()
      const nome = em(c.nome)
      if (!nome) continue
      registros.push({
        empresa: rotuloEmpresa(em(c.razao)),
        matricula: em(c.matricula) || null,
        nome,
        cpf: cpf11(a.texto),
      })
    }
  }
  return registros
}

// ----- Declaração de Não Beneficiário (1 página por pessoa) -----

function lerDeclaracoes(paginas: PaginaPDF[]): RegistroAlterdata[] {
  const registros: RegistroAlterdata[] = []
  for (const pag of paginas) {
    const itens = pag.itens
    const func = itens.find((i) => /^Funcion[aá]rio:/i.test(i.texto.trim()))
    if (!func) continue
    const nome = func.texto.replace(/^Funcion[aá]rio:\s*/i, '').trim()
    const empresaItem = itens.find((i) => /^Empresa:/i.test(i.texto.trim()))
    const empresa = rotuloEmpresa(empresaItem ? empresaItem.texto.replace(/^Empresa:\s*/i, '') : '')
    let cpf: string | null = null
    for (const i of itens) {
      const m = i.texto.match(/C\.?P\.?F\.?:\s*(\d[\d.-]*)/i)
      if (m) {
        cpf = cpf11(m[1])
        break
      }
    }
    // A matrícula aparece entre parênteses na mesma linha do "Funcionário:".
    const mat = itens.find(
      (i) => Math.abs(i.y - func.y) <= 3 && i.x > func.x + 100 && /^\d{3,}$/.test(i.texto.trim()),
    )
    if (!nome) continue
    registros.push({ empresa, matricula: mat ? mat.texto.trim() : null, nome, cpf })
  }
  return registros
}

/** Descobre o tipo do relatório pelo conteúdo e extrai os registros. */
export function extrairRelatorioAlterdata(paginas: PaginaPDF[]): RelatorioAlterdata {
  const todos = paginas.flatMap((p) => p.itens.map((i) => i.texto))
  if (todos.some((t) => /N[aã]o Benefici[aá]rio/i.test(t))) {
    return { tipo: 'nao_beneficiario', registros: lerDeclaracoes(paginas) }
  }
  const upper = todos.map((t) => t.trim().toUpperCase())
  if (upper.includes('RAZAO SOCIAL') && upper.includes('CPF')) {
    return { tipo: 'desconta', registros: lerTabelaDesconta(paginas) }
  }
  return { tipo: null, registros: [] }
}

// ----- Prévia (cruzamento com o cadastro do CORH) -----

export interface ColaboradorOptante {
  id: string
  nome_completo: string
  cpf: string | null
  matricula: string | null
  status: string
  vt_optante: boolean | null
}

export interface MudancaOptante {
  colaborador: ColaboradorOptante
  registro: RegistroAlterdata
  para: boolean
  casadoPor: 'cpf' | 'matricula'
}

export interface SemCasamento {
  registro: RegistroAlterdata
  motivo: string
}

export interface PreviaOptantes {
  virarOptante: MudancaOptante[]
  deixarDeSerOptante: MudancaOptante[]
  semMudanca: MudancaOptante[]
  conflitos: {
    colaborador: ColaboradorOptante
    descontaRegistro: RegistroAlterdata
    naoBeneficiarioRegistro: RegistroAlterdata
  }[]
  naoEncontradosDesconta: SemCasamento[]
  naoEncontradosNaoBeneficiario: SemCasamento[]
  foraDosRelatorios: ColaboradorOptante[]
}

type Casamento = { colaborador: ColaboradorOptante; por: 'cpf' | 'matricula' } | { erro: string }

export function criarCasador(colaboradores: ColaboradorOptante[]) {
  const porCpf = new Map<string, ColaboradorOptante[]>()
  const porMat = new Map<string, ColaboradorOptante[]>()
  for (const c of colaboradores) {
    const k = cpf11(c.cpf)
    if (k) porCpf.set(k, [...(porCpf.get(k) ?? []), c])
    const m = matriculaNormalizada(c.matricula)
    if (m) porMat.set(m, [...(porMat.get(m) ?? []), c])
  }
  return (r: RegistroAlterdata): Casamento => {
    if (r.cpf) {
      const lista = porCpf.get(r.cpf) ?? []
      if (lista.length === 1) return { colaborador: lista[0], por: 'cpf' }
      if (lista.length > 1) return { erro: 'CPF repetido em mais de um cadastro ativo do CORH' }
      return { erro: 'CPF não encontrado entre os cadastros ativos/afastados do CORH' }
    }
    const m = matriculaNormalizada(r.matricula)
    if (!m) return { erro: 'Sem CPF nem matrícula no relatório' }
    const lista = porMat.get(m) ?? []
    if (lista.length === 1) return { colaborador: lista[0], por: 'matricula' }
    if (lista.length > 1) return { erro: 'Matrícula repetida no CORH' }
    return { erro: 'Matrícula não encontrada entre os cadastros ativos/afastados do CORH' }
  }
}

type Achado = { colaborador: ColaboradorOptante; registro: RegistroAlterdata; por: 'cpf' | 'matricula' }

export function calcularPreviaOptantes(
  desconta: RegistroAlterdata[],
  naoBeneficiarios: RegistroAlterdata[],
  colaboradores: ColaboradorOptante[],
): PreviaOptantes {
  const casar = criarCasador(colaboradores)
  const previa: PreviaOptantes = {
    virarOptante: [],
    deixarDeSerOptante: [],
    semMudanca: [],
    conflitos: [],
    naoEncontradosDesconta: [],
    naoEncontradosNaoBeneficiario: [],
    foraDosRelatorios: [],
  }

  const noDesconta = new Map<string, Achado>()
  for (const r of desconta) {
    const c = casar(r)
    if ('erro' in c) previa.naoEncontradosDesconta.push({ registro: r, motivo: c.erro })
    else if (!noDesconta.has(c.colaborador.id)) noDesconta.set(c.colaborador.id, { colaborador: c.colaborador, registro: r, por: c.por })
  }
  const noNao = new Map<string, Achado>()
  for (const r of naoBeneficiarios) {
    const c = casar(r)
    if ('erro' in c) previa.naoEncontradosNaoBeneficiario.push({ registro: r, motivo: c.erro })
    else if (!noNao.has(c.colaborador.id)) noNao.set(c.colaborador.id, { colaborador: c.colaborador, registro: r, por: c.por })
  }

  for (const [id, d] of noDesconta) {
    const n = noNao.get(id)
    if (n) {
      previa.conflitos.push({ colaborador: d.colaborador, descontaRegistro: d.registro, naoBeneficiarioRegistro: n.registro })
      continue
    }
    const m: MudancaOptante = { colaborador: d.colaborador, registro: d.registro, para: true, casadoPor: d.por }
    if (d.colaborador.vt_optante === true) previa.semMudanca.push(m)
    else previa.virarOptante.push(m)
  }
  for (const [id, n] of noNao) {
    if (noDesconta.has(id)) continue
    const m: MudancaOptante = { colaborador: n.colaborador, registro: n.registro, para: false, casadoPor: n.por }
    if (n.colaborador.vt_optante === false) previa.semMudanca.push(m)
    else previa.deixarDeSerOptante.push(m)
  }
  for (const c of colaboradores) {
    if (!noDesconta.has(c.id) && !noNao.has(c.id)) previa.foraDosRelatorios.push(c)
  }
  const porNome = (a: { colaborador: ColaboradorOptante }, b: { colaborador: ColaboradorOptante }) =>
    a.colaborador.nome_completo.localeCompare(b.colaborador.nome_completo, 'pt-BR')
  previa.virarOptante.sort(porNome)
  previa.deixarDeSerOptante.sort(porNome)
  previa.semMudanca.sort(porNome)
  previa.foraDosRelatorios.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'))
  return previa
}
