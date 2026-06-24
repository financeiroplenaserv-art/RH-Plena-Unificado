import type { VRColaboradorPonto, VRColaboradorEscala, VRResultadoCalculo, VRConfiguracao } from '@/types'
import { contarAbatimentos, contarDiasPdf6h } from './pdfParser'


/**
 * LAYOUT VR PAT - OFICIAL
 * Baseado na analise byte-a-byte dos arquivos VRFornecedor_*.TXT
 * Cada linha: exatamente 350 posicoes (caracteres ISO-8859-1)
 */

export function calcularVR(
  pdfAnterior: Map<string, VRColaboradorPonto>,
  pdfAtual: Map<string, VRColaboradorPonto>,
  escala: VRColaboradorEscala[],
  config: VRConfiguracao,
  cpfsPorNome?: Map<string, string>,
  matriculasPorCpf?: Map<string, string>,
  matriculasPorNome?: Map<string, string>
): VRResultadoCalculo[] {

  const escalaPorNome = new Map<string, VRColaboradorEscala>()
  for (const e of escala) {
    escalaPorNome.set(normalizarNome(e.colaborador.nome), e)
  }

  const resultados: VRResultadoCalculo[] = []
  const processados = new Set<string>()

  for (const [nomePdfKey, pontoAtual] of pdfAtual) {
    const nomePdf = pontoAtual.colaborador.nome
    const nomePdfNorm = normalizarNome(nomePdf)

    let escalaColab = escalaPorNome.get(nomePdfNorm)
    if (!escalaColab) {
      for (const [nomeEscNorm, esc] of escalaPorNome) {
        if (nomeEscNorm.startsWith(nomePdfNorm.substring(0, 25)) ||
            nomePdfNorm.startsWith(nomeEscNorm.substring(0, 25))) {
          escalaColab = esc
          break
        }
      }
    }
    // Matching por primeiras 2 palavras (primeiro nome + segundo nome)
    if (!escalaColab) {
      const palavrasPdf = nomePdfNorm.split(' ').filter(p => p.length >= 3)
      if (palavrasPdf.length >= 1) {
        for (const [nomeEscNorm, esc] of escalaPorNome) {
          const palavrasEsc = nomeEscNorm.split(' ').filter(p => p.length >= 3)
          if (palavrasPdf[0] === palavrasEsc[0]) {
            if (palavrasPdf.length === 1 || palavrasEsc.length === 1 ||
                palavrasPdf[1] === palavrasEsc[1]) {
              escalaColab = esc
              break
            }
          }
        }
      }
    }

    const nomeChave = escalaColab ? normalizarNome(escalaColab.colaborador.nome) : nomePdfNorm
    processados.add(nomeChave)

    let pontoAnt: VRColaboradorPonto | undefined
    pontoAnt = pdfAnterior.get(nomePdfKey)
    if (!pontoAnt) {
      pontoAnt = pdfAnterior.get(nomePdfNorm)
    }
    if (!pontoAnt && escalaColab) {
      pontoAnt = pdfAnterior.get(normalizarNome(escalaColab.colaborador.nome))
    }

    const diasPdf = contarDiasPdf6h(pontoAtual)
    const diasEscala = escalaColab
      ? escalaColab.dias.filter(d => d.tipo === 'T' && d.minutosTrabalhados > 360).length
      : 0
    const diasAbatimento = contarAbatimentos(pontoAnt)
    const diasElegiveis = Math.max(0, diasPdf + diasEscala - diasAbatimento)

    const nomeFinal = escalaColab?.colaborador.nome || nomePdf
    let cpfFinal = escalaColab?.colaborador.cpf || pontoAtual.colaborador.cpf
    let matriculaFinal = escalaColab?.colaborador.matricula || ''

    // Buscar CPF se nao encontrado
    if (!cpfFinal || cpfFinal.replace(/\D/g, '').length !== 11) {
      cpfFinal = buscarCPFPorNome(nomeFinal, pdfAnterior, pdfAtual, cpfsPorNome)
    }

    // Buscar matricula no arquivo de dados de nascimento se nao tiver na escala
    if (!matriculaFinal && cpfFinal && cpfFinal.replace(/\D/g, '').length === 11) {
      const cpfLimpo = cpfFinal.replace(/\D/g, '')
      matriculaFinal = matriculasPorCpf?.get(cpfLimpo) || ''
    }
    if (!matriculaFinal && nomeFinal) {
      matriculaFinal = matriculasPorNome?.get(nomeFinal) || ''
    }

    resultados.push({
      cpf: cpfFinal,
      nome: nomeFinal,
      matricula: matriculaFinal,
      diasElegiveis,
      diasPdf,
      diasEscala,
      diasAbatimento,
      valorBruto: diasElegiveis * config.valorVR,
      detalhes: [
        `DIAS TRABALHADOS MES ATUAL: ${diasPdf}`,
        `DIAS A TRABALHAR MES ATUAL: ${diasEscala}`,
        `DIAS TRABALHADOS MES PASSADO PARA DESCONTAR FALTAS: ${diasAbatimento}`,
        `CALCULO: ${diasPdf} + ${diasEscala} - ${diasAbatimento} = ${diasElegiveis}`
      ]
    })
  }

  for (const [nomeNormEsc, escalaColab] of escalaPorNome) {
    if (processados.has(nomeNormEsc)) continue

    const pontoAnt = pdfAnterior.get(nomeNormEsc)
      || pdfAnterior.get(normalizarNome(escalaColab.colaborador.nome))
    const diasAbatimento = contarAbatimentos(pontoAnt)
    const diasEscala = escalaColab.dias.filter(d => d.tipo === 'T' && d.minutosTrabalhados > 360).length
    const diasElegiveis = Math.max(0, diasEscala - diasAbatimento)

    let cpfFinal = escalaColab.colaborador.cpf || ''
    let matriculaFinal = escalaColab.colaborador.matricula || ''
    if (!cpfFinal || cpfFinal.replace(/\D/g, '').length !== 11) {
      cpfFinal = buscarCPFPorNome(escalaColab.colaborador.nome, pdfAnterior, pdfAtual, cpfsPorNome)
    }

    // Buscar matricula no arquivo de dados de nascimento se nao tiver na escala
    if (!matriculaFinal && cpfFinal && cpfFinal.replace(/\D/g, '').length === 11) {
      const cpfLimpo = cpfFinal.replace(/\D/g, '')
      matriculaFinal = matriculasPorCpf?.get(cpfLimpo) || ''
    }
    if (!matriculaFinal) {
      matriculaFinal = matriculasPorNome?.get(escalaColab.colaborador.nome) || ''
    }

    resultados.push({
      cpf: cpfFinal,
      nome: escalaColab.colaborador.nome,
      matricula: matriculaFinal,
      diasElegiveis,
      diasPdf: 0,
      diasEscala,
      diasAbatimento,
      valorBruto: diasElegiveis * config.valorVR,
      detalhes: [
        `DIAS TRABALHADOS MES ATUAL: 0`,
        `DIAS A TRABALHAR MES ATUAL: ${diasEscala}`,
        `DIAS TRABALHADOS MES PASSADO PARA DESCONTAR FALTAS: ${diasAbatimento}`,
        `CALCULO: 0 + ${diasEscala} - ${diasAbatimento} = ${diasElegiveis}`
      ]
    })
  }

  return resultados.sort((a, b) => a.nome.localeCompare(b.nome))
}

function buscarCPFPorNome(
  nomeAlvo: string,
  pdfAnterior: Map<string, VRColaboradorPonto>,
  pdfAtual: Map<string, VRColaboradorPonto>,
  cpfsPorNome?: Map<string, string>
): string {
  const normAlvo = normalizarNome(nomeAlvo)

  if (cpfsPorNome) {
    for (const [nomeNasc, cpf] of cpfsPorNome) {
      const nomeNascNorm = normalizarNome(nomeNasc)
      if (nomeNascNorm.startsWith(normAlvo.substring(0, 15)) ||
          normAlvo.startsWith(nomeNascNorm.substring(0, 15))) {
        if (cpf && cpf.replace(/\D/g, '').length === 11) {
          return cpf
        }
      }
    }
  }

  for (const mapa of [pdfAtual, pdfAnterior]) {
    for (const [, ponto] of mapa) {
      const nomeNorm = normalizarNome(ponto.colaborador.nome)
      if (nomeNorm.startsWith(normAlvo.substring(0, 15)) ||
          normAlvo.startsWith(nomeNorm.substring(0, 15))) {
        const cpf = ponto.colaborador.cpf
        if (cpf && cpf.replace(/\D/g, '').length === 11) {
          return cpf
        }
      }
    }
  }
  return ''
}

// ============================================================
// FUNCOES DE FORMATACAO - EXATAMENTE COMO OS ARQUIVOS REAIS
// ============================================================

/**
 * Campo alfanumerico: alinhado a ESQUERDA, preenche com espacos a direita,
 * trunca se necessario. Preserva caracteres ISO-8859-1 (Ç, Õ, Á, etc.)
 */
function campoAlfa(texto: string | number | undefined, tamanho: number): string {
  let s = String(texto || '')
  // Remove acentos combinatorios Unicode (ex: 'a' + '´' → 'a')
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Remove caracteres de controle (exceto espaco tab e quebra de linha)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, '')
  if (s.length > tamanho) return s.substring(0, tamanho)
  return s.padEnd(tamanho, ' ')
}

/**
 * Campo alfanumerico alinhado a DIREITA com espacos (usado para matricula no Tipo 30)
 */
function campoAlfaDireita(texto: string | number | undefined, tamanho: number): string {
  let s = String(texto || '')
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, '')
  if (s.length > tamanho) return s.substring(0, tamanho)
  return s.padStart(tamanho, ' ')
}

/** Campo numerico: alinhado a direita, preenche com zeros a esquerda */
function campoNum(valor: string | number, tamanho: number): string {
  const s = String(valor || '').replace(/\D/g, '')
  if (s.length > tamanho) return s.slice(-tamanho)
  return s.padStart(tamanho, '0')
}

/** Espacos em branco */
function campoFiller(tamanho: number): string {
  return ' '.repeat(tamanho)
}

function formatarDataDDMMAAAA(dataISO: string): string {
  const p = dataISO.split('-')
  if (p.length === 3) return p[2] + p[1] + p[0]
  return '01012000'
}

/** Valor em centavos, 11 digitos (9 inteiros + 2 decimais implicitos) */
function campoValor(valor: number): string {
  const centavos = Math.round(valor * 100)
  return campoNum(String(centavos), 11)
}

// ============================================================
// CLASSE LINHA 350 - POSICIONAMENTO ABSOLUTO
// ============================================================

class Linha350 {
  private buffer: string[]

  constructor() {
    this.buffer = new Array(350).fill(' ')
  }

  /** Coloca texto a partir do indice (0-based) = Posicao - 1 */
  private colocar(indice: number, texto: string): void {
    for (let i = 0; i < texto.length && indice + i < 350; i++) {
      this.buffer[indice + i] = texto[i]
    }
  }

  /** Campo alfanumerico alinhado a esquerda */
  alfa(indice: number, texto: string | number | undefined, tamanho: number): void {
    this.colocar(indice, campoAlfa(texto, tamanho))
  }

  /** Campo alfanumerico alinhado a direita com espacos */
  alfaDir(indice: number, texto: string | number | undefined, tamanho: number): void {
    this.colocar(indice, campoAlfaDireita(texto, tamanho))
  }

  /** Campo numerico */
  num(indice: number, valor: string | number, tamanho: number): void {
    this.colocar(indice, campoNum(valor, tamanho))
  }

  /** Filler com espacos */
  filler(indice: number, tamanho: number): void {
    this.colocar(indice, campoFiller(tamanho))
  }

  toString(): string {
    return this.buffer.join('')
  }
}

// ============================================================
// GERACAO DO ARQUIVO VR PAT - EXATAMENTE COMO OS ARQUIVOS REAIS
// ============================================================

export function gerarArquivoVRPAT(
  resultados: VRResultadoCalculo[],
  config: VRConfiguracao,
  datasNascimento?: Map<string, string>
): string {
  const linhas: string[] = []
  let seq = 1

  const cnpj = campoNum(config.cnpjCliente, 14)
  const dataAgendamento = formatarDataDDMMAAAA(config.dataEfetivacao)
  const produto = campoAlfa(config.produto, 3)
  const emp = config.dadosEmpresa || {}

  // ===== HEADER - TIPO 00 =====
  const h = new Linha350()
  h.alfa(0, '00', 2)
  h.alfa(2, '011', 3)
  h.num(5, cnpj, 14)
  h.alfa(19, emp.razaoSocial, 40)
  h.filler(59, 282)
  h.num(341, String(seq).padStart(9, '0'), 9)
  seq++
  linhas.push(h.toString())

  // ===== LOCAL ENTREGA - TIPO 10 =====
  const l10 = new Linha350()
  l10.alfa(0, '10', 2)
  l10.num(2, cnpj, 14)
  l10.alfa(16, emp.codLocalEntrega, 30)
  l10.alfa(46, emp.nomeLocalEntrega, 80)
  l10.alfa(126, emp.tipoLogradouro, 20)
  l10.alfa(146, emp.logradouro, 40)
  l10.num(186, campoNum(emp.numero || '', 6), 6)
  l10.alfa(192, emp.complemento, 20)
  l10.alfa(212, emp.bairro, 30)
  l10.alfa(242, emp.cidade, 30)
  l10.alfa(272, emp.uf, 2)
  l10.num(274, campoNum(emp.cep || '', 8), 8)
  l10.alfa(282, emp.nomeInterlocutor, 30)
  l10.filler(312, 29)
  l10.num(341, String(seq).padStart(9, '0'), 9)
  seq++
  linhas.push(l10.toString())

  // ===== ASSOCIACAO CNPJ AO LOCAL - TIPO 11 =====
  const l11 = new Linha350()
  l11.alfa(0, '11', 2)
  l11.num(2, cnpj, 14)
  l11.alfa(16, emp.codLocalEntrega, 30)
  l11.num(46, cnpj, 14)
  l11.alfa(60, emp.nomeImpressaoCartao, 24)
  l11.filler(84, 70)
  l11.filler(154, 187)
  l11.num(341, String(seq).padStart(9, '0'), 9)
  seq++
  linhas.push(l11.toString())

  // ===== BENEFICIARIO - TIPO 30 (um por colaborador) =====
  const pulados: string[] = []

  for (const r of resultados) {
    const cpfLimpo = campoNum(r.cpf, 11)
    if (cpfLimpo === '00000000000' || cpfLimpo.length !== 11) {
      pulados.push(r.nome)
      continue
    }

    let dataNasc = '01011990'
    const cpfKey = (r.cpf || '').replace(/\D/g, '')
    if (datasNascimento && datasNascimento.has(cpfKey)) {
      dataNasc = datasNascimento.get(cpfKey)!
    }

    const l30 = new Linha350()
    l30.alfa(0, '30', 2)
    l30.num(2, cnpj, 14)
    l30.num(16, cpfLimpo, 11)
    l30.alfa(27, emp.codLocalEntrega, 30)
    l30.filler(57, 12)                    // Codigo centro de custo (vazio)
    l30.alfaDir(69, r.matricula, 10)       // Matricula ALINHADA A DIREITA
    l30.alfa(79, r.nome, 40)             // Nome completo
    l30.filler(119, 24)                   // Nome impressao cartao (vazio)
    l30.num(143, dataNasc, 8)             // Data nascimento DDMMAAAA
    l30.alfa(151, 'F', 1)                 // Sexo (F/M) - preenche 'F' por padrao
    l30.num(152, '00', 2)                  // Faixa salarial - '00' conforme arquivos reais
    l30.filler(154, 187)                  // Filler
    l30.num(341, String(seq).padStart(9, '0'), 9)
    seq++
    linhas.push(l30.toString())
  }

  // ===== PRODUTO VOUCHER - TIPO 50 =====
  const l50 = new Linha350()
  l50.alfa(0, '50', 2)
  l50.num(2, cnpj, 14)
  l50.alfa(16, produto, 3)
  l50.num(19, dataAgendamento, 8)
  l50.filler(27, 314)
  l50.num(341, String(seq).padStart(9, '0'), 9)
  seq++
  linhas.push(l50.toString())

  // ===== BENEFICIO VOUCHER - TIPO 60 (apenas elegiveis) =====
  for (const r of resultados) {
    if (r.diasElegiveis <= 0) continue
    const cpfLimpo = campoNum(r.cpf, 11)
    if (cpfLimpo === '00000000000' || cpfLimpo.length !== 11) continue

    const l60 = new Linha350()
    l60.alfa(0, '60', 2)
    l60.num(2, cnpj, 14)
    l60.alfa(16, produto, 3)
    l60.num(19, cpfLimpo, 11)
    l60.filler(30, 40)                    // Nome completo provisorio (vazio)
    l60.num(70, campoValor(r.valorBruto), 11)
    l60.filler(81, 260)
    l60.num(341, String(seq).padStart(9, '0'), 9)
    seq++
    linhas.push(l60.toString())
  }

  // ===== TRAILER - TIPO 99 =====
  const l99 = new Linha350()
  l99.alfa(0, '99', 2)
  l99.num(2, cnpj, 14)
  l99.filler(16, 325)
  l99.num(341, String(seq).padStart(9, '0'), 9)
  linhas.push(l99.toString())

  // Validacao de tamanho
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].length !== 350) {
      throw new Error(`Linha ${i + 1} tipo ${linhas[i].substring(0, 2)}: ${linhas[i].length} chars, esperado 350`)
    }
  }

  return linhas.join('\r\n')
}

// ============================================================
// FUNCOES AUXILIARES
// ============================================================

function serialExcelParaDDMMYYYY(serial: number): string {
  const EPOCH = new Date(Date.UTC(1899, 11, 30))
  const ms = Math.round((serial - Math.floor(serial)) * 86400000)
  const dias = Math.floor(serial)
  const data = new Date(EPOCH.getTime() + dias * 86400000 + ms)
  const d = String(data.getUTCDate()).padStart(2, '0')
  const m = String(data.getUTCMonth() + 1).padStart(2, '0')
  const y = String(data.getUTCFullYear())
  return d + m + y
}

// ============================================================
// GERACAO DO ARQUIVO ALTERDATA - LAYOUT OFICIAL
// Cada linha: exatamente 61 posicoes
// Valor evento: 14 posicoes (padStart 14)
// ============================================================

export function gerarArquivoAlterdata(
  resultados: VRResultadoCalculo[],
  config: VRConfiguracao
): { conteudo: string; gerados: number; puladosSemMatricula: number } {
  const linhas: string[] = []
  let seq = 1
  let puladosSemMatricula = 0

  const empresa = config.empresaAlterdata || '00032'
  const codEvento = '611'

  // Calcular Referencia 1 (primeiro dia do mes) e Referencia 2 (ultimo dia do mes)
  const dataCorte = config.dataCorte // formato: YYYY-MM-DD
  const partes = dataCorte.split('-')
  const ano = parseInt(partes[0])
  const mes = parseInt(partes[1])

  // Primeiro dia do mes: DDMMAA
  const ref1 = '01' + String(mes).padStart(2, '0') + String(ano).slice(-2)

  // Ultimo dia do mes
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const ref2 = String(ultimoDia).padStart(2, '0') + String(mes).padStart(2, '0') + String(ano).slice(-2)

  for (const r of resultados) {
    // So gera para colaboradores elegiveis
    if (r.diasElegiveis <= 0) continue

    // Validar matricula (6 digitos numericos)
    const matricula = campoNum(r.matricula || '', 6).padStart(6, '0').slice(-6)
    if (matricula === '000000') {
      puladosSemMatricula++
      continue // Pula colaboradores sem matricula
    }

    // Valor do Evento = valorBruto * descontoPercentual / 100
    const valorDescontoReais = r.valorBruto * (config.descontoPercentual / 100)
    const valorDesconto = Math.round(valorDescontoReais * 100) // em centavos
    const valorStr = String(valorDesconto).padStart(14, '0')

    // Montar linha de 61 posicoes
    let linha = ''
    linha += String(seq).padStart(6, '0')           // Pos 1-6:   Sequencial (6)
    linha += empresa                                 // Pos 7-11:  Empresa (5)
    linha += ref1                                    // Pos 12-17: Ref. 1 inicio (6)
    linha += ref2                                    // Pos 18-23: Ref. 2 fim (6)
    linha += '000000'                                // Pos 24-29: Faltas min (6)
    linha += '000000'                                // Pos 30-35: Horas Trab. (6)
    linha += '00'                                    // Pos 36-37: Dias Uteis (2)
    linha += codEvento                               // Pos 38-40: Cod. Evento (3)
    linha += valorStr                                // Pos 41-54: Valor Evento (14)
    linha += matricula                               // Pos 55-60: Matricula (6)
    linha += 'F'                                     // Pos 61:    Tipo Processo (1)

    if (linha.length !== 61) {
      throw new Error(`Linha Alterdata ${seq}: ${linha.length} chars, esperado 61`)
    }

    linhas.push(linha)
    seq++
  }

  return {
    conteudo: linhas.join('\r\n'),
    gerados: linhas.length,
    puladosSemMatricula
  }
}

export async function carregarDatasNascimento(arrayBuffer: ArrayBuffer): Promise<{
  datas: Map<string, string>
  cpfsPorNome: Map<string, string>
  matriculasPorNome: Map<string, string>
  matriculasPorCpf: Map<string, string>
}> {
  const XLSX = await import('@e965/xlsx')
  const datas = new Map<string, string>()
  const cpfsPorNome = new Map<string, string>()
  const matriculasPorNome = new Map<string, string>()
  const matriculasPorCpf = new Map<string, string>()

  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as unknown[][]

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 4) continue

      // Ordem: MATRICULA | NOME | CPF | DATA_NASCIMENTO
      const matricula = String(row[0] || '').trim()
      const nome = String(row[1] || '').trim()

      let cpf = ''
      const cpfRaw = row[2]
      if (typeof cpfRaw === 'number') {
        cpf = String(Math.floor(cpfRaw)).replace(/\D/g, '')
      } else {
        cpf = String(cpfRaw || '').replace(/\D/g, '')
      }

      const dataRaw = row[3]
      let dataNasc = ''

      if (typeof dataRaw === 'number') {
        dataNasc = serialExcelParaDDMMYYYY(dataRaw)
      } else if (dataRaw instanceof Date) {
        dataNasc = String(dataRaw.getDate()).padStart(2, '0') +
                    String(dataRaw.getMonth() + 1).padStart(2, '0') +
                    String(dataRaw.getFullYear())
      } else {
        const s = String(dataRaw || '').trim()
        if (s.includes('/')) {
          const parts = s.split('/')
          if (parts.length === 3) {
            dataNasc = (parts[0].padStart(2, '0') + parts[1].padStart(2, '0') + parts[2]).substring(0, 8)
          }
        } else if (s.includes('-')) {
          const parts = s.split('-')
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              dataNasc = (parts[2].padStart(2, '0') + parts[1].padStart(2, '0') + parts[0]).substring(0, 8)
            } else {
              dataNasc = (parts[0].padStart(2, '0') + parts[1].padStart(2, '0') + parts[2]).substring(0, 8)
            }
          }
        }
      }

      // Guardar data de nascimento por CPF
      if (cpf.length === 11 && dataNasc.length === 8 && /^\d{8}$/.test(dataNasc)) {
        datas.set(cpf, dataNasc)
      }

      // Guardar CPF por nome (para busca)
      if (nome && cpf.length === 11) {
        cpfsPorNome.set(nome, cpf)
      }

      // Guardar matricula por nome e por CPF
      if (matricula) {
        if (nome) matriculasPorNome.set(nome, matricula)
        if (cpf.length === 11) matriculasPorCpf.set(cpf, matricula)
      }
    }
  } catch (e) {
    console.error('Erro ao carregar dados de nascimento:', e)
  }

  return { datas, cpfsPorNome, matriculasPorNome, matriculasPorCpf }
}

function normalizarNome(nome: string): string {
  return nome.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

export function gerarExcelConferencia(
  resultados: VRResultadoCalculo[],
  config: VRConfiguracao
): string {
  const linhas: string[] = []
  linhas.push([
    'NOME', 'CPF', 'MATRICULA', 'DIAS_PDF', 'DIAS_ESCALA', 'DIAS_ELEGIVEIS',
    'AUSENCIAS', 'VALOR_UNIT', 'VALOR_TOTAL'
  ].join('\t'))

  for (const r of resultados) {
    linhas.push([
      r.nome, r.cpf, r.matricula || '', String(r.diasPdf), String(r.diasEscala),
      String(r.diasElegiveis), String(r.diasAbatimento),
      String(config.valorVR), String(r.valorBruto)
    ].join('\t'))
  }

  linhas.push(`\nTOTAL\t\t\t\t\t${resultados.reduce((s, r) => s + r.diasElegiveis, 0)}\t\t\tR$ ${resultados.reduce((s, r) => s + r.valorBruto, 0).toFixed(2)}`)
  return linhas.join('\n')
}

export { normalizarNome }
