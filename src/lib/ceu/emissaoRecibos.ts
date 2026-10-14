import type { EntregaCEU } from '@/types/database'
import type { DadosEntrega } from '@/components/ceu/CeuReciboModal'
import { gerarReciboEPIColorido, gerarReciboUniformeColorido, type ReciboData } from '@/lib/ceuRecibos'
import { buscarEmpresaPorId } from '@/lib/empresas'
import { hojeBrasil } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'

/* ============================================================
   EMISSÃO DE RECIBOS CEU — lógica compartilhada
   Usada por Movimentações (individual e lote) e pela aba
   Relatórios → Por colaborador. Regras:
   - Recibo de UMA data e UM tipo só: o agrupamento é sempre
     colaborador + data_entrega + tipo (EPI × Uniforme/Crachá).
     Recibo emitido é imutável e não pode misturar datas/tipos
     (incidente de 04/08/2026: 7 números em duas datas e 41
     recibos misturando EPI com uniforme).
   - Número sequencial (migration 073): reemissão reutiliza o
     número gravado na entrega; 1ª emissão grava o próximo.
     Trava defensiva: número de entrega de outra data/tipo
     (resíduo do incidente) NUNCA é herdado — gera número novo.
   - Nome/subgrupo/CA vêm SEMPRE do snapshot da entrega (foto do
     item na data da entrega): recibos antigos não mudam quando
     o item é renomeado ou o CA é atualizado no cadastro. O
     cadastro do item só serve de fallback para entregas antigas
     sem esses campos no snapshot.
   - Situação gravada na entrega (Novo/Substituição/Troca/…)
   ============================================================ */

export interface EmissaoReciboDeps {
  proximoNumeroRecibo: () => Promise<string>
  registrarEmissaoRecibo: (ids: string[], numeroRecibo: string) => Promise<boolean>
}

type SnapshotItem = { nome?: string; tipo?: string; ca?: string; subgrupo?: string }

function snap(e: EntregaCEU): SnapshotItem {
  return (e.snapshot_item || {}) as SnapshotItem
}

function tipoDe(e: EntregaCEU): string {
  return e.item?.tipo || snap(e).tipo || 'Uniforme'
}

// Tipo do recibo: EPI separado; Uniforme/Crachá/Equipamento juntos.
function tipoReciboDe(e: EntregaCEU): 'EPI' | 'OUTRO' {
  return tipoDe(e) === 'EPI' ? 'EPI' : 'OUTRO'
}

// Chave do agrupamento obrigatório: colaborador + data + tipo do recibo.
function chaveGrupo(e: EntregaCEU): string {
  return `${e.colaborador_id}|${e.data_entrega}|${tipoReciboDe(e)}`
}

/**
 * Número do recibo de um grupo de entregas: reutiliza o já gravado;
 * se não houver, pega o próximo sequencial e grava nas entregas ainda
 * sem número (o que também as marca como recibo_emitido, bloqueando
 * a exclusão — regra de negócio).
 *
 * Trava defensiva (resíduo do incidente de 04/08/2026): só herda o
 * número se TODAS as entregas numeradas do grupo forem da mesma data
 * e do mesmo tipo das demais. Entrega numerada de outra data/tipo
 * indica número gravado por emissão antiga que misturava grupos —
 * nesse caso o número não é reutilizado e um número novo é gerado.
 */
export async function numeroDoGrupo(lista: EntregaCEU[], deps: EmissaoReciboDeps): Promise<string> {
  const dataGrupo = lista[0].data_entrega
  const tipoGrupo = tipoReciboDe(lista[0])
  const numeradas = lista.filter((e) => e.numero_recibo)
  const numeroHerdado = numeradas[0]?.numero_recibo || null
  const consistente = numeradas.every(
    (e) => e.data_entrega === dataGrupo && tipoReciboDe(e) === tipoGrupo
  )

  let numero: string
  if (numeroHerdado && consistente) {
    numero = numeroHerdado
  } else {
    if (numeroHerdado) {
      console.warn(
        '[CEU] numero_recibo não herdado: o grupo contém entrega numerada de outra data/tipo (resíduo de emissão antiga). Gerando número novo.',
        { numeroDescartado: numeroHerdado, dataGrupo, tipoGrupo }
      )
    }
    numero = await deps.proximoNumeroRecibo()
  }

  const semNumero = lista.filter((e) => !e.numero_recibo).map((e) => e.id)
  if (semNumero.length > 0) await deps.registrarEmissaoRecibo(semNumero, numero)
  return numero
}

function montarDadosEntrega(lista: EntregaCEU[], numero: string, departamentos: DepartamentoFuzzy[]): DadosEntrega {
  const colab = lista[0].colaborador
  return {
    colaborador: {
      nome: colab?.nome_completo || '—',
      matricula: colab?.matricula || '—',
      cargo: colab?.cargo || '—',
      // Decisão da gestão: recibos exibem APENAS o nome_curto resolvido
      // (nunca o texto legado sem acentos de colaboradores.departamento).
      departamento: nomeCurtoDepartamentoFuzzy(departamentos, colab?.departamento_id, colab?.departamento, colab?.empresa_id),
      cpf: colab?.cpf || '00000000000',
      data_admissao: colab?.data_admissao,
      empresa_id: colab?.empresa_id,
    },
    itens: lista.map((e) => ({
      nome: snap(e).nome || e.item?.nome || '—',
      grupo: tipoDe(e),
      subgrupo: snap(e).subgrupo || e.item?.subgrupo || '—',
      quantidade: e.quantidade || 1,
      ca: snap(e).ca || e.item?.ca || null,
      // Item devolvido sai como "Devolvido" no recibo (controle do que
      // ainda está com o colaborador); em aberto, mostra a situação da entrega.
      situacao: e.data_devolucao ? 'Devolvido' : e.situacao || 'Novo',
    })),
    dataEntrega: lista[0].data_entrega || hojeBrasil(),
    numeroRecibo: numero,
  }
}

/**
 * Prepara os grupos de recibo de UM colaborador para exibição no
 * CeuReciboModal, atribuindo/reutilizando os números. Um grupo por
 * data_entrega + tipo (EPI × Uniforme/Crachá) — recibo nunca mistura
 * datas nem tipos.
 */
export async function prepararGruposRecibo(
  entregasDoColaborador: EntregaCEU[],
  deps: EmissaoReciboDeps,
  departamentos: DepartamentoFuzzy[] = []
): Promise<DadosEntrega[]> {
  const porGrupo = new Map<string, EntregaCEU[]>()
  for (const e of entregasDoColaborador) {
    const chave = chaveGrupo(e)
    if (!porGrupo.has(chave)) porGrupo.set(chave, [])
    porGrupo.get(chave)!.push(e)
  }

  // Ordem determinística: por data; na mesma data, EPI antes.
  const listas = Array.from(porGrupo.values()).sort((a, b) => {
    const porData = (a[0].data_entrega || '').localeCompare(b[0].data_entrega || '')
    if (porData !== 0) return porData
    return (tipoReciboDe(a[0]) === 'EPI' ? 0 : 1) - (tipoReciboDe(b[0]) === 'EPI' ? 0 : 1)
  })

  const grupos: DadosEntrega[] = []
  for (const lista of listas) {
    const numero = await numeroDoGrupo(lista, deps)
    grupos.push(montarDadosEntrega(lista, numero, departamentos))
  }
  return grupos
}

/**
 * Gera o HTML de recibos em lote (colorido) para download/impressão:
 * UM recibo por grupo colaborador + data_entrega + tipo
 * (EPI × Uniforme/Crachá).
 */
export async function gerarRecibosLoteHTML(
  entregas: EntregaCEU[],
  deps: EmissaoReciboDeps,
  departamentos: DepartamentoFuzzy[] = []
): Promise<{ html: string; total: number }> {
  const grupos = new Map<string, EntregaCEU[]>()
  entregas.forEach((e) => {
    const chave = chaveGrupo(e)
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(e)
  })

  const recibosHTML: string[] = []
  // Um colaborador pode gerar vários grupos (datas/tipos distintos) —
  // a empresa é resolvida uma vez por empresa_id.
  const empresasPorId = new Map<string, Awaited<ReturnType<typeof buscarEmpresaPorId>>>()

  for (const entregasDoGrupo of grupos.values()) {
    const colab = entregasDoGrupo[0].colaborador
    if (!colab) continue

    const isEPI = tipoReciboDe(entregasDoGrupo[0]) === 'EPI'
    const empresaId = colab.empresa_id || ''
    if (!empresasPorId.has(empresaId)) empresasPorId.set(empresaId, await buscarEmpresaPorId(colab.empresa_id))
    const empresa = empresasPorId.get(empresaId)!
    const numeroRecibo = await numeroDoGrupo(entregasDoGrupo, deps)

    const data: ReciboData = {
      colaborador: {
        nome: colab.nome_completo || '—',
        matricula: colab.matricula || '—',
        funcao: colab.cargo || '—',
        departamento: nomeCurtoDepartamentoFuzzy(departamentos, colab.departamento_id, colab.departamento, colab.empresa_id),
        cpf: (colab.cpf || '').replace(/\D/g, ''),
        data_admissao: colab.data_admissao || null,
      },
      entregas: entregasDoGrupo.map((e) => ({
        item: {
          descricao: snap(e).nome || e.item?.nome || '—',
          numero_ca: snap(e).ca || e.item?.ca || null,
          grupo_macro: tipoDe(e),
          subgrupo: snap(e).subgrupo || e.item?.subgrupo || '—',
        },
        quantidade: e.quantidade,
        situacao: e.data_devolucao ? 'Devolvido' : e.situacao || 'Novo',
      })),
      dataEntrega: entregasDoGrupo[0].data_entrega,
      numeroRecibo,
      nomeEmpresa: empresa.nome,
      cnpjEmpresa: empresa.cnpj,
    }

    const html = isEPI ? gerarReciboEPIColorido(data) : gerarReciboUniformeColorido(data)
    recibosHTML.push(`<div class="recibo-page">${html}</div>`)
  }

  const htmlFinal = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibos em lote</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    .recibo-page { page-break-after: always; }
    .recibo-page:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  ${recibosHTML.join('')}
</body>
</html>`

  return { html: htmlFinal, total: recibosHTML.length }
}
