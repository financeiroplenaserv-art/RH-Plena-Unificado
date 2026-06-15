import type { VRColaboradorPonto, VRRegistroPonto } from '@/types'

/**
 * Extrai colaboradores do PDF usando NOME como chave.
 * O CPF sera obtido da escala Excel no momento do matching.
 */
export function parsePDFPonto(texto: string): Map<string, VRColaboradorPonto> {
  const mapa = new Map<string, VRColaboradorPonto>()

  const textoLimpo = texto.replace(/\r\n/g, '\n').replace(/\n+/g, '\n').trim()

  // Dividir por "Empresa:" para separar cada colaborador
  const secoes = textoLimpo.split(/Empresa:/i)

  for (let i = 1; i < secoes.length; i++) {
    const secao = secoes[i]
    const linhas = secao.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    // === Extrair CPF ===
    // Tenta multiplos formatos de CPF no PDF
    let cpf = ''

    // Formato 1: "Colaborador CPF: 123.456.789-00"
    const cpfMatch1 = secao.match(/Colaborador\s+CPF[:\s]+([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})/i)
    if (cpfMatch1) cpf = limparCPF(cpfMatch1[1])

    // Formato 2: "CPF: 123.456.789-00"
    if (!cpf) {
      const cpfMatch2 = secao.match(/CPF[:\s]+([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})/i)
      if (cpfMatch2) cpf = limparCPF(cpfMatch2[1])
    }

    // Formato 3: CPF sozinho em uma linha (12345678900 ou 123.456.789-00)
    if (!cpf || cpf.length !== 11) {
      for (const linha of linhas) {
        const m = linha.match(/^([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})$/)
        if (m) { cpf = limparCPF(m[1]); break }
        const m2 = linha.match(/^([0-9]{11})$/)
        if (m2) { cpf = m2[1]; break }
      }
    }

    // Validar CPF: deve ter 11 digitos numericos
    if (!cpf || cpf.length !== 11 || !/^\d{11}$/.test(cpf)) {
      continue // Pular secao sem CPF valido
    }

    // === Extrair nome ===
    let nome = 'DESCONHECIDO'

    // Tentativa 1: "Colaborador:" em uma linha, nome na proxima
    const idxColab = linhas.findIndex(l => l.match(/^Colaborador[:\s]*$/i))
    if (idxColab >= 0 && idxColab + 1 < linhas.length) {
      const possivel = linhas[idxColab + 1]
      if (possivel && !possivel.match(/Colaborador\s+CPF/i) && !possivel.match(/^[0-9.-]{11,14}$/)) {
        if (possivel.match(/[A-Z]{3,}/)) {
          nome = limparNome(possivel)
        }
      }
    }

    // Tentativa 2: "Colaborador: NOME" na mesma linha
    if (nome === 'DESCONHECIDO') {
      const match = secao.match(/Colaborador[:\s]+([A-Z][A-Z\s]+?)(?=\s+(?:Colaborador\s+CPF|CPF|Cargo|Per[ií]odo))/i)
      if (match && match[1].trim().length > 3) {
        nome = limparNome(match[1])
      }
    }

    // Tentativa 3: "Nome:" ou "Funcionario:"
    if (nome === 'DESCONHECIDO') {
      const match = secao.match(/(?:Nome|Funcion[áa]rio)[:\s]+([A-Z][A-Z\s]+?)(?=\s+(?:CPF|Cargo|Per[ií]odo|\n))/i)
      if (match && match[1].trim().length > 3) {
        nome = limparNome(match[1])
      }
    }

    if (nome === 'DESCONHECIDO') continue

    // Extrair registros
    const registros = parseRegistros(secao)

    // Usar NOME como chave (normalizado para matching)
    const chave = nome

    // Se ja existe, mesclar
    if (mapa.has(chave)) {
      const existente = mapa.get(chave)!
      existente.registros.push(...registros)
      continue
    }

    mapa.set(chave, {
      colaborador: { cpf, nome, cargo: '' },
      registros
    })
  }

  return mapa
}

function parseRegistros(texto: string): VRRegistroPonto[] {
  const registros: VRRegistroPonto[] = []
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  for (let idx = 0; idx < linhas.length; idx++) {
    const linha = linhas[idx]
    const dataMatch = linha.match(/^([0-9]{2}\/[0-9]{2}\/[0-9]{2})\s+-\s+(\w+)/)
    if (!dataMatch) continue

    const data = dataMatch[1]
    const restoLinha = linha.substring(dataMatch[0].length).trim()
    const contexto = (restoLinha + ' ' + linhas.slice(idx + 1, idx + 4).join(' ')).toLowerCase()

    let tipo: VRRegistroPonto['tipo'] = 'outro'
    let horasTrabalhadas = '00:00'

    if (contexto.includes('folga')) tipo = 'folga'
    else if (contexto.includes('falta')) tipo = 'falta'
    else if (contexto.includes('férias') || contexto.includes('ferias')) tipo = 'ferias'
    else if (contexto.includes('suspens')) tipo = 'suspensao'
    else {
      const horarios: string[] = []
      const hLinha = restoLinha.match(/[0-9]{2}:[0-9]{2}/g)
      if (hLinha) horarios.push(...hLinha)

      for (let j = 1; j <= 3 && idx + j < linhas.length; j++) {
        const prox = linhas[idx + j]
        if (prox.match(/^[0-9]{2}\/[0-9]{2}\/[0-9]{2}\s+-/)) break
        if (prox.match(/^(Ocorrências|Folga|Falta|Férias|Total|Empresa|Colaborador)/i)) break
        const h = prox.match(/[0-9]{2}:[0-9]{2}/g)
        if (h) horarios.push(...h)
      }

      if (horarios.length > 0) {
        horasTrabalhadas = horarios[horarios.length - 1]
        tipo = 'trabalhado'
      }
    }

    registros.push({ data, horasTrabalhadas, tipo })
  }

  return registros
}

function limparNome(nome: string): string {
  return nome.replace(/[…]/g, '').replace(/[^\p{L}\s-]/gu, '').trim()
}

export function limparCPF(cpf: string): string {
  return cpf.replace(/[.-]/g, '')
}

export function contarAbatimentos(ponto: VRColaboradorPonto | undefined): number {
  if (!ponto) return 0
  return ponto.registros.filter(r => r.tipo === 'falta' || r.tipo === 'suspensao').length
}

export function contarDiasPdf6h(ponto: VRColaboradorPonto | undefined): number {
  if (!ponto) return 0
  let count = 0
  for (const reg of ponto.registros) {
    if (reg.tipo === 'trabalhado') {
      const [h, m] = reg.horasTrabalhadas.split(':').map(Number)
      if (h * 60 + m >= 360) count++
    }
  }
  return count
}
