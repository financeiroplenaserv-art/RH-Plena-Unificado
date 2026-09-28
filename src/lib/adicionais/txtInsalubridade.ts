// ============================================================
// TXT Alterdata — Insalubridade (decisão da gestão)
// Gera o arquivo de remessa com o VALOR da insalubridade de cada
// colaborador: salário base único × 20% × (dias do relatório ÷ 30).
// Mesmo layout de 61 posições do arquivo do módulo VR
// (src/lib/vr/calculoVR.ts) — duplicação intencional para não
// arriscar o fluxo de VR em produção.
// ============================================================

export interface LinhaInsalubridade {
  colaborador_nome: string
  matricula: string | null
  empresaCodigo: string | null // empresas.codigo_alterdata (5 posições)
  dias: number
}

export interface ConfigTxtInsalubridade {
  salarioBase: number // em R$
  codigoEvento: string // padrão '012'
  ano: number // competência = mês selecionado no relatório
  mes: number
}

export interface ResultadoTxtInsalubridade {
  conteudo: string
  gerados: number
  pulados: { nome: string; motivo: string }[]
}

/** Valor da insalubridade em centavos: salário × 20% × dias/30. */
export function calcularValorInsalubridadeCentavos(salarioBase: number, dias: number): number {
  return Math.round(((salarioBase * 0.2 * dias) / 30) * 100)
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

function formatarRefDDMMAA(ano: number, mes: number, dia: number): string {
  const d = String(dia).padStart(2, '0')
  const m = String(mes).padStart(2, '0')
  const a = String(ano).slice(-2)
  return d + m + a
}

export function gerarTxtInsalubridade(
  linhas: LinhaInsalubridade[],
  config: ConfigTxtInsalubridade
): ResultadoTxtInsalubridade {
  const codEvento = (config.codigoEvento || '').replace(/\D/g, '').padStart(3, '0').slice(0, 3)
  const ref1 = formatarRefDDMMAA(config.ano, config.mes, 1)
  const ref2 = formatarRefDDMMAA(config.ano, config.mes, ultimoDiaDoMes(config.ano, config.mes))

  const saida: string[] = []
  const pulados: { nome: string; motivo: string }[] = []
  let seq = 1

  for (const l of linhas) {
    if (l.dias <= 0) {
      pulados.push({ nome: l.colaborador_nome, motivo: 'sem dias de insalubridade' })
      continue
    }
    const matricula = (l.matricula || '').replace(/\D/g, '')
    if (!matricula) {
      pulados.push({ nome: l.colaborador_nome, motivo: 'sem matrícula' })
      continue
    }
    if (matricula.length > 6) {
      pulados.push({ nome: l.colaborador_nome, motivo: `matrícula com mais de 6 dígitos (${matricula})` })
      continue
    }
    const empresa = (l.empresaCodigo || '').replace(/\D/g, '').padStart(5, '0')
    if (!l.empresaCodigo || empresa.length > 5) {
      pulados.push({ nome: l.colaborador_nome, motivo: 'sem código de empresa Alterdata' })
      continue
    }

    const valorStr = String(calcularValorInsalubridadeCentavos(config.salarioBase, l.dias)).padStart(14, '0')

    let linha = ''
    linha += String(seq).padStart(6, '0')       // Pos 1-6:   Sequencial (6)
    linha += empresa                             // Pos 7-11:  Empresa (5)
    linha += ref1                                // Pos 12-17: Ref. 1 início (6)
    linha += ref2                                // Pos 18-23: Ref. 2 fim (6)
    linha += '000000'                            // Pos 24-29: Faltas min (6)
    linha += '000000'                            // Pos 30-35: Horas Trab. (6)
    linha += '00'                                // Pos 36-37: Dias Úteis (2)
    linha += codEvento                           // Pos 38-40: Cod. Evento (3)
    linha += valorStr                            // Pos 41-54: Valor Evento (14)
    linha += matricula.padStart(6, '0')          // Pos 55-60: Matrícula (6)
    linha += 'F'                                 // Pos 61:    Tipo Processo (1)

    if (linha.length !== 61) {
      throw new Error(`Linha Alterdata ${seq}: ${linha.length} chars, esperado 61`)
    }

    saida.push(linha)
    seq++
  }

  return { conteudo: saida.join('\r\n'), gerados: saida.length, pulados }
}
