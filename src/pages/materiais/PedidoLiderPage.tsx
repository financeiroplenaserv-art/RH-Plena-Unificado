import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Link2Off, Loader2 } from 'lucide-react'
import { Button } from '@/components/corh/Button'
import {
  Ajuda,
  Declaracao,
  SecaoCrachas,
  SecaoPecas,
  SecaoProdutos,
} from '@/components/materiais/pedido/PedidoLiderSecoes'
import {
  CAMPO,
  apagarRascunho,
  lerRascunho,
  montarPayloadPedido,
  novaChave,
  salvarRascunho,
  type LinhaCeuForm,
  type LinhaProdutoForm,
} from '@/components/materiais/pedido/formPedido'
import {
  linhasIniciaisDoKit,
  secoesUsadas,
  textoDestino,
  tituloResumo,
  diaMesBrasilia,
  validarEnvioPedido,
  type ContextoPedido,
  type ResumoMes,
  type SecaoPedido,
} from '@/lib/materiais/pedidoLider'
import { carregarPedidoPublico, enviarPedidoPublico, ErroPedidoApi, type DadosPedidoPublico, type ResultadoEnvioPedido } from '@/services/pedidoMateriaisApi'
import { cn } from '@/lib/utils'

// Tela pública do líder: /pedido/:token (QR code no quadro do contrato).
// Sem login, sem layout do sistema e SEM nenhum dado pessoal — o líder digita
// nomes, peças e tamanhos; a conferência com o cadastro é interna.
// docs/PLANO_MATERIAIS_FASE1.md §4.2 e docs/materiais-referencia/ (textos dos
// Google Forms que esta tela substitui).

type Etapa = SecaoPedido | 'revisar'

const TITULOS: Record<Etapa, string> = {
  materiais: 'Materiais de limpeza',
  uniforme: 'Uniformes',
  epi: "EPI's",
  cracha: 'Crachás',
  portaria: 'Kit Portaria',
  revisar: 'Revisar e enviar',
}

const AJUDAS: Partial<Record<Etapa, string>> = {
  materiais:
    'O pedido já vem com o Kit Mensal do posto. Ajuste as quantidades: se não precisar de um item, deixe 0. Pedir acima do kit, ou antes da validade do último, pede uma justificativa.',
  uniforme:
    'Manter o uniforme sempre limpo e bem cuidado demonstra organização e profissionalismo. Lembre-se: pedidos fora do prazo serão analisados caso a caso; atenção à lavagem correta das peças; peças danificadas por mau uso e conservação poderão gerar desconto. Outras peças que não estão na lista: escreva na observação final.',
  epi: "O uso de EPIs é obrigatório por lei (CLT e NR-06) e essencial para a sua segurança. Use sempre corretamente; o uso do EPI é individual. Para botas e botinas, peça 02 números acima do calçado normal. Outros EPI's que não estão na lista: escreva na observação final.",
  cracha:
    'O uso do crachá é obrigatório para todos. Dependendo do motivo do pedido de novo crachá, poderá haver desconto. Cuide do seu crachá e sempre o mantenha bem conservado.',
  portaria:
    'Os materiais de Portaria são ferramentas de organização, controle de acesso e registro dos plantões. Faça o pedido com antecedência, antes que o material acabe: a entrega acontece no mês seguinte.',
}

function useMetaPrivada() {
  useEffect(() => {
    const tituloAnterior = document.title
    document.title = 'Pedido de materiais — Plena'
    const metas = [
      ['robots', 'noindex, nofollow'],
      ['referrer', 'no-referrer'],
    ].map(([name, content]) => {
      const m = document.createElement('meta')
      m.name = name
      m.content = content
      document.head.appendChild(m)
      return m
    })
    return () => {
      document.title = tituloAnterior
      metas.forEach((m) => m.remove())
    }
  }, [])
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md space-y-4 text-center">{children}</div>
    </div>
  )
}

function ResumoDoMes({ resumo, competencia, destino }: { resumo: ResumoMes; competencia: string; destino?: string | null }) {
  const titulo = tituloResumo(resumo, competencia)
  if (!titulo) return null
  const { uniforme_epi, cracha } = resumo.contagem
  return (
    <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4" aria-label="Pedido já enviado neste mês">
      <p className="font-semibold">{titulo}</p>
      {resumo.envios.length > 1 && (
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {resumo.envios.slice(1).map((e, i) => (
            <li key={i}>
              {e.tipo_pedido === 'extra' ? 'Pedido extra' : 'Complemento'} em {diaMesBrasilia(e.enviado_em)} por {e.seu_nome}
            </li>
          ))}
        </ul>
      )}
      {resumo.produtos.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Produtos já pedidos</p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {resumo.produtos.map((p, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2">
                <span>{p.descricao}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.quantidade} {p.unidade ?? ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(uniforme_epi > 0 || cracha > 0) && (
        <p className="text-sm">
          {uniforme_epi > 0 && `${uniforme_epi} ${uniforme_epi === 1 ? 'item' : 'itens'} de uniforme/EPI`}
          {uniforme_epi > 0 && cracha > 0 && ' e '}
          {cracha > 0 && `${cracha} ${cracha === 1 ? 'crachá' : 'crachás'}`} já pedidos.
        </p>
      )}
      {destino && <p className="text-sm text-muted-foreground">{destino}</p>}
    </section>
  )
}

export function PedidoLiderPage() {
  useMetaPrivada()
  const { token = '' } = useParams<{ token: string }>()
  const [dados, setDados] = useState<DadosPedidoPublico | null>(null)
  const [erro, setErro] = useState<ErroPedidoApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [produtos, setProdutos] = useState<LinhaProdutoForm[]>([])
  const [ceu, setCeu] = useState<LinhaCeuForm[]>([])
  const [termos, setTermos] = useState<Record<string, boolean>>({})
  const [seuNome, setSeuNome] = useState('')
  const [observacao, setObservacao] = useState('')
  const [etapa, setEtapa] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [errosEnvio, setErrosEnvio] = useState<string[]>([])
  const [enviado, setEnviado] = useState<{ resultado: ResultadoEnvioPedido; resumo: ResumoMes } | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const d = await carregarPedidoPublico(token)
      setDados(d)
      const rascunho = lerRascunho(token, d.janela.competencia)
      if (rascunho) {
        setProdutos(rascunho.produtos)
        setCeu(rascunho.ceu)
        setTermos(rascunho.termos ?? {})
        setSeuNome(rascunho.seuNome ?? '')
        setObservacao(rascunho.observacao ?? '')
      } else {
        const ctxInicial = {
          hoje: d.hoje,
          recebeLimpeza: d.contrato.recebe_limpeza,
          catalogo: d.catalogo,
          kit: d.kit,
          ultimasEntregas: d.ultimas_entregas,
        }
        const doKit = linhasIniciaisDoKit(ctxInicial)
        // Kit portaria: todos os itens da lista aparecem (0 se fora do kit).
        const portariaFora = d.catalogo
          .filter((c) => c.categoria === 'portaria' && !doKit.some((k) => k.item_id === c.id))
          .map((c) => ({ item_id: c.id, variacao_id: null, quantidade: 0 }))
        setProdutos(
          [...doKit, ...portariaFora].map((l) => ({
            chave: novaChave(),
            item_id: l.item_id,
            variacao_id: l.variacao_id,
            descricao_livre: '',
            quantidade: String(l.quantidade),
            justificativa: '',
          }))
        )
        setCeu([])
        setTermos({})
      }
    } catch (e) {
      setErro(e instanceof ErroPedidoApi ? e : new ErroPedidoApi('Erro ao abrir o pedido', 'interno', 0))
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    carregar()
  }, [carregar])

  const ctx: ContextoPedido | null = useMemo(
    () =>
      dados && {
        hoje: dados.hoje,
        recebeLimpeza: dados.contrato.recebe_limpeza,
        catalogo: dados.catalogo,
        kit: dados.kit,
        itensCeu: dados.itens_ceu,
        ultimasEntregas: dados.ultimas_entregas,
      },
    [dados]
  )

  const categoriaDe = useCallback(
    (itemId: string | null) => (itemId ? dados?.catalogo.find((c) => c.id === itemId)?.categoria : 'outros'),
    [dados]
  )
  const linhasMateriais = produtos.filter((l) => categoriaDe(l.item_id) !== 'portaria')
  const linhasPortaria = produtos.filter((l) => categoriaDe(l.item_id) === 'portaria')

  const etapas: Etapa[] = useMemo(() => {
    if (!dados) return []
    const lista: Etapa[] = []
    if (dados.contrato.recebe_limpeza) lista.push('materiais')
    if (dados.itens_ceu.some((i) => i.tipo === 'uniforme')) lista.push('uniforme')
    if (dados.itens_ceu.some((i) => i.tipo === 'epi')) lista.push('epi')
    lista.push('cracha')
    if (dados.catalogo.some((c) => c.categoria === 'portaria')) lista.push('portaria')
    lista.push('revisar')
    return lista
  }, [dados])

  // Rascunho no aparelho a cada alteração.
  useEffect(() => {
    if (!dados || enviado) return
    salvarRascunho(token, dados.janela.competencia, { produtos, ceu, termos, seuNome, observacao })
  }, [dados, enviado, token, produtos, ceu, termos, seuNome, observacao])

  const payload = () => montarPayloadPedido({ produtos, ceu, termos, seuNome, observacao })
  const validacao = ctx ? validarEnvioPedido(payload(), ctx) : null
  const usadas = validacao && ctx ? secoesUsadas(validacao.produtos, validacao.ceu, ctx.catalogo) : []

  const irPara = (i: number) => {
    setEtapa(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const enviar = async () => {
    if (!ctx || !dados || !validacao) return
    if (!validacao.ok) {
      setErrosEnvio(validacao.erros)
      return
    }
    setEnviando(true)
    setErrosEnvio([])
    try {
      const resultado = await enviarPedidoPublico(token, payload())
      apagarRascunho(token, dados.janela.competencia)
      const resumo: ResumoMes = {
        envios: [],
        produtos: validacao.produtos.map((p) => {
          const item = p.item_id ? ctx.catalogo.find((c) => c.id === p.item_id) : null
          const rotulo = p.variacao_id ? item?.variacoes.find((v) => v.id === p.variacao_id)?.rotulo : null
          return {
            descricao: item ? item.nome + (rotulo ? ` (${rotulo})` : '') : p.descricao_livre ?? 'Outros materiais',
            unidade: item?.unidade ?? null,
            quantidade: p.qtd_pedida,
          }
        }),
        contagem: {
          uniforme_epi: validacao.ceu.filter((c) => c.tipo !== 'cracha').length,
          cracha: validacao.ceu.filter((c) => c.tipo === 'cracha').length,
        },
      }
      setEnviado({ resultado, resumo })
      window.scrollTo({ top: 0 })
    } catch (e) {
      if (e instanceof ErroPedidoApi) {
        if (e.codigo === 'token_invalido' || e.codigo === 'fora_janela') {
          setErro(e)
        } else {
          setErrosEnvio(e.detalhes.length > 0 ? e.detalhes : [e.message])
        }
      } else {
        setErrosEnvio(['Erro ao enviar. Tente de novo.'])
      }
    } finally {
      setEnviando(false)
    }
  }

  // ---------------- Estados ----------------

  if (carregando) {
    return (
      <Centro>
        <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
        <p className="text-muted-foreground">Abrindo o pedido...</p>
      </Centro>
    )
  }

  if (erro || !dados || !ctx) {
    const invalido = erro?.codigo === 'token_invalido'
    const prazo = erro?.codigo === 'fora_janela'
    return (
      <Centro>
        {invalido ? (
          <Link2Off className="mx-auto size-10 text-muted-foreground" aria-hidden />
        ) : prazo ? (
          <Clock className="mx-auto size-10 text-amber-600" aria-hidden />
        ) : (
          <AlertTriangle className="mx-auto size-10 text-destructive" aria-hidden />
        )}
        <h1 className="text-xl font-semibold">
          {invalido ? 'Link inválido' : prazo ? 'Prazo encerrado' : 'Não foi possível abrir o pedido'}
        </h1>
        <p className="text-muted-foreground">{erro?.message ?? 'Tente de novo em instantes.'}</p>
        {!invalido && !prazo && (
          <Button size="lg" className="w-full" onClick={carregar}>
            Tentar de novo
          </Button>
        )}
      </Centro>
    )
  }

  const competencia = dados.janela.competencia
  const prazoTexto = `${dados.janela.prazo.slice(8, 10)}/${dados.janela.prazo.slice(5, 7)}`

  const cabecalho = (
    <header className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pedido de materiais · Plena</p>
        <h1 className="text-lg font-semibold leading-tight">{dados.contrato.nome}</h1>
        <p className="text-sm text-muted-foreground">
          {dados.janela.reaberta ? 'Pedido reaberto pelo escritório' : `Prazo: até ${prazoTexto}`}
        </p>
      </div>
    </header>
  )

  if (enviado) {
    const r = enviado.resultado
    const extra = r.virou_extra_produtos || r.virou_extra_ceu
    return (
      <div className="min-h-dvh bg-background text-foreground">
        {cabecalho}
        <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
          <div className="space-y-2 text-center">
            <CheckCircle2 className="mx-auto size-12 text-green-600" aria-hidden />
            <h2 className="text-xl font-semibold">Pedido enviado!</h2>
            <p className="text-muted-foreground">
              Protocolo <strong className="font-mono text-foreground">{r.protocolo}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              {extra
                ? 'Como o pedido do mês já tinha sido conferido, este envio virou um pedido extra.'
                : r.mesclado_produtos || r.mesclado_ceu
                  ? 'Este envio foi somado ao pedido do mês.'
                  : 'O inspetor vai conferir o pedido. Se algo não fechar, ele entra em contato.'}
            </p>
          </div>
          <ResumoDoMes
            resumo={{ ...enviado.resumo, envios: [{ tipo_pedido: 'mensal', origem: 'original', seu_nome: seuNome.trim(), enviado_em: new Date().toISOString() }] }}
            competencia={competencia}
          />
          <p className="text-center text-sm text-muted-foreground">♥ Agradecemos seu zelo e atenção no preenchimento. ♥</p>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => { setEnviado(null); setEtapa(0); carregar() }}>
            Fazer outro envio
          </Button>
        </main>
      </div>
    )
  }

  const destino = textoDestino(dados.destino)

  if (!dados.janela.aberta) {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        {cabecalho}
        <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-semibold">O prazo do pedido deste mês terminou (dia {prazoTexto}).</p>
            <p className="text-sm">Fale com o inspetor: ele pode reabrir o pedido do seu posto.</p>
          </div>
          <ResumoDoMes resumo={dados.resumo} competencia={competencia} />
        </main>
      </div>
    )
  }

  const atual = etapas[Math.min(etapa, etapas.length - 1)]
  const ultima = etapa >= etapas.length - 1

  return (
    <div className="min-h-dvh bg-background pb-28 text-foreground">
      {cabecalho}
      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        {etapa === 0 && <ResumoDoMes resumo={dados.resumo} competencia={competencia} destino={destino} />}

        <nav aria-label="Etapas do pedido" className="-mx-4 overflow-x-auto px-4">
          <ol className="flex gap-2">
            {etapas.map((e, i) => (
              <li key={e}>
                <button
                  type="button"
                  onClick={() => irPara(i)}
                  aria-current={i === etapa ? 'step' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm',
                    i === etapa ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {i + 1}. {TITULOS[e]}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <h2 className="text-xl font-semibold">{TITULOS[atual]}</h2>
        {AJUDAS[atual] && <Ajuda>{AJUDAS[atual]}</Ajuda>}

        {atual === 'materiais' && (
          <SecaoProdutos
            linhas={linhasMateriais}
            setLinhas={(f) => setProdutos((ls) => [...f(ls.filter((l) => categoriaDe(l.item_id) !== 'portaria')), ...ls.filter((l) => categoriaDe(l.item_id) === 'portaria')])}
            catalogo={dados.catalogo.filter((c) => c.categoria !== 'portaria')}
            ctx={ctx}
            permiteOutros
          />
        )}
        {atual === 'portaria' && (
          <SecaoProdutos
            linhas={linhasPortaria}
            setLinhas={(f) => setProdutos((ls) => [...ls.filter((l) => categoriaDe(l.item_id) !== 'portaria'), ...f(ls.filter((l) => categoriaDe(l.item_id) === 'portaria'))])}
            catalogo={dados.catalogo.filter((c) => c.categoria === 'portaria')}
            ctx={ctx}
            permiteOutros={false}
          />
        )}
        {(atual === 'uniforme' || atual === 'epi') && <SecaoPecas tipo={atual} linhas={ceu} setLinhas={setCeu} itens={dados.itens_ceu} />}
        {atual === 'cracha' && <SecaoCrachas linhas={ceu} setLinhas={setCeu} />}

        {atual !== 'revisar' && usadas.includes(atual) && (
          <Declaracao secao={atual} marcado={!!termos[atual]} onChange={(v) => setTermos((t) => ({ ...t, [atual]: v }))} />
        )}

        {atual === 'revisar' && validacao && (
          <div className="space-y-4">
            {destino && <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{destino}</p>}
            <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
              {etapas
                .filter((e): e is SecaoPedido => e !== 'revisar')
                .map((e) => {
                  const qtd =
                    e === 'materiais'
                      ? validacao.produtos.filter((p) => categoriaDe(p.item_id) !== 'portaria').length
                      : e === 'portaria'
                        ? validacao.produtos.filter((p) => categoriaDe(p.item_id) === 'portaria').length
                        : validacao.ceu.filter((c) => c.tipo === e).length
                  const semTermo = usadas.includes(e) && !termos[e]
                  return (
                    <li key={e} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span>{TITULOS[e]}</span>
                      <span className={cn('tabular-nums', semTermo ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
                        {qtd === 0 ? 'nada pedido' : `${qtd} ${qtd === 1 ? 'item' : 'itens'}`}
                        {semTermo && ' · falta a declaração'}
                      </span>
                    </li>
                  )
                })}
            </ul>
            {usadas
              .filter((s) => !termos[s])
              .map((s) => (
                <Declaracao key={s} secao={s} marcado={false} onChange={(v) => setTermos((t) => ({ ...t, [s]: v }))} />
              ))}
            <div className="space-y-1.5">
              <label htmlFor="seu-nome" className="text-sm font-medium">
                Seu nome *
              </label>
              <input
                id="seu-nome"
                className={CAMPO}
                value={seuNome}
                maxLength={120}
                autoComplete="name"
                onChange={(e) => setSeuNome(e.target.value)}
                placeholder="Quem está fazendo o pedido para a equipe"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="observacao" className="text-sm font-medium">
                Gostaria de deixar alguma informação?
              </label>
              <textarea
                id="observacao"
                className={cn(CAMPO, 'min-h-24')}
                value={observacao}
                maxLength={500}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Nossa equipe está pronta para te ouvir."
              />
            </div>
            {errosEnvio.length > 0 && (
              <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-semibold">Confira antes de enviar:</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {errosEnvio.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => irPara(etapa - 1)} disabled={etapa === 0 || enviando}>
            <ChevronLeft className="size-5" /> Voltar
          </Button>
          {ultima ? (
            <Button size="lg" className="flex-[2]" onClick={enviar} disabled={enviando}>
              {enviando ? <Loader2 className="size-5 animate-spin" /> : null} Enviar pedido
            </Button>
          ) : (
            <Button size="lg" className="flex-[2]" onClick={() => irPara(etapa + 1)}>
              Próximo <ChevronRight className="size-5" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

