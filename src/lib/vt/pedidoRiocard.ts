// Arquivo de PEDIDO de carga de VT para a Riocard — lógica pura, sem banco.
//
// Layout oficial: docs/PEF-V14-Ver1.6.0_-_Layouts_dos_arquivos_de_importacao_de_usuarios_e_pedidos.pdf
// (capítulo 2, versão 01.00). Largura fixa; numérico à direita com zeros, alfa à esquerda
// com espaços:
//   01 header : seq(5) "01" "PEDIDO" "01.00" CNPJ(14)                      = 32 posições
//   02 item   : seq(5) "02" matrícula Alfa(15) valor Num(8, centavos)      = 30 posições
//   03 entrega: opcional ("informar caso não utilize o site") — NÃO geramos
//   99 trailer: seq(5) "99" total Num(10, centavos)                        = 17 posições
// Nome: PEDIDO_0100_<CNPJ14>_<aaaammdd>_<hhmm>.txt.
// O PDF não define quebra de linha nem codificação; usamos CRLF (editor do Windows) e
// ASCII (a matrícula só aceita letras e dígitos, então o arquivo é ASCII puro).
//
// Decisões da gestora (28/11/2026): um arquivo por CNPJ (Plena EA e Plena Tech separadas);
// a matrícula enviada é a cadastrada NA RIOCARD, exatamente como está lá; o valor é o valor
// final da pessoa no lote confirmado. Nada é somado ou inferido por palpite.

import type { RelatorioRiocard } from '@/lib/vt/importacaoRiocard'
import { cpf11 } from '@/lib/vt/importacaoAlterdata'

export const MAX_MATRICULA_RIOCARD = 15
export const MAX_VALOR_ITEM_CENTAVOS = 99_999_999 // Num 8
export const MAX_TOTAL_PEDIDO_CENTAVOS = 9_999_999_999 // Num 10

export interface TotalPedidoRiocard {
  colaboradorId: string
  nome: string
  /** Valor final do lote confirmado (necessidade + ajuste + extra, piso zero). null = indeterminado. */
  valorCentavos: number | null
}

export interface VinculoRiocard {
  /** Matrícula cadastrada NA RIOCARD. */
  matriculaRiocard: string
  /** CNPJ (conta Riocard) — aceita com ou sem máscara. */
  cnpj: string
}

export interface ItemPedidoRiocard {
  colaboradorId: string
  nome: string
  matriculaRiocard: string
  valorCentavos: number
}

export interface ArquivoPedidoRiocard {
  cnpj: string
  nomeArquivo: string
  conteudo: string
  totalCentavos: number
  itens: ItemPedidoRiocard[]
}

export interface ForaDoPedidoRiocard {
  colaboradorId: string
  nome: string
  motivo: string
}

export interface ResultadoPedidoRiocard {
  arquivos: ArquivoPedidoRiocard[]
  fora: ForaDoPedidoRiocard[]
}

const soDigitos = (v: string) => v.replace(/\D/g, '')
const num = (v: number, tam: number) => String(v).padStart(tam, '0')
const alfa = (v: string, tam: number) => v.padEnd(tam, ' ')
const doisDigitos = (n: number) => String(n).padStart(2, '0')

/** Matrícula aceita no arquivo: só letras e dígitos, 1 a 15 caracteres (já sem espaços nas pontas). */
export function matriculaRiocardValida(m: string): boolean {
  return new RegExp(`^[A-Za-z0-9]{1,${MAX_MATRICULA_RIOCARD}}$`).test(m)
}

/**
 * Nome do arquivo. `agora` deve ter os componentes LOCAIS em horário de Brasília
 * (use `agoraBrasil()` de `@/lib/utils`).
 */
export function nomeArquivoPedidoRiocard(cnpj14: string, agora: Date): string {
  const data = `${agora.getFullYear()}${doisDigitos(agora.getMonth() + 1)}${doisDigitos(agora.getDate())}`
  const hora = `${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}`
  return `PEDIDO_0100_${cnpj14}_${data}_${hora}.txt`
}

/** Monta o conteúdo do TXT (header 01 + itens 02 + trailer 99), linhas separadas por CRLF. */
export function montarConteudoPedidoRiocard(
  cnpj14: string,
  itens: readonly { matriculaRiocard: string; valorCentavos: number }[],
): string {
  if (!/^\d{14}$/.test(cnpj14)) throw new Error(`CNPJ inválido: ${cnpj14}`)
  const linhas: string[] = []
  let seq = 1
  linhas.push(num(seq++, 5) + '01' + 'PEDIDO' + '01.00' + cnpj14)
  let total = 0
  for (const it of itens) {
    if (!matriculaRiocardValida(it.matriculaRiocard)) throw new Error(`matrícula inválida: ${it.matriculaRiocard}`)
    if (!Number.isInteger(it.valorCentavos) || it.valorCentavos <= 0 || it.valorCentavos > MAX_VALOR_ITEM_CENTAVOS) {
      throw new Error(`valor inválido para a matrícula ${it.matriculaRiocard}: ${it.valorCentavos}`)
    }
    linhas.push(num(seq++, 5) + '02' + alfa(it.matriculaRiocard, MAX_MATRICULA_RIOCARD) + num(it.valorCentavos, 8))
    total += it.valorCentavos
  }
  if (total > MAX_TOTAL_PEDIDO_CENTAVOS) throw new Error('total do pedido acima de 10 posições')
  linhas.push(num(seq, 5) + '99' + num(total, 10))
  return linhas.join('\r\n') + '\r\n'
}

/**
 * Separa o lote em um arquivo por CNPJ. Quem não pode entrar vai para `fora` com o motivo —
 * nunca se corrige, soma ou adivinha. Ordenação determinística por matrícula.
 */
export function montarPedidoRiocard(args: {
  totais: readonly TotalPedidoRiocard[]
  vinculos: ReadonlyMap<string, VinculoRiocard>
  /** CNPJs (com ou sem máscara) que podem gerar arquivo. */
  cnpjsPermitidos: readonly string[]
  /** Horário de Brasília nos componentes locais. */
  agora: Date
  /** Motivo específico para quem não tem vínculo (ex.: conflito de CPF entre contas). */
  motivosSemVinculo?: ReadonlyMap<string, string>
}): ResultadoPedidoRiocard {
  const permitidos = new Set(args.cnpjsPermitidos.map(soDigitos))
  const fora: ForaDoPedidoRiocard[] = []
  const candidatos: (ItemPedidoRiocard & { cnpj: string })[] = []

  for (const t of args.totais) {
    const recusar = (motivo: string) => fora.push({ colaboradorId: t.colaboradorId, nome: t.nome, motivo })
    if (t.valorCentavos === null || t.valorCentavos === undefined) {
      recusar('valor indeterminado — resolver as pendências do lote')
      continue
    }
    if (!Number.isInteger(t.valorCentavos) || t.valorCentavos <= 0) {
      recusar('sem valor a carregar')
      continue
    }
    if (t.valorCentavos > MAX_VALOR_ITEM_CENTAVOS) {
      recusar('valor acima do limite do arquivo (8 posições em centavos)')
      continue
    }
    const v = args.vinculos.get(t.colaboradorId)
    const matricula = v?.matriculaRiocard?.trim() ?? ''
    if (!v || !matricula) {
      recusar(args.motivosSemVinculo?.get(t.colaboradorId) ?? 'sem matrícula na Riocard — cadastrar lá antes')
      continue
    }
    if (matricula.length > MAX_MATRICULA_RIOCARD) {
      recusar(`matrícula Riocard com ${matricula.length} caracteres (máximo ${MAX_MATRICULA_RIOCARD})`)
      continue
    }
    if (!matriculaRiocardValida(matricula)) {
      recusar(`matrícula Riocard com caractere inválido (${matricula}) — só letras e dígitos`)
      continue
    }
    const cnpj = soDigitos(v.cnpj)
    if (!/^\d{14}$/.test(cnpj) || !permitidos.has(cnpj)) {
      recusar('CNPJ da conta Riocard não permitido para pedido')
      continue
    }
    candidatos.push({ colaboradorId: t.colaboradorId, nome: t.nome, matriculaRiocard: matricula, valorCentavos: t.valorCentavos, cnpj })
  }

  // Mesma matrícula duas vezes na mesma conta: as duas ficam fora (nunca soma por palpite).
  const contagem = new Map<string, number>()
  for (const c of candidatos) {
    const k = `${c.cnpj}|${c.matriculaRiocard}`
    contagem.set(k, (contagem.get(k) ?? 0) + 1)
  }
  const porCnpj = new Map<string, ItemPedidoRiocard[]>()
  for (const c of candidatos) {
    if ((contagem.get(`${c.cnpj}|${c.matriculaRiocard}`) ?? 0) > 1) {
      fora.push({
        colaboradorId: c.colaboradorId,
        nome: c.nome,
        motivo: `matrícula Riocard ${c.matriculaRiocard} repetida na mesma conta — conferir os cadastros`,
      })
      continue
    }
    const { cnpj, ...item } = c
    porCnpj.set(cnpj, [...(porCnpj.get(cnpj) ?? []), item])
  }

  const arquivos: ArquivoPedidoRiocard[] = []
  for (const cnpj of [...porCnpj.keys()].sort()) {
    const itens = porCnpj.get(cnpj)!.sort((a, b) =>
      a.matriculaRiocard < b.matriculaRiocard ? -1 : a.matriculaRiocard > b.matriculaRiocard ? 1 : 0,
    )
    const totalCentavos = itens.reduce((s, i) => s + i.valorCentavos, 0)
    arquivos.push({
      cnpj,
      nomeArquivo: nomeArquivoPedidoRiocard(cnpj, args.agora),
      conteudo: montarConteudoPedidoRiocard(cnpj, itens),
      totalCentavos,
      itens,
    })
  }
  fora.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return { arquivos, fora }
}

// ----- Vínculo CORH × Riocard (por CPF) -----

export interface ColaboradorParaRiocard {
  id: string
  cpf: string | null
  /** Status no CORH: só Ativo e Afastado entram. */
  status: string
}

export interface ConflitoVinculoRiocard {
  cpf: string
  motivo: string
  colaboradorIds: string[]
}

export interface ResultadoVinculosRiocard {
  vinculos: Map<string, VinculoRiocard>
  conflitos: ConflitoVinculoRiocard[]
  /** colaboradorId → motivo (para `motivosSemVinculo` de `montarPedidoRiocard`). */
  motivosPorColaborador: Map<string, string>
}

/**
 * Casa os relatórios da Riocard (um por conta/CNPJ) com os colaboradores do CORH por CPF exato
 * de 11 dígitos. Só vale linha ATIVA na Riocard e cadastro Ativo/Afastado no CORH. CPF ativo em
 * duas linhas/contas, ou repetido no CORH, é conflito: ninguém é escolhido.
 */
export function vinculosRiocardDoRelatorio(
  relatorios: readonly RelatorioRiocard[],
  colaboradores: readonly ColaboradorParaRiocard[],
): ResultadoVinculosRiocard {
  const vinculos = new Map<string, VinculoRiocard>()
  const conflitos: ConflitoVinculoRiocard[] = []
  const motivosPorColaborador = new Map<string, string>()

  const porCpfCorh = new Map<string, string[]>()
  for (const c of colaboradores) {
    if (!/^(ativo|afastado)$/i.test(c.status.trim())) continue
    const k = cpf11(c.cpf)
    if (k) porCpfCorh.set(k, [...(porCpfCorh.get(k) ?? []), c.id])
  }

  const ativosPorCpf = new Map<string, { matricula: string; cnpj: string }[]>()
  for (const r of relatorios) {
    for (const l of r.linhas) {
      if (!l.cpf || !/^ativo$/i.test(l.status.trim())) continue
      ativosPorCpf.set(l.cpf, [...(ativosPorCpf.get(l.cpf) ?? []), { matricula: l.matricula.trim(), cnpj: soDigitos(r.cnpj) }])
    }
  }

  for (const [cpf, ids] of porCpfCorh) {
    const ativos = ativosPorCpf.get(cpf)
    if (!ativos) continue
    let motivo: string | null = null
    if (ids.length > 1) motivo = 'CPF repetido no cadastro do CORH — não é possível escolher'
    else if (ativos.length > 1) motivo = 'CPF ativo mais de uma vez na Riocard (nas contas ou na mesma conta) — regularizar lá'
    if (motivo) {
      conflitos.push({ cpf, motivo, colaboradorIds: ids })
      for (const id of ids) motivosPorColaborador.set(id, motivo)
      continue
    }
    vinculos.set(ids[0], { matriculaRiocard: ativos[0].matricula, cnpj: ativos[0].cnpj })
  }
  conflitos.sort((a, b) => a.cpf.localeCompare(b.cpf))
  return { vinculos, conflitos, motivosPorColaborador }
}
