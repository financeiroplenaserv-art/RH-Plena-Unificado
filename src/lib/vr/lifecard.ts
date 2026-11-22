import { parseMoedaParaCentavos } from '@/lib/utils'
import type { Colaborador, Empresa } from '@/types/database'

export interface LinhaLifecard {
  linha: number
  matriculaLifecard: string
  cpf: string
  nome: string
  valorCentavos: number
  compCentavos: number
  segundaViaCentavos: number
}

export interface ErroLifecard {
  linha: number
  nome: string
  motivo: string
}

export interface LinhaLifecardConferida extends LinhaLifecard {
  colaboradorId: string | null
  nomeCorh: string | null
  matricula: string | null
  empresaCodigo: string | null
  empresaNome: string | null
  statusCorh: string | null
  pendencia: string | null
}

export type ColaboradorLifecard = Pick<
  Colaborador,
  'id' | 'nome_completo' | 'cpf' | 'matricula' | 'empresa_id' | 'status'
>

export type EmpresaLifecard = Pick<Empresa, 'id' | 'nome' | 'codigo_alterdata'>

function texto(valor: unknown): string {
  return String(valor ?? '').trim()
}

function normalizarCpf(valor: unknown): string | null {
  const digitos = texto(valor).replace(/\D/g, '')
  if (!digitos || digitos.length > 11) return null
  return digitos.padStart(11, '0')
}

export function parseDemonstrativoLifecard(rows: unknown[][]): {
  linhas: LinhaLifecard[]
  erros: ErroLifecard[]
} {
  const cabecalho = (rows[0] ?? []).map(c => texto(c).toUpperCase())
  const indice = (nome: string) => cabecalho.indexOf(nome)
  const colunas = {
    mat: indice('MAT'),
    cpf: indice('CPF'),
    nome: indice('NOME'),
    comp: indice('COMP'),
    segundaVia: indice('2VIA'),
    desc: indice('DESC'),
  }
  const ausentes = ['CPF', 'NOME', 'DESC'].filter(nome => indice(nome) < 0)
  if (ausentes.length > 0) {
    throw new Error(`Modelo Lifecard não reconhecido: coluna(s) ausente(s): ${ausentes.join(', ')}`)
  }

  const linhas: LinhaLifecard[] = []
  const erros: ErroLifecard[] = []

  rows.slice(1).forEach((row, offset) => {
    const numeroLinha = offset + 2
    if (row.every(c => texto(c) === '')) return
    const nome = texto(row[colunas.nome])
    const cpf = normalizarCpf(row[colunas.cpf])
    const valorCentavos = colunas.desc >= 0 ? parseMoedaParaCentavos(row[colunas.desc] as string | number) : null

    if (!cpf) {
      erros.push({ linha: numeroLinha, nome, motivo: 'CPF ausente ou com mais de 11 dígitos' })
      return
    }
    if (!nome) {
      erros.push({ linha: numeroLinha, nome: '—', motivo: 'Nome ausente' })
      return
    }
    if (valorCentavos === null || valorCentavos <= 0) {
      erros.push({ linha: numeroLinha, nome, motivo: 'Valor DESC ausente ou inválido' })
      return
    }

    linhas.push({
      linha: numeroLinha,
      matriculaLifecard: colunas.mat >= 0 ? texto(row[colunas.mat]) : '',
      cpf,
      nome,
      valorCentavos,
      compCentavos: colunas.comp >= 0 ? parseMoedaParaCentavos(row[colunas.comp] as string | number) ?? 0 : 0,
      segundaViaCentavos: colunas.segundaVia >= 0 ? parseMoedaParaCentavos(row[colunas.segundaVia] as string | number) ?? 0 : 0,
    })
  })

  return { linhas, erros }
}

export function competenciaDoNomeArquivo(nomeArquivo: string): string | null {
  const match = nomeArquivo.match(/(\d{2})\.(\d{2})\.(\d{4})[\s\S]*?(\d{2})\.(\d{2})\.(\d{4})/)
  if (!match) return null
  const mes = Number(match[5])
  const ano = Number(match[6])
  if (mes < 1 || mes > 12) return null
  return `${ano}-${String(mes).padStart(2, '0')}`
}

export function referenciasAlterdataLifecard(competencia: string): { ref1: string; ref2: string } {
  const match = competencia.match(/^(\d{4})-(\d{2})$/)
  if (!match) throw new Error('Informe a competência no formato AAAA-MM')
  const ano = Number(match[1])
  const mes = Number(match[2])
  if (mes < 1 || mes > 12) throw new Error('Competência inválida')
  const mesTexto = String(mes).padStart(2, '0')
  const anoTexto = String(ano).slice(-2)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  return {
    ref1: `01${mesTexto}${anoTexto}`,
    ref2: `${String(ultimoDia).padStart(2, '0')}${mesTexto}${anoTexto}`,
  }
}

export function conciliarLinhasLifecard(
  linhas: LinhaLifecard[],
  colaboradores: ColaboradorLifecard[],
  empresas: EmpresaLifecard[]
): LinhaLifecardConferida[] {
  const porCpf = new Map<string, ColaboradorLifecard[]>()
  colaboradores.forEach(colaborador => {
    const cpf = normalizarCpf(colaborador.cpf)
    if (!cpf) return
    const lista = porCpf.get(cpf) ?? []
    lista.push(colaborador)
    porCpf.set(cpf, lista)
  })
  const empresasPorId = new Map(empresas.map(empresa => [empresa.id, empresa]))
  const quantidadeNoArquivo = new Map<string, number>()
  linhas.forEach(linha => quantidadeNoArquivo.set(linha.cpf, (quantidadeNoArquivo.get(linha.cpf) ?? 0) + 1))

  return linhas.map(linha => {
    const pendencias: string[] = []
    if ((quantidadeNoArquivo.get(linha.cpf) ?? 0) > 1) {
      pendencias.push('CPF aparece mais de uma vez no arquivo')
    }

    const candidatos = porCpf.get(linha.cpf) ?? []
    const ativos = candidatos.filter(c => c.status === 'Ativo')
    const afastados = candidatos.filter(c => c.status === 'Afastado')
    let colaborador: ColaboradorLifecard | undefined
    if (candidatos.length === 1) colaborador = candidatos[0]
    else if (ativos.length === 1) colaborador = ativos[0]
    else if (ativos.length === 0 && afastados.length === 1) colaborador = afastados[0]

    if (candidatos.length === 0) pendencias.push('CPF não encontrado no cadastro do CORH')
    else if (!colaborador) pendencias.push('Mais de um cadastro possível para este CPF; revisar no CORH')

    const empresa = colaborador?.empresa_id ? empresasPorId.get(colaborador.empresa_id) : undefined
    const empresaCodigo = empresa?.codigo_alterdata ?? null
    const matricula = colaborador?.matricula ?? null

    if (colaborador && !matricula?.trim()) pendencias.push('Colaborador sem matrícula no CORH')
    if (matricula && matricula.replace(/\D/g, '').length > 6) pendencias.push('Matrícula do CORH com mais de 6 dígitos')
    if (colaborador && !empresaCodigo?.trim()) pendencias.push('Empresa sem código Alterdata')

    return {
      ...linha,
      colaboradorId: colaborador?.id ?? null,
      nomeCorh: colaborador?.nome_completo ?? null,
      matricula,
      empresaCodigo,
      empresaNome: empresa?.nome ?? null,
      statusCorh: colaborador?.status ?? null,
      pendencia: pendencias.length > 0 ? pendencias.join('; ') : null,
    }
  })
}

export interface ResultadoTxtLifecard {
  conteudo: string
  gerados: number
  pulados: { nome: string; motivo: string }[]
}

export function gerarTxtLifecard(
  linhas: LinhaLifecardConferida[],
  competencia: string
): ResultadoTxtLifecard {
  const { ref1, ref2 } = referenciasAlterdataLifecard(competencia)
  const saida: string[] = []
  const pulados: { nome: string; motivo: string }[] = []
  let sequencial = 1

  for (const linha of linhas) {
    const nome = linha.nomeCorh ?? linha.nome
    if (linha.pendencia) {
      pulados.push({ nome, motivo: linha.pendencia })
      continue
    }

    const matriculaDigitos = (linha.matricula ?? '').replace(/\D/g, '')
    const empresaDigitos = (linha.empresaCodigo ?? '').replace(/\D/g, '')
    const valorTexto = String(linha.valorCentavos)
    if (!matriculaDigitos || matriculaDigitos.length > 6) {
      pulados.push({ nome, motivo: 'matrícula ausente ou com mais de 6 dígitos' })
      continue
    }
    if (!empresaDigitos || empresaDigitos.length > 5) {
      pulados.push({ nome, motivo: 'empresa sem código Alterdata válido' })
      continue
    }
    if (linha.valorCentavos <= 0 || valorTexto.length > 14) {
      pulados.push({ nome, motivo: 'valor de desconto inválido' })
      continue
    }

    let registro = ''
    registro += String(sequencial).padStart(6, '0')
    registro += empresaDigitos.padStart(5, '0')
    registro += ref1
    registro += ref2
    registro += '000000'
    registro += '000000'
    registro += '00'
    registro += '664'
    registro += valorTexto.padStart(14, '0')
    registro += matriculaDigitos.padStart(6, '0')
    registro += 'F'

    if (registro.length !== 61) {
      throw new Error(`Linha Alterdata ${sequencial}: ${registro.length} posições, esperado 61`)
    }
    saida.push(registro)
    sequencial++
  }

  return { conteudo: saida.join('\r\n'), gerados: saida.length, pulados }
}
