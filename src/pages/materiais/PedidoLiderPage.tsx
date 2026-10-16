import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Link2Off, Loader2 } from 'lucide-react'
import { Button } from '@/components/corh/Button'
import {
  Ajuda,
  Declaracao,
  MensagemErro,
  SecaoCrachas,
  SecaoProdutos,
  SecaoUniformes,
} from '@/components/materiais/pedido/PedidoLiderSecoes'
import {
  CAMPO,
  apagarRascunho,
  errosDe,
  lerRascunho,
  linhasKitDoForm,
  montarPayloadPedido,
  reconciliarRascunhoComKit,
  salvarRascunho,
  type LinhaCrachaForm,
  type LinhaPecaForm,
  type LinhaProdutoForm,
  type PessoaForm,
  type SecaoProduto,
} from '@/components/materiais/pedido/formPedido'
import {
  secoesUsadas,
  textoDestino,
  tituloResumo,
  diaMesBrasilia,
  validarEnvioPedido,
  type ContextoPedido,
  type ErroCampo,
  type ItemCeuPublico,
  type ItemPublico,
  type LinhaProdutoRpc,
  type ResumoMes,
  type SecaoPedido,
} from '@/lib/materiais/pedidoLider'
import { carregarPedidoPublico, enviarPedidoPublico, ErroPedidoApi, type DadosPedidoPublico, type ResultadoEnvioPedido } from '@/services/pedidoMateriaisApi'
import { cn } from '@/lib/utils'

// Tela pública do líder: /pedido/:token (QR code no quadro do contrato).
// Sem login e sem o layout do sistema. Redesenho de 14/10/2026 para
// AFUNILAR o pedido (público: ASGs com dificuldade de preenchimento):
// - produtos (conceito de 16/10/2026): "Seu kit do mês" é o que o posto VAI
//   RECEBER — o líder só confirma, tira ou diminui (sem motivo); o que passar
//   do kit vai em "Precisa de mais alguma coisa?" (a mais de um item do kit,
//   "Preciso de outro item" com busca tolerante a erro, ou "Não achei,
//   enviar assim"), com motivo OPCIONAL;
// - uniforme/EPI: a pessoa é escolhida por toque na lista da equipe
//   (primeiro nome + inicial — único dado pessoal do link, decisão da gestão
//   de 09/10 reiterada em 14/10/2026) e só aparecem as peças da função dela,
//   com os tamanhos em botões;
// - erros: recalculados a cada alteração — somem assim que o campo é
//   corrigido; linha não usada é ignorada (nem erro, nem pendência).
// docs/PLANO_MATERIAIS_FASE1.md §4.2.

type Etapa = 'materiais' | 'portaria' | 'pecas' | 'cracha' | 'revisar'

const TITULOS: Record<Etapa, string> = {
  materiais: 'Materiais de limpeza',
  portaria: 'Kit Portaria',
  pecas: 'Uniformes e EPIs',
  cracha: 'Crachás',
  revisar: 'Revisar e enviar',
}

const AJUDAS: Partial<Record<Etapa, string>> = {
  materiais: 'Confira o kit do mês. Se precisar de mais alguma coisa, peça logo abaixo do kit.',
  portaria:
    'Os materiais de Portaria são para organização, controle de acesso e registro dos plantões. Confira o kit e, se precisar, peça mais abaixo.',
  pecas:
    'Toque no nome de quem precisa, depois na peça e no tamanho. Para botas e botinas, peça 2 números acima do calçado normal. Peças danificadas por mau uso poderão gerar desconto.',
  cracha: 'O uso do crachá é obrigatório. Dependendo do motivo do pedido de novo crachá, poderá haver desconto.',
}

/** Declarações que cada etapa pode exigir. */
const TERMOS_DA_ETAPA: Record<Etapa, SecaoPedido[]> = {
  materiais: ['materiais'],
  portaria: ['portaria'],
  pecas: ['uniforme', 'epi'],
  cracha: ['cracha'],
  revisar: [],
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
    <section className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4" aria-label="Pedido já enviado neste mês">
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
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
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

/** Itens CEU (um por tamanho) a partir das peças do contrato. */
function itensCeuDasPecas(d: DadosPedidoPublico): ItemCeuPublico[] {
  const vistos = new Set<string>()
  const lista: ItemCeuPublico[] = []
  for (const p of d.pecas) {
    for (const o of p.opcoes) {
      if (vistos.has(o.item_id)) continue
      vistos.add(o.item_id)
      lista.push({ id: o.item_id, nome: p.rotulo, tipo: p.tipo })
    }
  }
  return lista
}

/** Sublista da revisão final (kit do mês, pedido extra ou uniforme/EPI/crachá). */
function ListaRevisao({ titulo, itens }: { titulo?: string; itens: { rotulo: string; qtd: string; destaque?: boolean }[] }) {
  return (
    <div className="border-t border-border px-4 py-2">
      {titulo && <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>}
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {itens.map((it, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">{it.rotulo}</span>
            <span className={cn('shrink-0 tabular-nums', it.destaque && 'font-medium text-foreground')}>{it.qtd}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PedidoLiderPage() {
  useMetaPrivada()
  const { token = '' } = useParams<{ token: string }>()
  const [dados, setDados] = useState<DadosPedidoPublico | null>(null)
  const [erro, setErro] = useState<ErroPedidoApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [produtos, setProdutos] = useState<LinhaProdutoForm[]>([])
  const [itensBusca, setItensBusca] = useState<ItemPublico[]>([])
  const [pessoas, setPessoas] = useState<PessoaForm[]>([])
  const [pecasForm, setPecasForm] = useState<LinhaPecaForm[]>([])
  const [crachas, setCrachas] = useState<LinhaCrachaForm[]>([])
  const [termos, setTermos] = useState<Record<string, boolean>>({})
  const [seuNome, setSeuNome] = useState('')
  const [observacao, setObservacao] = useState('')
  const [etapa, setEtapa] = useState(0)
  /** Etapas em que o líder já tentou avançar/enviar: só nelas os erros aparecem (e somem ao corrigir). */
  const [tentou, setTentou] = useState<Set<Etapa>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [errosServidor, setErrosServidor] = useState<string[]>([])
  const [enviado, setEnviado] = useState<{ resultado: ResultadoEnvioPedido; resumo: ResumoMes; seuNome: string } | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const d = await carregarPedidoPublico(token)
      setDados(d)
      setTentou(new Set())
      setErrosServidor([])
      const rascunho = lerRascunho(token, d.janela.competencia)
      if (rascunho) {
        const refs = new Set(d.equipe.map((m) => m.ref))
        // Pessoa que saiu da equipe desde o rascunho some (o servidor recusaria).
        const pessoasOk = rascunho.pessoas.filter((p) => !p.ref || refs.has(p.ref))
        const chavesOk = new Set(pessoasOk.map((p) => p.chave))
        const pecasOk = new Set(d.pecas.map((p) => p.id))
        // O kit pode ter mudado no meio do mês: reconcilia o rascunho com o kit atual.
        const rec = reconciliarRascunhoComKit(rascunho, {
          hoje: d.hoje,
          recebeLimpeza: d.contrato.recebe_limpeza,
          catalogo: d.catalogo,
          kit: d.kit,
          ultimasEntregas: d.ultimas_entregas,
          kitConfirmado: !!d.kit_confirmado,
        })
        setProdutos(rec.produtos)
        setItensBusca(rec.itensBusca)
        setPessoas(pessoasOk)
        setPecasForm(rascunho.pecas.filter((l) => chavesOk.has(l.pessoa) && pecasOk.has(l.peca_id)))
        setCrachas(rascunho.crachas.filter((l) => !l.ref || refs.has(l.ref)))
        setTermos(rascunho.termos ?? {})
        setSeuNome(rascunho.seuNome ?? '')
        setObservacao(rascunho.observacao ?? '')
      } else {
        setProdutos(
          linhasKitDoForm({
            hoje: d.hoje,
            recebeLimpeza: d.contrato.recebe_limpeza,
            catalogo: d.catalogo,
            kit: d.kit,
            ultimasEntregas: d.ultimas_entregas,
            kitConfirmado: !!d.kit_confirmado,
          })
        )
        setItensBusca([])
        setPessoas([])
        setPecasForm([])
        setCrachas([])
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

  const ctx: ContextoPedido | null = useMemo(() => {
    if (!dados) return null
    const ids = new Set(dados.catalogo.map((c) => c.id))
    return {
      hoje: dados.hoje,
      recebeLimpeza: dados.contrato.recebe_limpeza,
      catalogo: [...dados.catalogo, ...itensBusca.filter((i) => !ids.has(i.id))],
      kit: dados.kit,
      itensCeu: itensCeuDasPecas(dados),
      pecas: dados.pecas,
      equipe: dados.equipe,
      ultimasEntregas: dados.ultimas_entregas,
      kitConfirmado: !!dados.kit_confirmado,
    }
  }, [dados, itensBusca])

  const etapas: Etapa[] = useMemo(() => {
    if (!dados) return []
    const lista: Etapa[] = []
    const kitPortaria = dados.catalogo.some((c) => c.categoria === 'portaria')
    if (dados.contrato.recebe_limpeza) lista.push('materiais')
    if (kitPortaria || !dados.contrato.recebe_limpeza) lista.push('portaria')
    if (dados.pecas.length > 0) lista.push('pecas')
    lista.push('cracha', 'revisar')
    return lista
  }, [dados])

  // Rascunho no aparelho a cada alteração.
  useEffect(() => {
    if (!dados || enviado) return
    salvarRascunho(token, dados.janela.competencia, {
      versao: 3,
      produtos,
      itensBusca,
      pessoas,
      pecas: pecasForm,
      crachas,
      termos,
      seuNome,
      observacao,
    })
  }, [dados, enviado, token, produtos, itensBusca, pessoas, pecasForm, crachas, termos, seuNome, observacao])

  const rascunhoAtual = { versao: 3 as const, produtos, itensBusca, pessoas, pecas: pecasForm, crachas, termos, seuNome, observacao }
  const payload = () => montarPayloadPedido(rascunhoAtual, dados?.pecas ?? [])
  // Recalculada a cada render: corrigiu o campo, o aviso some na hora.
  const validacao = ctx ? validarEnvioPedido(payload(), ctx) : null
  const usadas = validacao && ctx ? secoesUsadas(validacao.produtos, validacao.ceu, ctx.catalogo, ctx.recebeLimpeza) : []
  const erros = validacao?.errosCampo ?? []

  /** Etapa de cada erro: pela chave da linha; sem chave, a revisão. */
  const etapaDoErro = (e: ErroCampo): Etapa => {
    if (e.chave) {
      const prod = produtos.find((l) => l.chave === e.chave)
      if (prod) return prod.secao
      if (pecasForm.some((l) => l.chave === e.chave)) return 'pecas'
      if (crachas.some((l) => l.chave === e.chave)) return 'cracha'
    }
    return 'revisar'
  }
  const termosFaltando = (e: Etapa) => TERMOS_DA_ETAPA[e].filter((s) => usadas.includes(s) && !termos[s])
  const errosDaEtapa = (e: Etapa) => erros.filter((x) => x.campo !== 'termos' && x.campo !== 'vazio' && etapaDoErro(x) === e)
  const pendenciasDaEtapa = (e: Etapa) => errosDaEtapa(e).length + termosFaltando(e).length
  const visiveis = (e: Etapa) => (tentou.has(e) ? erros.filter((x) => etapaDoErro(x) === e) : [])

  const irPara = (i: number) => {
    setEtapa(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Depois de marcar "tentou": rola até o primeiro cartão com erro (no render seguinte). */
  const rolarParaPrimeiroErro = () => {
    setTimeout(() => {
      document.querySelector('[data-erro="true"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  const avancar = () => {
    const atual = etapas[etapa]
    if (pendenciasDaEtapa(atual) > 0) {
      setTentou((t) => new Set(t).add(atual))
      rolarParaPrimeiroErro()
      return
    }
    irPara(etapa + 1)
  }

  const enviar = async () => {
    if (!ctx || !dados || !validacao) return
    if (!validacao.ok) {
      setTentou(new Set(etapas))
      setErrosServidor([])
      rolarParaPrimeiroErro()
      return
    }
    setEnviando(true)
    setErrosServidor([])
    try {
      const resultado = await enviarPedidoPublico(token, payload())
      apagarRascunho(token, dados.janela.competencia)
      const resumo: ResumoMes = {
        envios: [],
        // Kit + extra do mesmo item somam numa linha; item tirado do kit (0) não aparece.
        produtos: [
          ...validacao.produtos
            .filter((p) => p.qtd_pedida > 0)
            .reduce((m, p) => {
              const item = p.item_id ? ctx.catalogo.find((c) => c.id === p.item_id) : null
              const rotulo = p.variacao_id ? item?.variacoes.find((v) => v.id === p.variacao_id)?.rotulo : null
              const chave = p.item_id ? `${p.item_id}|${p.variacao_id ?? ''}` : `livre|${p.descricao_livre}`
              const atual = m.get(chave)
              if (atual) atual.quantidade += p.qtd_pedida
              else
                m.set(chave, {
                  descricao: item ? item.nome + (rotulo ? ` (${rotulo})` : '') : p.descricao_livre ?? 'Outro item',
                  unidade: item?.unidade ?? null,
                  quantidade: p.qtd_pedida,
                })
              return m
            }, new Map<string, ResumoMes['produtos'][number]>())
            .values(),
        ],
        contagem: {
          uniforme_epi: validacao.ceu.filter((c) => c.tipo !== 'cracha').length,
          cracha: validacao.ceu.filter((c) => c.tipo === 'cracha').length,
        },
      }
      setEnviado({ resultado, resumo, seuNome: seuNome.trim() })
      window.scrollTo({ top: 0 })
    } catch (e) {
      if (e instanceof ErroPedidoApi) {
        if (e.codigo === 'token_invalido' || e.codigo === 'fora_janela') {
          setErro(e)
        } else {
          setErrosServidor(e.detalhes.length > 0 ? e.detalhes : [e.message])
        }
      } else {
        setErrosServidor(['Erro ao enviar. Tente de novo.'])
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
                  : r.kit_aprovado && !r.tem_extras
                    ? 'Seu kit do mês está confirmado.'
                    : 'O inspetor vai conferir o pedido. Se algo não fechar, ele entra em contato.'}
            </p>
            {r.kit_aprovado && r.tem_extras && (
              <p className="text-sm text-muted-foreground">O kit do mês está confirmado. O pedido extra passa pelo inspetor.</p>
            )}
          </div>
          <ResumoDoMes
            resumo={{ ...enviado.resumo, envios: [{ tipo_pedido: 'mensal', origem: 'original', seu_nome: enviado.seuNome, enviado_em: new Date().toISOString() }] }}
            competencia={competencia}
          />
          <p className="text-center text-sm text-muted-foreground">Agradecemos seu zelo e atenção no preenchimento.</p>
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
          <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-semibold">O prazo do pedido deste mês terminou (dia {prazoTexto}).</p>
            <p className="text-sm">Fale com o inspetor: ele pode reabrir o pedido do seu posto.</p>
          </div>
          <ResumoDoMes resumo={dados.resumo} competencia={competencia} />
        </main>
      </div>
    )
  }

  const indice = Math.min(etapa, etapas.length - 1)
  const atual = etapas[indice]
  const ultima = indice >= etapas.length - 1
  const errosVisiveis = visiveis(atual)
  const mostrarTermoErro = tentou.has(atual)

  const secaoProdutos = (secao: SecaoProduto) => (
    <SecaoProdutos
      linhas={produtos.filter((l) => l.secao === secao)}
      setLinhas={(f) => setProdutos((ls) => [...ls.filter((l) => l.secao !== secao), ...f(ls.filter((l) => l.secao === secao))])}
      ctx={ctx}
      erros={errosVisiveis}
      token={token}
      secao={secao}
      onItemBusca={(item) => setItensBusca((is) => (is.some((i) => i.id === item.id) ? is : [...is, item]))}
    />
  )

  // Pendências por etapa (mostradas na revisão depois de "Enviar").
  const pendentes = etapas.filter((e) => e !== 'revisar' && pendenciasDaEtapa(e) > 0)
  const itensCeuPorId = new Map(ctx.itensCeu.map((i) => [i.id, i.nome]))
  const secaoDoProduto = (p: LinhaProdutoRpc): SecaoProduto => {
    if (p.item_id) return ctx.catalogo.find((c) => c.id === p.item_id)?.categoria === 'portaria' ? 'portaria' : 'materiais'
    return produtos.find((l) => !l.item_id && l.descricao_livre.trim() === p.descricao_livre)?.secao ?? 'materiais'
  }
  const rotuloProduto = (p: LinhaProdutoRpc) => {
    const item = p.item_id ? ctx.catalogo.find((c) => c.id === p.item_id) : null
    const rotuloVar = p.variacao_id ? item?.variacoes.find((v) => v.id === p.variacao_id)?.rotulo : null
    return item ? item.nome + (rotuloVar ? ` (${rotuloVar})` : '') : (p.descricao_livre ?? 'Outro item')
  }
  const unidadeProduto = (p: LinhaProdutoRpc) => {
    const u = p.item_id ? ctx.catalogo.find((c) => c.id === p.item_id)?.unidade : null
    return u ? ` ${u}` : ''
  }

  return (
    <div className="min-h-dvh bg-background pb-28 text-foreground">
      {cabecalho}
      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        {indice === 0 && <ResumoDoMes resumo={dados.resumo} competencia={competencia} destino={destino} />}

        <nav aria-label="Etapas do pedido" className="-mx-4 overflow-x-auto px-4">
          <ol className="flex gap-2">
            {etapas.map((e, i) => (
              <li key={e}>
                <button
                  type="button"
                  onClick={() => irPara(i)}
                  aria-current={i === indice ? 'step' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-3 py-2 text-sm',
                    i === indice ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                    tentou.has(e) && pendenciasDaEtapa(e) > 0 && i !== indice && 'border-red-400 text-red-700 dark:text-red-400'
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

        {atual === 'materiais' && secaoProdutos('materiais')}
        {atual === 'portaria' && secaoProdutos('portaria')}
        {atual === 'pecas' && (
          <SecaoUniformes
            pessoas={pessoas}
            setPessoas={setPessoas}
            linhas={pecasForm}
            setLinhas={setPecasForm}
            pecas={dados.pecas}
            equipe={dados.equipe}
            semKitUniforme={dados.sem_kit_uniforme}
            erros={errosVisiveis}
          />
        )}
        {atual === 'cracha' && <SecaoCrachas linhas={crachas} setLinhas={setCrachas} equipe={dados.equipe} erros={errosVisiveis} />}

        {atual !== 'revisar' &&
          TERMOS_DA_ETAPA[atual]
            .filter((s) => usadas.includes(s))
            .map((s) => (
              <Declaracao key={s} secao={s} marcado={!!termos[s]} erro={mostrarTermoErro} onChange={(v) => setTermos((t) => ({ ...t, [s]: v }))} />
            ))}
        {atual !== 'revisar' && mostrarTermoErro && termosFaltando(atual).length > 0 && (
          <MensagemErro mensagens={['Marque a declaração para continuar.']} />
        )}

        {atual === 'revisar' && validacao && (
          <div className="space-y-4">
            {destino && <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm">{destino}</p>}
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card text-sm">
              {etapas
                .filter((e) => e !== 'revisar')
                .map((e) => {
                  const ehProduto = e === 'materiais' || e === 'portaria'
                  const produtosDaSecao = ehProduto ? validacao.produtos.filter((p) => secaoDoProduto(p) === e) : []
                  const kitDaSecao = produtosDaSecao.filter((p) => p.parte === 'kit')
                  const extrasDaSecao = produtosDaSecao.filter((p) => p.parte === 'extra')
                  const qtd = ehProduto
                    ? produtosDaSecao.filter((p) => p.qtd_pedida > 0).length
                    : e === 'pecas'
                      ? validacao.ceu.filter((c) => c.tipo !== 'cracha').length
                      : validacao.ceu.filter((c) => c.tipo === 'cracha').length
                  // Lista compacta: uniforme/EPI (peça + tamanho + pessoa) e
                  // crachá (pessoa + motivo). Produtos têm duas listas: "Kit do
                  // mês" (com o que o líder tirou ou diminuiu) e "Pedido extra".
                  const itensCeu: { rotulo: string; qtd: string }[] = ehProduto
                    ? []
                    : validacao.ceu
                        .filter((c) => (e === 'pecas' ? c.tipo !== 'cracha' : c.tipo === 'cracha'))
                        .map((c) =>
                          c.tipo === 'cracha'
                            ? { rotulo: `${c.nome_digitado}${c.cracha_motivo ? ` — ${c.cracha_motivo}` : ''}`, qtd: '1' }
                            : {
                                rotulo: `${(c.item_id && itensCeuPorId.get(c.item_id)) || 'Peça'}${c.tamanho ? ` — Tam. ${c.tamanho}` : ''} · ${c.nome_digitado}`,
                                qtd: String(c.qtd_pedida),
                              }
                        )
                  const pend = tentou.has('revisar') && pendenciasDaEtapa(e) > 0
                  return (
                    <li key={e}>
                      <button type="button" onClick={() => irPara(etapas.indexOf(e))} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                        <span>{TITULOS[e]}</span>
                        <span className={cn('tabular-nums', pend ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted-foreground')}>
                          {pend ? 'falta corrigir' : qtd === 0 ? 'nada pedido' : `${qtd} ${qtd === 1 ? 'item' : 'itens'}`}
                        </span>
                      </button>
                      {kitDaSecao.length > 0 && (
                        <ListaRevisao
                          titulo="Kit do mês"
                          itens={kitDaSecao.map((p) => ({
                            rotulo: rotuloProduto(p),
                            qtd:
                              p.qtd_pedida === 0
                                ? 'não precisa este mês'
                                : p.qtd_kit != null && p.qtd_pedida < p.qtd_kit
                                  ? `${p.qtd_pedida} de ${p.qtd_kit}${unidadeProduto(p)}`
                                  : `${p.qtd_pedida}${unidadeProduto(p)}`,
                            destaque: p.qtd_kit != null && p.qtd_pedida < p.qtd_kit,
                          }))}
                        />
                      )}
                      {extrasDaSecao.length > 0 && (
                        <ListaRevisao
                          titulo="Pedido extra"
                          itens={extrasDaSecao.map((p) => ({
                            rotulo: `${rotuloProduto(p)}${p.parte === 'extra' && p.excecao_acima_kit ? ' (a mais)' : ''}`,
                            qtd: `${p.qtd_pedida}${unidadeProduto(p)}`,
                          }))}
                        />
                      )}
                      {itensCeu.length > 0 && <ListaRevisao itens={itensCeu} />}
                    </li>
                  )
                })}
            </ul>
            {tentou.has('revisar') && pendentes.length > 0 && (
              <MensagemErro mensagens={[`Falta corrigir: ${pendentes.map((e) => TITULOS[e]).join(', ')}. Toque na etapa para ver.`]} />
            )}
            {usadas
              .filter((s) => !termos[s])
              .map((s) => (
                <Declaracao key={s} secao={s} marcado={false} erro={tentou.has('revisar')} onChange={(v) => setTermos((t) => ({ ...t, [s]: v }))} />
              ))}
            <div className="space-y-1.5" data-erro={tentou.has('revisar') && errosDe(erros, null, 'seu_nome').length > 0 ? 'true' : undefined}>
              <label htmlFor="seu-nome" className="text-base font-medium">
                Seu nome *
              </label>
              <input
                id="seu-nome"
                className={cn(CAMPO, tentou.has('revisar') && errosDe(erros, null, 'seu_nome').length > 0 && 'border-red-500')}
                value={seuNome}
                maxLength={120}
                autoComplete="name"
                onChange={(e) => setSeuNome(e.target.value)}
                placeholder="Quem está fazendo o pedido para a equipe"
              />
              {tentou.has('revisar') && <MensagemErro mensagens={errosDe(erros, null, 'seu_nome')} />}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="observacao" className="text-base font-medium">
                Gostaria de deixar alguma informação? (opcional)
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
            {tentou.has('revisar') && (
              <MensagemErro mensagens={errosDe(erros, null).filter((m) => !/seu nome|declaração/i.test(m))} />
            )}
            {errosServidor.length > 0 && (
              <div role="alert" className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-semibold">O servidor pediu para conferir:</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {errosServidor.map((m, i) => (
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
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => irPara(indice - 1)} disabled={indice === 0 || enviando}>
            <ChevronLeft className="size-5" /> Voltar
          </Button>
          {ultima ? (
            <Button size="lg" className="flex-[2]" onClick={enviar} disabled={enviando}>
              {enviando ? <Loader2 className="size-5 animate-spin" /> : null} Enviar pedido
            </Button>
          ) : (
            <Button size="lg" className="flex-[2]" onClick={avancar}>
              Próximo <ChevronRight className="size-5" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
