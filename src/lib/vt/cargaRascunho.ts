// Rascunho da carga de VT no aparelho (incidente de 27/10/2026: sair da aba
// Carga perdia o relatório importado e todo o cálculo — e, sem a gravação
// percebida, o banco ficou vazio). Guarda só o relatório PARSEADO (nomes +
// marcas por dia — o relatório "Gestão de escalas" não tem CPF) e a
// competência; na volta à aba o cálculo é REFEITO com os dados atuais do
// banco (trajetos e coberturas novos entram sozinhos). Não é fonte de verdade:
// quem manda é o que está gravado em vt_cargas (banner de gravação).

import type { PessoaRelatorio } from '@/lib/vt/gestaoEscalasFlit'

export const CHAVE_RASCUNHO_CARGA_VT = 'corh:vt:carga'

export interface RascunhoCargaVt {
  versao: 1
  /** Competência do relatório ('AAAA-MM'). */
  competencia: string
  nomeArquivo: string | null
  /** ISO de quando o relatório foi importado. */
  salvoEm: string
  pessoas: PessoaRelatorio[]
}

const MARCAS = new Set(['trabalha', 'folga', 'ferias', 'afastado', 'atestado', 'vazio'])
const RE_COMPETENCIA = /^\d{4}-\d{2}$/
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/

export function montarRascunhoCarga(
  pessoas: PessoaRelatorio[],
  nomeArquivo: string | null,
  competencia: string,
  agoraIso: string
): RascunhoCargaVt {
  return { versao: 1, competencia, nomeArquivo, salvoEm: agoraIso, pessoas }
}

/**
 * Valida o JSON lido do armazenamento. Qualquer divergência de formato
 * (versão, tipos, marcas desconhecidas) invalida o rascunho INTEIRO — nunca
 * restaurar parcialmente um rascunho suspeito.
 */
export function validarRascunhoCarga(bruto: unknown): RascunhoCargaVt | null {
  if (!bruto || typeof bruto !== 'object') return null
  const r = bruto as Record<string, unknown>
  if (r.versao !== 1) return null
  if (typeof r.competencia !== 'string' || !RE_COMPETENCIA.test(r.competencia)) return null
  if (r.nomeArquivo !== null && typeof r.nomeArquivo !== 'string') return null
  if (typeof r.salvoEm !== 'string') return null
  if (!Array.isArray(r.pessoas)) return null
  for (const p of r.pessoas) {
    if (!p || typeof p !== 'object') return null
    const pessoa = p as Record<string, unknown>
    if (typeof pessoa.nome !== 'string' || pessoa.nome.trim() === '') return null
    if (typeof pessoa.departamentoTexto !== 'string') return null
    if (typeof pessoa.cargo !== 'string') return null
    if (typeof pessoa.horario !== 'string') return null
    if (!Array.isArray(pessoa.dias)) return null
    for (const d of pessoa.dias) {
      if (!d || typeof d !== 'object') return null
      const dia = d as Record<string, unknown>
      if (typeof dia.data !== 'string' || !RE_DATA.test(dia.data)) return null
      if (typeof dia.marca !== 'string' || !MARCAS.has(dia.marca)) return null
      if (typeof dia.texto !== 'string') return null
    }
  }
  return bruto as RascunhoCargaVt
}
