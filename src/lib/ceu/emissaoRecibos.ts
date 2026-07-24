import type { EntregaCEU } from '@/types/database'
import type { DadosEntrega } from '@/components/ceu/CeuReciboModal'
import { gerarReciboEPIColorido, gerarReciboUniformeColorido, type ReciboData } from '@/lib/ceuRecibos'
import { buscarEmpresaPorId } from '@/lib/empresas'

/* ============================================================
   EMISSÃO DE RECIBOS CEU — lógica compartilhada
   Usada por Movimentações (individual e lote) e pela aba
   Relatórios → Por colaborador. Regras:
   - Recibo separado para EPI e para Uniforme/Crachá
   - Número sequencial (migration 073): reemissão reutiliza o
     número gravado na entrega; 1ª emissão grava o próximo
   - CA vem do snapshot da entrega (recibos antigos não mudam
     quando o CA do item é atualizado no cadastro)
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

/**
 * Número do recibo de um grupo de entregas: reutiliza o já gravado;
 * se não houver, pega o próximo sequencial e grava nas entregas ainda
 * sem número (o que também as marca como recibo_emitido, bloqueando
 * a exclusão — regra de negócio).
 */
async function numeroDoGrupo(lista: EntregaCEU[], deps: EmissaoReciboDeps): Promise<string> {
  let numero = lista.find((e) => e.numero_recibo)?.numero_recibo || null
  if (!numero) numero = await deps.proximoNumeroRecibo()
  const semNumero = lista.filter((e) => !e.numero_recibo).map((e) => e.id)
  if (semNumero.length > 0) await deps.registrarEmissaoRecibo(semNumero, numero)
  return numero
}

function montarDadosEntrega(lista: EntregaCEU[], numero: string): DadosEntrega {
  const colab = lista[0].colaborador
  return {
    colaborador: {
      nome: colab?.nome_completo || '—',
      matricula: colab?.matricula || '—',
      cargo: colab?.cargo || '—',
      departamento: colab?.departamento || '—',
      cpf: colab?.cpf || '00000000000',
      data_admissao: colab?.data_admissao,
      empresa_id: colab?.empresa_id,
    },
    itens: lista.map((e) => ({
      nome: e.item?.nome || snap(e).nome || '—',
      grupo: tipoDe(e),
      subgrupo: e.item?.subgrupo || snap(e).subgrupo || '—',
      quantidade: e.quantidade || 1,
      ca: e.item?.ca || snap(e).ca || null,
      // Item devolvido sai como "Devolvido" no recibo (controle do que
      // ainda está com o colaborador); em aberto, mostra a situação da entrega.
      situacao: e.data_devolucao ? 'Devolvido' : e.situacao || 'Novo',
    })),
    dataEntrega: lista[0].data_entrega || new Date().toISOString(),
    numeroRecibo: numero,
  }
}

/**
 * Prepara os grupos de recibo (EPI e/ou Uniforme-Crachá) de UM colaborador
 * para exibição no CeuReciboModal, atribuindo/reutilizando os números.
 */
export async function prepararGruposRecibo(
  entregasDoColaborador: EntregaCEU[],
  deps: EmissaoReciboDeps
): Promise<DadosEntrega[]> {
  const entregasEPI = entregasDoColaborador.filter((e) => tipoDe(e) === 'EPI')
  const entregasNaoEPI = entregasDoColaborador.filter((e) => tipoDe(e) !== 'EPI')

  const grupos: DadosEntrega[] = []
  for (const lista of [entregasEPI, entregasNaoEPI]) {
    if (lista.length === 0) continue
    const numero = await numeroDoGrupo(lista, deps)
    grupos.push(montarDadosEntrega(lista, numero))
  }
  return grupos
}

/**
 * Gera o HTML de recibos em lote (um por colaborador, colorido) para
 * download/impressão, agrupando as entregas por colaborador.
 */
export async function gerarRecibosLoteHTML(
  entregas: EntregaCEU[],
  deps: EmissaoReciboDeps
): Promise<{ html: string; total: number }> {
  const grupos = new Map<string, EntregaCEU[]>()
  entregas.forEach((e) => {
    if (!grupos.has(e.colaborador_id)) grupos.set(e.colaborador_id, [])
    grupos.get(e.colaborador_id)!.push(e)
  })

  const recibosHTML: string[] = []

  for (const entregasDoColab of grupos.values()) {
    const colab = entregasDoColab[0].colaborador
    if (!colab) continue

    const isEPI = entregasDoColab.some((e) => tipoDe(e) === 'EPI')
    const empresa = await buscarEmpresaPorId(colab.empresa_id)
    const numeroRecibo = await numeroDoGrupo(entregasDoColab, deps)

    const data: ReciboData = {
      colaborador: {
        nome: colab.nome_completo || '—',
        matricula: colab.matricula || '—',
        funcao: colab.cargo || '—',
        departamento: colab.departamento || '—',
        cpf: (colab.cpf || '').replace(/\D/g, ''),
        data_admissao: colab.data_admissao || null,
      },
      entregas: entregasDoColab.map((e) => ({
        item: {
          descricao: e.item?.nome || snap(e).nome || '—',
          numero_ca: e.item?.ca || snap(e).ca || null,
          grupo_macro: tipoDe(e),
          subgrupo: e.item?.subgrupo || snap(e).subgrupo || '—',
        },
        quantidade: e.quantidade,
        situacao: e.data_devolucao ? 'Devolvido' : e.situacao || 'Novo',
      })),
      dataEntrega: entregasDoColab[0].data_entrega,
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
