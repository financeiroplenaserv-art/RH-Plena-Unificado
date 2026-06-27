import type { FonteLocalTrabalho, MapeamentoFlitLocalTrabalho } from '@/types/database'
import { normalizarTexto } from './normalizarTexto'

export interface DadosBatidaDia {
  tipoDispositivo?: string | null
  nomeDispositivo?: string | null
  perimetro?: string | null
  departamento?: string | null
  turno?: string | null
}

export interface ResultadoInferencia {
  localTrabalhoId: string
  fonte: FonteLocalTrabalho
  confianca: 'alta' | 'media' | 'baixa'
}

function encontrarMapeamento(
  mapeamentos: MapeamentoFlitLocalTrabalho[],
  tipo: MapeamentoFlitLocalTrabalho['tipo_match'],
  valor: string
): MapeamentoFlitLocalTrabalho | undefined {
  const valorNormalizado = normalizarTexto(valor)
  if (!valorNormalizado) return undefined

  return mapeamentos
    .filter((m) => m.ativo !== false && m.tipo_match === tipo)
    .sort((a, b) => (a.prioridade ?? 100) - (b.prioridade ?? 100))
    .find((m) => {
      const valorFlit = normalizarTexto(m.valor_flit)
      return valorFlit && valorNormalizado.includes(valorFlit)
    })
}

export function inferirLocalTrabalho(
  mapeamentos: MapeamentoFlitLocalTrabalho[],
  dados: DadosBatidaDia
): ResultadoInferencia | null {
  const {
    tipoDispositivo,
    nomeDispositivo,
    perimetro,
    departamento,
  } = dados

  const tipoDispositivoNormalizado = normalizarTexto(tipoDispositivo)
  const nomeDispositivoNormalizado = normalizarTexto(nomeDispositivo)

  // 1. Dispositivo fixo (Flit Multi)
  if (
    tipoDispositivoNormalizado.includes('multi') &&
    nomeDispositivoNormalizado
  ) {
    const match = encontrarMapeamento(mapeamentos, 'dispositivo', nomeDispositivoNormalizado)
    if (match) {
      return {
        localTrabalhoId: match.local_trabalho_id,
        fonte: 'dispositivo',
        confianca: 'alta',
      }
    }
  }

  // 2. Perímetro
  const perimetroNormalizado = normalizarTexto(perimetro)
  if (perimetroNormalizado && perimetroNormalizado !== '--') {
    const match = encontrarMapeamento(mapeamentos, 'perimetro', perimetroNormalizado)
    if (match) {
      return {
        localTrabalhoId: match.local_trabalho_id,
        fonte: 'perimetro',
        confianca: 'alta',
      }
    }
  }

  // 3. Departamento mapeado como local de trabalho
  const departamentoNormalizado = normalizarTexto(departamento)

  if (departamentoNormalizado) {
    const match = mapeamentos
      .filter((m) => m.ativo !== false && m.tipo_match === 'turno_departamento')
      .sort((a, b) => (a.prioridade ?? 100) - (b.prioridade ?? 100))
      .find((m) => {
        const valorFlit = normalizarTexto(m.valor_flit)
        return valorFlit && departamentoNormalizado.includes(valorFlit)
      })

    if (match) {
      return {
        localTrabalhoId: match.local_trabalho_id,
        fonte: 'turno_departamento',
        confianca: 'media',
      }
    }
  }

  return null
}
