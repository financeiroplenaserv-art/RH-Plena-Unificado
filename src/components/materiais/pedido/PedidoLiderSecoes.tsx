import { useEffect, useRef, useState } from 'react'
import { Loader2, Minus, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import {
  MOTIVOS_CRACHA,
  TERMOS_PEDIDO,
  excecoesLinhaPedido,
  perguntaJustificativa,
  type ContextoPedido,
  type ErroCampo,
  type ItemPublico,
  type SecaoPedido,
} from '@/lib/materiais/pedidoLider'
import { BUSCA_MIN_CARACTERES, normalizarBusca } from '@/lib/materiais/buscaItens'
import { pecasParaFuncao, type MembroEquipePublico, type PecaPublica } from '@/lib/materiais/pecasCeu'
import { buscarItemPublico } from '@/services/pedidoMateriaisApi'
import { cn } from '@/lib/utils'
import {
  CAMPO,
  errosDe,
  novaChave,
  qtdNumero,
  type LinhaCrachaForm,
  type LinhaPecaForm,
  type LinhaProdutoForm,
  type PessoaForm,
  type SecaoProduto,
} from './formPedido'

// Peças da tela pública do líder (/pedido/:token). Público: ASGs com
// dificuldade de preenchimento — então tudo é por TOQUE (botões grandes,
// +/−, tamanhos em botões), uma coluna, e o único texto livre obrigatório é
// a justificativa (e "Seu nome", na revisão). Os avisos de erro vêm da
// validação recalculada a cada alteração: somem assim que o campo é corrigido.

export function Ajuda({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
}

export function MensagemErro({ mensagens }: { mensagens: string[] }) {
  if (mensagens.length === 0) return null
  return (
    <div role="alert" className="space-y-0.5 text-sm font-medium text-red-700 dark:text-red-400">
      {mensagens.map((m, i) => (
        <p key={i}>{m}</p>
      ))}
    </div>
  )
}

const BOTAO_GRANDE = 'flex min-h-12 items-center justify-center rounded-xl border px-3 text-base font-medium active:scale-[0.98]'

/** Quantidade com −/+ grandes (o campo aceita digitação, mas não é preciso). */
export function CampoQuantidade({
  valor,
  onChange,
  unidade,
  rotulo,
  minimo = 0,
}: {
  valor: string
  onChange: (v: string) => void
  unidade?: string | null
  rotulo: string
  minimo?: number
}) {
  const atual = qtdNumero(valor)
  const passo = (d: number) => onChange(String(Math.max(minimo, Math.round((atual + d) * 100) / 100)))
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => passo(-1)}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-input bg-background active:bg-accent"
        aria-label={`Diminuir ${rotulo}`}
      >
        <Minus className="size-5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
        className={cn(CAMPO, 'w-20 text-center text-lg font-semibold tabular-nums')}
        aria-label={`Quantidade de ${rotulo}`}
      />
      <button
        type="button"
        onClick={() => passo(1)}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-input bg-background active:bg-accent"
        aria-label={`Aumentar ${rotulo}`}
      >
        <Plus className="size-5" />
      </button>
      {unidade && <span className="text-sm text-muted-foreground">{unidade}</span>}
    </div>
  )
}

export function Declaracao({
  secao,
  marcado,
  onChange,
  erro = false,
}: {
  secao: SecaoPedido
  marcado: boolean
  onChange: (v: boolean) => void
  erro?: boolean
}) {
  const termo = TERMOS_PEDIDO.find((t) => t.id === secao)
  if (!termo) return null
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-4',
        erro && !marcado ? 'border-red-400' : 'border-border'
      )}
    >
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-primary" />
      <span className="text-sm leading-relaxed">
        {termo.texto} <strong>Sim, concordo.</strong>
      </span>
    </label>
  )
}

/** Pergunta da justificativa em vermelho, com o campo logo abaixo. */
function Justificativa({
  pergunta,
  valor,
  onChange,
  rotulo,
  erros,
}: {
  pergunta: string
  valor: string
  onChange: (v: string) => void
  rotulo: string
  erros: string[]
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pergunta}</p>
      <textarea
        className={cn(CAMPO, 'min-h-20', erros.length > 0 && !valor.trim() ? 'border-red-500' : '')}
        value={valor}
        maxLength={500}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex.: o posto ganhou mais um andar; quebrou; acabou antes do mês."
        aria-label={`Motivo de ${rotulo}`}
      />
    </div>
  )
}

// ---------------- Produtos (materiais e kit portaria) ----------------

export function SecaoProdutos({
  linhas,
  setLinhas,
  ctx,
  erros,
  token,
  secao,
  semKit,
  onItemBusca,
}: {
  linhas: LinhaProdutoForm[]
  setLinhas: (f: (l: LinhaProdutoForm[]) => LinhaProdutoForm[]) => void
  ctx: ContextoPedido
  erros: ErroCampo[]
  token: string
  secao: SecaoProduto
  /** Nenhum item do kit nesta etapa. */
  semKit: boolean
  /** Guarda o item escolhido na busca (o contexto do navegador só tem o kit). */
  onItemBusca: (item: ItemPublico) => void
}) {
  const porId = new Map(ctx.catalogo.map((c) => [c.id, c]))
  const alterar = (chave: string, patch: Partial<LinhaProdutoForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))
  const remover = (chave: string) => setLinhas((ls) => ls.filter((l) => l.chave !== chave))
  const [avisoBusca, setAvisoBusca] = useState<string | null>(null)

  const adicionarDaBusca = (item: ItemPublico) => {
    if (linhas.some((l) => l.item_id === item.id && l.origem === 'kit')) {
      setAvisoBusca(`${item.nome} já está na lista do kit, acima. Ajuste a quantidade lá.`)
      return
    }
    setAvisoBusca(null)
    onItemBusca(item)
    setLinhas((ls) => [
      ...ls,
      { chave: novaChave(), item_id: item.id, variacao_id: null, descricao_livre: '', quantidade: '1', justificativa: '', secao, origem: 'busca' },
    ])
  }
  const adicionarLivre = (descricao: string) => {
    setAvisoBusca(null)
    setLinhas((ls) => [
      ...ls,
      { chave: novaChave(), item_id: null, variacao_id: null, descricao_livre: descricao, quantidade: '1', justificativa: '', secao, origem: 'livre' },
    ])
  }

  return (
    <div className="space-y-3">
      {semKit && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Este contrato ainda não tem kit cadastrado; use &quot;Preciso de outro item&quot;.
        </p>
      )}
      {linhas.map((l) => {
        const item = l.item_id ? porId.get(l.item_id) : undefined
        const qtd = qtdNumero(l.quantidade)
        const exc = item
          ? excecoesLinhaPedido(ctx, item.id, l.variacao_id, qtd)
          : { qtdKit: null, acimaKit: false, validade: false, foraKit: qtd > 0, exigeJustificativa: qtd > 0 }
        const nome = item?.nome ?? l.descricao_livre ?? 'Outro item'
        const errosLinha = errosDe(erros, l.chave).filter((m) => !/conte para a gente/.test(m) || !exc.exigeJustificativa)
        return (
          <div
            key={l.chave}
            data-erro={errosDe(erros, l.chave).length > 0 ? 'true' : undefined}
            className={cn(
              'space-y-3 rounded-2xl border bg-card p-4',
              exc.exigeJustificativa ? 'border-red-300 dark:border-red-800' : 'border-border'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold leading-snug">{nome}</p>
                {exc.qtdKit != null ? (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Kit do mês: {exc.qtdKit} {item?.unidade ?? ''}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{l.origem === 'livre' ? 'Item escrito por você (o inspetor confere)' : 'Fora do kit'}</p>
                )}
              </div>
              {l.origem !== 'kit' && (
                <button
                  type="button"
                  onClick={() => remover(l.chave)}
                  className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent"
                  aria-label={`Remover ${nome}`}
                >
                  <Trash2 className="size-5" />
                </button>
              )}
            </div>
            {item && item.variacoes.length > 0 && (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Opção de ${item.nome}`}>
                {item.variacoes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={l.variacao_id === v.id}
                    onClick={() => alterar(l.chave, { variacao_id: v.id })}
                    className={cn(BOTAO_GRANDE, l.variacao_id === v.id ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background')}
                  >
                    {v.rotulo}
                  </button>
                ))}
              </div>
            )}
            <CampoQuantidade valor={l.quantidade} onChange={(v) => alterar(l.chave, { quantidade: v })} unidade={item?.unidade} rotulo={nome} />
            {exc.exigeJustificativa && (
              <Justificativa
                pergunta={item ? perguntaJustificativa(exc, qtd) : 'Este item não faz parte do kit do posto. Pode contar para a gente por que precisa dele?'}
                valor={l.justificativa}
                onChange={(v) => alterar(l.chave, { justificativa: v })}
                rotulo={nome}
                erros={errosDe(erros, l.chave, 'justificativa')}
              />
            )}
            <MensagemErro mensagens={errosLinha} />
          </div>
        )
      })}

      <BuscaOutroItem token={token} secao={secao} onEscolher={adicionarDaBusca} onLivre={adicionarLivre} />
      {avisoBusca && <p className="text-sm text-muted-foreground">{avisoBusca}</p>}
    </div>
  )
}

/**
 * "Preciso de outro item": botão discreto; ao abrir, o líder digita (pode
 * errar: "cab", "cabo vasora") e o servidor sugere até 5 itens ativos. Nada
 * casou → "Não achei, enviar assim" (texto livre para o inspetor).
 */
export function BuscaOutroItem({
  token,
  secao,
  onEscolher,
  onLivre,
}: {
  token: string
  secao: SecaoProduto
  onEscolher: (item: ItemPublico) => void
  onLivre: (descricao: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ItemPublico[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const sequencia = useRef(0)

  const curto = normalizarBusca(termo).replace(/ /g, '').length < BUSCA_MIN_CARACTERES
  useEffect(() => {
    if (!aberto || curto) return
    const minha = ++sequencia.current
    const t = setTimeout(async () => {
      setBuscando(true)
      setFalhou(false)
      try {
        const r = await buscarItemPublico(token, termo, secao)
        if (minha === sequencia.current) setResultados(r.itens)
      } catch {
        if (minha === sequencia.current) {
          setFalhou(true)
          setResultados([])
        }
      } finally {
        if (minha === sequencia.current) setBuscando(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [aberto, curto, termo, token, secao])

  const fechar = () => {
    setAberto(false)
    setTermo('')
    setResultados(null)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full rounded-xl border border-dashed border-input py-3 text-sm font-medium text-primary active:bg-accent"
      >
        + Preciso de outro item
      </button>
    )
  }

  const lista = curto ? null : resultados
  return (
    <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="busca-item" className="text-base font-semibold">
          O que você precisa?
        </label>
        <button type="button" onClick={fechar} className="flex size-10 items-center justify-center rounded-xl text-muted-foreground" aria-label="Fechar busca">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="busca-item"
          className={cn(CAMPO, 'pl-10')}
          value={termo}
          maxLength={80}
          autoFocus
          autoComplete="off"
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Ex.: cabo, vassoura, detergente"
        />
      </div>
      {curto ? (
        <Ajuda>Escreva pelo menos {BUSCA_MIN_CARACTERES} letras. Pode escrever do seu jeito, a gente procura.</Ajuda>
      ) : buscando && !lista ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Procurando...
        </p>
      ) : (
        <div className="space-y-2">
          {lista && lista.length > 0 && <p className="text-sm text-muted-foreground">Toque no item certo:</p>}
          {lista?.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onEscolher(item)
                fechar()
              }}
              className={cn(BOTAO_GRANDE, 'w-full justify-between border-input bg-background text-left')}
            >
              <span>{item.nome}</span>
              <span className="shrink-0 pl-2 text-sm text-muted-foreground">{item.unidade}</span>
            </button>
          ))}
          {falhou && <p className="text-sm text-red-700 dark:text-red-400">Não foi possível procurar agora. Tente de novo ou envie assim.</p>}
          {lista && lista.length === 0 && !falhou && <p className="text-sm text-muted-foreground">Não encontramos nada parecido.</p>}
          <button
            type="button"
            onClick={() => {
              onLivre(termo.trim())
              fechar()
            }}
            className="w-full rounded-xl py-3 text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Não achei, enviar assim: &quot;{termo.trim()}&quot;
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------- Escolha da pessoa ----------------

function EscolherPessoa({
  equipe,
  jaEscolhidos,
  onEscolher,
  titulo,
}: {
  equipe: MembroEquipePublico[]
  jaEscolhidos: Set<string>
  onEscolher: (p: { ref: string | null; nome: string }) => void
  titulo: string
}) {
  const [outra, setOutra] = useState(false)
  const [nome, setNome] = useState('')
  const disponiveis = equipe.filter((m) => !jaEscolhidos.has(m.ref))
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-base font-semibold">{titulo}</p>
      {disponiveis.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {disponiveis.map((m) => (
            <button
              key={m.ref}
              type="button"
              onClick={() => onEscolher({ ref: m.ref, nome: m.nome })}
              className={cn(BOTAO_GRANDE, 'border-input bg-background')}
            >
              {m.nome}
            </button>
          ))}
        </div>
      )}
      {outra ? (
        <div className="space-y-2">
          <input
            className={CAMPO}
            value={nome}
            maxLength={120}
            autoFocus
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da pessoa"
            aria-label="Nome da outra pessoa"
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOutra(false)} className={cn(BOTAO_GRANDE, 'border-input bg-background')}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={nome.trim().length < 2}
              onClick={() => {
                onEscolher({ ref: null, nome: nome.trim() })
                setNome('')
                setOutra(false)
              }}
              className={cn(BOTAO_GRANDE, 'border-primary bg-primary text-primary-foreground disabled:opacity-50')}
            >
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOutra(true)}
          className={cn(BOTAO_GRANDE, 'w-full gap-2 border-dashed border-input text-sm text-primary')}
        >
          <UserPlus className="size-5" /> Outra pessoa (ferista/cobertura)
        </button>
      )}
    </div>
  )
}

// ---------------- Uniforme / EPI (por pessoa) ----------------

export function SecaoUniformes({
  pessoas,
  setPessoas,
  linhas,
  setLinhas,
  pecas,
  equipe,
  semKitUniforme,
  erros,
}: {
  pessoas: PessoaForm[]
  setPessoas: (f: (l: PessoaForm[]) => PessoaForm[]) => void
  linhas: LinhaPecaForm[]
  setLinhas: (f: (l: LinhaPecaForm[]) => LinhaPecaForm[]) => void
  pecas: PecaPublica[]
  equipe: MembroEquipePublico[]
  semKitUniforme: boolean
  erros: ErroCampo[]
}) {
  const funcaoPorRef = new Map(equipe.map((m) => [m.ref, m.funcao]))
  const [todasPara, setTodasPara] = useState<Set<string>>(new Set())
  const alterar = (chave: string, patch: Partial<LinhaPecaForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))

  return (
    <div className="space-y-4">
      {semKitUniforme && (
        <Ajuda>Este contrato ainda não tem as peças cadastradas: aparecem todas as peças do estoque.</Ajuda>
      )}
      {pessoas.map((p) => {
        const funcao = p.ref ? funcaoPorRef.get(p.ref) ?? null : null
        const daFuncao = pecasParaFuncao(pecas, funcao)
        const mostrar = todasPara.has(p.chave) ? pecas : daFuncao
        const dela = linhas.filter((l) => l.pessoa === p.chave)
        return (
          <section key={p.chave} className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-label={`Pedido de ${p.nome}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-semibold">{p.nome}</p>
              <button
                type="button"
                onClick={() => {
                  setPessoas((ps) => ps.filter((x) => x.chave !== p.chave))
                  setLinhas((ls) => ls.filter((l) => l.pessoa !== p.chave))
                }}
                className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent"
                aria-label={`Tirar ${p.nome} do pedido`}
              >
                <Trash2 className="size-5" />
              </button>
            </div>
            {dela.length === 0 && <Ajuda>Toque nas peças que {p.nome} precisa.</Ajuda>}
            <ul className="space-y-2">
              {mostrar.map((peca) => {
                const linha = dela.find((l) => l.peca_id === peca.id)
                const tamanhos = peca.opcoes.map((o) => o.tamanho).filter(Boolean)
                if (!linha) {
                  return (
                    <li key={peca.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setLinhas((ls) => [
                            ...ls,
                            { chave: novaChave(), pessoa: p.chave, peca_id: peca.id, tamanho: '', quantidade: '1' },
                          ])
                        }
                        className={cn(BOTAO_GRANDE, 'w-full justify-between gap-2 border-input bg-background text-left')}
                      >
                        <span>{peca.rotulo}</span>
                        <Plus className="size-5 shrink-0 text-primary" aria-hidden />
                      </button>
                    </li>
                  )
                }
                return (
                  <li
                    key={peca.id}
                    data-erro={errosDe(erros, linha.chave).length > 0 ? 'true' : undefined}
                    className="space-y-3 rounded-xl border border-primary/50 bg-primary/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{peca.rotulo}</p>
                      <button
                        type="button"
                        onClick={() => setLinhas((ls) => ls.filter((l) => l.chave !== linha.chave))}
                        className="flex size-10 items-center justify-center rounded-xl text-muted-foreground"
                        aria-label={`Tirar ${peca.rotulo}`}
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                    {tamanhos.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-sm font-medium">Tamanho</p>
                        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={`Tamanho de ${peca.rotulo}`}>
                          {tamanhos.map((t) => (
                            <button
                              key={t}
                              type="button"
                              role="radio"
                              aria-checked={linha.tamanho === t}
                              onClick={() => alterar(linha.chave, { tamanho: t })}
                              className={cn(
                                BOTAO_GRANDE,
                                'px-1 text-lg',
                                linha.tamanho === t ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <CampoQuantidade valor={linha.quantidade} onChange={(v) => alterar(linha.chave, { quantidade: v })} unidade="peça(s)" rotulo={peca.rotulo} minimo={1} />
                    <MensagemErro mensagens={errosDe(erros, linha.chave)} />
                  </li>
                )
              })}
            </ul>
            {daFuncao.length < pecas.length && (
              <button
                type="button"
                onClick={() =>
                  setTodasPara((s) => {
                    const n = new Set(s)
                    if (n.has(p.chave)) n.delete(p.chave)
                    else n.add(p.chave)
                    return n
                  })
                }
                className="w-full py-2 text-sm font-medium text-primary"
              >
                {todasPara.has(p.chave) ? 'Mostrar só as peças da função' : 'Ver todas as peças do posto'}
              </button>
            )}
          </section>
        )
      })}

      <EscolherPessoa
        equipe={equipe}
        jaEscolhidos={new Set(pessoas.map((p) => p.ref).filter((r): r is string => !!r))}
        titulo={pessoas.length === 0 ? 'Para quem é o pedido?' : 'Mais alguém precisa?'}
        onEscolher={(p) => setPessoas((ps) => [...ps, { chave: novaChave(), ref: p.ref, nome: p.nome }])}
      />
    </div>
  )
}

// ---------------- Crachá ----------------

export function SecaoCrachas({
  linhas,
  setLinhas,
  equipe,
  erros,
}: {
  linhas: LinhaCrachaForm[]
  setLinhas: (f: (l: LinhaCrachaForm[]) => LinhaCrachaForm[]) => void
  equipe: MembroEquipePublico[]
  erros: ErroCampo[]
}) {
  const alterar = (chave: string, patch: Partial<LinhaCrachaForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))
  return (
    <div className="space-y-4">
      {linhas.map((l) => (
        <section
          key={l.chave}
          data-erro={errosDe(erros, l.chave).length > 0 ? 'true' : undefined}
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
          aria-label={`Crachá de ${l.nome}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">{l.nome}</p>
            <button
              type="button"
              onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
              className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent"
              aria-label={`Tirar o crachá de ${l.nome}`}
            >
              <Trash2 className="size-5" />
            </button>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Qual o motivo?</p>
            <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Motivo do pedido">
              {MOTIVOS_CRACHA.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={l.cracha_motivo === m}
                  onClick={() => alterar(l.chave, { cracha_motivo: m })}
                  className={cn(
                    BOTAO_GRANDE,
                    'justify-start text-left text-sm',
                    l.cracha_motivo === m ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Precisa de novo cordão com prendedor?</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Precisa de novo cordão com prendedor?">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={l.cracha_cordao === v}
                  onClick={() => alterar(l.chave, { cracha_cordao: v })}
                  className={cn(BOTAO_GRANDE, l.cracha_cordao === v ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background')}
                >
                  {v ? 'Sim' : 'Não'}
                </button>
              ))}
            </div>
          </div>
          {l.ref ? (
            <div className="space-y-1.5">
              <label htmlFor={`cracha-${l.chave}`} className="text-sm font-medium">
                Nome no crachá (opcional)
              </label>
              <input
                id={`cracha-${l.chave}`}
                className={CAMPO}
                placeholder="Deixe em branco para usar o nome do cadastro"
                value={l.cracha_nome}
                maxLength={40}
                onChange={(e) => alterar(l.chave, { cracha_nome: e.target.value })}
              />
            </div>
          ) : (
            <Ajuda>No crachá vai o nome &quot;{l.nome}&quot;. Escreva só nome e sobrenome (ex.: Maria dos Santos).</Ajuda>
          )}
          <MensagemErro mensagens={errosDe(erros, l.chave)} />
        </section>
      ))}
      <EscolherPessoa
        equipe={equipe}
        jaEscolhidos={new Set(linhas.map((l) => l.ref).filter((r): r is string => !!r))}
        titulo={linhas.length === 0 ? 'Quem precisa de crachá?' : 'Mais alguém precisa de crachá?'}
        onEscolher={(p) =>
          setLinhas((ls) => [...ls, { chave: novaChave(), ref: p.ref, nome: p.nome, cracha_nome: '', cracha_motivo: '', cracha_cordao: false }])
        }
      />
    </div>
  )
}
