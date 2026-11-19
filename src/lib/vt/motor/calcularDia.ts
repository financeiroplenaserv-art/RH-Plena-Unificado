import { calcularSentido } from '@/lib/vt/motor/calcularSentido'
import { reais } from '@/lib/vt/motor/tarifas'
import type {
  EntradaDiaMotor,
  PendenciaMotor,
  ResultadoDiaMotor,
  StatusMotor,
} from '@/lib/vt/motor/tipos'

/**
 * Valor do dia = ida + volta, cada sentido calculado separadamente.
 * Qualquer sentido indeterminado deixa o dia indeterminado (valor null);
 * qualquer pendência deixa o dia pendente (o valor existe, mas não é confirmado).
 */
export function calcularDia(entrada: EntradaDiaMotor): ResultadoDiaMotor {
  const base = { cartao: entrada.cartao, dataServico: entrada.dataServico }
  const ida = calcularSentido({ ...base, pernas: entrada.itinerario.ida, rotulo: 'Ida' })
  // Limite diário do BUN em Niterói: a volta já sabe quantas viagens a ida usou.
  const volta = calcularSentido({
    ...base,
    pernas: entrada.itinerario.volta,
    rotulo: 'Volta',
    viagensNiteroiJaPagasNoDia: ida.viagensNiteroiPagas,
  })

  const vistos = new Set<string>()
  const pendencias: PendenciaMotor[] = []
  for (const p of [...ida.pendencias, ...volta.pendencias]) {
    const k = `${p.codigo}|${p.mensagem}`
    if (!vistos.has(k)) {
      vistos.add(k)
      pendencias.push(p)
    }
  }

  const indeterminado = ida.valorCentavos === null || volta.valorCentavos === null
  const valorCentavos = indeterminado ? null : (ida.valorCentavos as number) + (volta.valorCentavos as number)
  const status: StatusMotor = indeterminado ? 'indeterminado' : pendencias.length > 0 ? 'pendente' : 'confirmado'

  return {
    valorCentavos,
    status,
    ida,
    volta,
    pendencias,
    politicaIntegracao: ida.politicaIntegracao,
    regularizarCartao: ida.regularizarCartao || volta.regularizarCartao,
    // Mesmo cartão nos dois sentidos: o aviso é um só.
    avisos: ida.avisos.length ? ida.avisos : volta.avisos,
    explicacao: [
      ...ida.explicacao,
      ...volta.explicacao,
      {
        regra: 'Regras §2',
        texto: indeterminado
          ? 'Não dá para calcular o valor do dia: falta o valor de ida ou de volta.'
          : `Valor do dia = ida + volta = ${reais(ida.valorCentavos as number)} + ${reais(volta.valorCentavos as number)}.`,
      },
    ],
  }
}
