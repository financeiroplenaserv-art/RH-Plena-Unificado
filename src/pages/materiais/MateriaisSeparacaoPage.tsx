import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCheck, Download, ListChecks, Save } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { SeletorMes, Selo, StatusProdutosBadge } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useSeparacaoDeposito } from '@/hooks/useMateriaisCompras'
import { podeSepararDepositoMateriais } from '@/lib/permissoes'
import { formatarData, hojeBrasil } from '@/lib/utils'
import { competenciaDoMes } from '@/lib/materiais/painel'
import { quantidadeComUnidade } from '@/lib/materiais/unidades'
import { textoRota } from '@/lib/materiais/pedidos'
import { baixarExcelSeparacao } from '@/lib/materiais/excelCompraArquivo'
import {
  agruparSeparacaoPorContrato,
  descricaoSeparacao,
  edicaoInicialSeparacao,
  erroSeparacao,
  linhaSeparavel,
  montarPayloadSeparacao,
  situacaoSeparacao,
  type EdicaoDeposito,
  type GrupoSeparacao,
} from '@/lib/materiais/deposito'
import type { StatusProdutos } from '@/types/materiais'

// Aba Separação (migration 154 — decisão da gestora, 21/10/2026). Essex/RZK e Compra
// Avulsa entregam TUDO no depósito da Plena; o inspetor separa por posto (esta lista é a
// aba "SEPARAÇÃO OPER" da planilha) e a Antolimp leva junto na rota dela (os postos de
// "Depósito Plena" a própria Plena leva). Ao marcar o posto como separado, a linha conta
// como ENTREGUE ao posto — decisão a confirmar. Quem grava: gestor, mesa e inspetoria
// (banco: pode_movimentar_estoque_materiais); o financeiro só consulta.

type FiltroSituacao = 'todas' | 'a_separar' | 'aguardando' | 'separadas'

export function MateriaisSeparacaoPage() {
  const { user } = useAuth()
  const podeSeparar = user ? podeSepararDepositoMateriais(user.nivel_acesso) : false
  const [params] = useSearchParams()
  const sep = useSeparacaoDeposito()
  const [mes, setMes] = useState(() => {
    const m = params.get('mes') ?? ''
    return /^\d{4}-\d{2}$/.test(m) ? m : hojeBrasil().slice(0, 7)
  })
  const competencia = competenciaDoMes(mes)
  const [dataSeparacao, setDataSeparacao] = useState(hojeBrasil())
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas')
  const [rotaFiltro, setRotaFiltro] = useState('todas')
  const [edicoes, setEdicoes] = useState<Record<string, EdicaoDeposito>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  const { carregar } = sep
  useEffect(() => {
    carregar(competencia)
  }, [carregar, competencia])

  const linhas = useMemo(() => sep.dados?.linhas ?? [], [sep.dados])
  const grupos = useMemo(() => {
    return agruparSeparacaoPorContrato(linhas)
      .map((g): GrupoSeparacao => {
        const filtradas = g.linhas.filter((l) => {
          const s = situacaoSeparacao(l)
          if (situacao === 'a_separar') return s === 'a_separar'
          if (situacao === 'aguardando') return s === 'aguardando'
          if (situacao === 'separadas') return s === 'separada'
          return true
        })
        return { ...g, linhas: filtradas }
      })
      .filter((g) => g.linhas.length > 0)
      .filter((g) => rotaFiltro === 'todas' || (rotaFiltro === 'sem' ? g.rota == null : String(g.rota) === rotaFiltro))
  }, [linhas, situacao, rotaFiltro])

  const totais = useMemo(() => {
    let aSeparar = 0
    let aguardando = 0
    let feitas = 0
    for (const l of linhas) {
      const s = situacaoSeparacao(l)
      if (s === 'a_separar') aSeparar++
      else if (s === 'aguardando') aguardando++
      else feitas++
    }
    return { aSeparar, aguardando, feitas }
  }, [linhas])

  const salvar = async (g: GrupoSeparacao, separarTudo: boolean, chave: string) => {
    const { payload, erros } = montarPayloadSeparacao(g.linhas, edicoes, separarTudo)
    if (erros.length) return toast.error(`${erros.length} item(ns) com pendência — veja os avisos em vermelho.`)
    setSalvando(chave)
    const ok = await sep.registrar(payload, dataSeparacao || null)
    setSalvando(null)
    if (ok) {
      setEdicoes({})
      await carregar(competencia)
    }
  }

  const baixar = async () => {
    try {
      await baixarExcelSeparacao(linhas, competencia)
    } catch (e) {
      toast.error(`Não foi possível gerar o Excel: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
    }
  }

  if (sep.estruturaPendente) {
    return (
      <MateriaisShell>
        <PageHeader title="Separação no depósito" />
        <EstruturaPendente />
      </MateriaisShell>
    )
  }

  return (
    <MateriaisShell>
      <PageHeader
        title="Separação no depósito"
        description="O que chegou dos fornecedores que entregam no depósito da Plena, por posto. O inspetor separa e confirma; a Antolimp leva junto na rota (os postos de “Depósito Plena” a Plena leva)."
      >
        <Button variant="outline" onClick={baixar} disabled={linhas.length === 0}>
          <Download className="size-4" /> Baixar lista (Excel)
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="w-44">
            <SeletorMes id="sep-mes" valor={mes} onChange={setMes} rotulo="Competência" />
          </div>
          <div className="w-52 space-y-1.5">
            <Label htmlFor="sep-situacao">Situação</Label>
            <select id="sep-situacao" className={CLASSE_SELECT} value={situacao} onChange={(e) => setSituacao(e.target.value as FiltroSituacao)}>
              <option value="todas">Todas</option>
              <option value="a_separar">Chegou e falta separar</option>
              <option value="aguardando">Ainda não chegou</option>
              <option value="separadas">Já separadas</option>
            </select>
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="sep-rota">Rota</Label>
            <select id="sep-rota" className={CLASSE_SELECT} value={rotaFiltro} onChange={(e) => setRotaFiltro(e.target.value)}>
              <option value="todas">Todas</option>
              {[1, 2, 3, 4, 0].map((r) => (
                <option key={r} value={String(r)}>
                  {textoRota(r)}
                </option>
              ))}
              <option value="sem">Sem rota</option>
            </select>
          </div>
          {podeSeparar && (
            <div className="w-44 space-y-1.5">
              <Label htmlFor="sep-data">Data da separação</Label>
              <Input id="sep-data" type="date" className="tabular-nums" value={dataSeparacao} onChange={(e) => setDataSeparacao(e.target.value)} />
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {totais.aSeparar} a separar · {totais.aguardando} aguardando chegada · {totais.feitas} separada(s)
          </p>
        </section>

        {sep.loading && !sep.dados ? (
          <LoadingScreen className="h-48" />
        ) : (
          <DataTable title={`Separação de ${rotuloCompetencia(competencia)}`} count={grupos.length} minWidth={860}>
            {grupos.length === 0 ? (
              <EmptyState
                icon={<ListChecks className="size-6" />}
                title="Nada para separar"
                description="Aparecem aqui as compras já ENVIADAS a fornecedores que entregam no depósito Plena (marque o fornecedor em Fornecedores). Registre a chegada do total em Chegadas."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Veio de</TableHead>
                    <TableHead className="text-right">Comprado</TableHead>
                    <TableHead className="text-right">Chegou</TableHead>
                    <TableHead className="text-right">Separado</TableHead>
                    <TableHead>Motivo (se separou menos)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((g) => {
                    const pendentes = g.linhas.filter((l) => linhaSeparavel(l, edicoes[l.linha_id])).length
                    return (
                      <Fragment key={g.contratoId}>
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={6}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{g.contratoNome}</span>
                                <Selo tom={g.rota === 0 ? 'roxo' : 'cinza'}>{g.rota == null ? 'sem rota' : textoRota(g.rota).toLowerCase()}</Selo>
                                {g.concluido ? <Selo tom="verde">posto separado</Selo> : g.aSeparar > 0 ? <Selo tom="ambar">{g.aSeparar} a separar</Selo> : <Selo>aguardando chegada</Selo>}
                                <StatusProdutosBadge status={(g.linhas[0]?.status_pedido ?? 'aprovado') as StatusProdutos} />
                              </div>
                              {podeSeparar && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={salvando != null || g.aSeparar === 0}
                                    onClick={() => salvar(g, true, `tudo-${g.contratoId}`)}
                                  >
                                    <CheckCheck className="size-4" /> {salvando === `tudo-${g.contratoId}` ? 'Gravando…' : 'Separei tudo'}
                                  </Button>
                                  <Button size="sm" disabled={salvando != null || pendentes === 0} onClick={() => salvar(g, false, `sal-${g.contratoId}`)}>
                                    <Save className="size-4" /> {salvando === `sal-${g.contratoId}` ? 'Gravando…' : 'Salvar separação'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {g.linhas.map((l) => {
                          const s = situacaoSeparacao(l)
                          const e = edicoes[l.linha_id] ?? edicaoInicialSeparacao(l)
                          const erro = edicoes[l.linha_id] ? erroSeparacao(l, e) : null
                          const menor = l.qtd_recebida != null && Number(e.qtd.replace(',', '.')) < l.qtd_recebida
                          return (
                            <TableRow key={l.linha_id} className="align-top hover:bg-accent/40">
                              <TableCell className="pl-6 text-sm">
                                {descricaoSeparacao(l)}
                                {l.parte === 'extra' && <span className="ml-1 text-[11px] text-muted-foreground">(extra)</span>}
                                {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                <Link className="text-primary underline" to={`/materiais/compras/${l.compra_id}`}>
                                  {l.fornecedor_nome ?? 'Fornecedor'} · {l.compra_numero}
                                </Link>
                                {l.competencia_compra < competencia && <span className="block">de {rotuloCompetencia(l.competencia_compra)}</span>}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{quantidadeComUnidade(l.qtd_compra, l.unidade)}</TableCell>
                              <TableCell className="text-right tabular-nums">{l.qtd_recebida ?? <Selo>aguardando</Selo>}</TableCell>
                              <TableCell className="text-right">
                                {podeSeparar && s !== 'aguardando' && l.qtd_recebida !== 0 ? (
                                  <Input
                                    aria-label={`Separado — ${descricaoSeparacao(l)} — ${g.contratoNome}`}
                                    inputMode="decimal"
                                    className="ml-auto h-8 w-20 text-right tabular-nums"
                                    value={e.qtd}
                                    onChange={(ev) => setEdicoes((x) => ({ ...x, [l.linha_id]: { ...e, qtd: ev.target.value } }))}
                                  />
                                ) : (
                                  <span className="tabular-nums">{l.qtd_separada ?? '—'}</span>
                                )}
                                {l.qtd_separada != null && l.separado_em && (
                                  <span className="block text-[11px] text-muted-foreground tabular-nums">separado em {formatarData(l.separado_em)}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {podeSeparar && menor ? (
                                  <Input
                                    aria-label={`Motivo — ${descricaoSeparacao(l)} — ${g.contratoNome}`}
                                    placeholder="Ex.: quebrou / faltou"
                                    className="h-8 text-xs"
                                    maxLength={200}
                                    value={e.motivo}
                                    onChange={(ev) => setEdicoes((x) => ({ ...x, [l.linha_id]: { ...e, motivo: ev.target.value } }))}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">{l.qtd_separada != null && l.qtd_recebida != null && l.qtd_separada < l.qtd_recebida ? (l.motivo_entrega ?? '') : ''}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </DataTable>
        )}
      </div>
    </MateriaisShell>
  )
}
