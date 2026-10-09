import { Minus, Plus, Trash2 } from 'lucide-react'
import {
  MOTIVOS_CRACHA,
  TAMANHOS_SUGERIDOS,
  TERMOS_PEDIDO,
  excecoesLinhaPedido,
  motivoExcecao,
  type ContextoPedido,
  type ItemCeuPublico,
  type ItemPublico,
  type SecaoPedido,
} from '@/lib/materiais/pedidoLider'
import { cn } from '@/lib/utils'
import { CAMPO, novaChave, qtdNumero, type LinhaCeuForm, type LinhaProdutoForm } from './formPedido'

// Peças da tela pública do líder (/pedido/:token). Mobile-first: alvos de
// toque grandes, uma coluna, nada de dado pessoal (tudo é digitado).

export function Ajuda({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
}

/** Campo numérico com −/+ e a unidade ao lado. */
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
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input bg-background active:bg-accent"
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
        className={cn(CAMPO, 'w-20 text-center tabular-nums')}
        aria-label={`Quantidade de ${rotulo}`}
      />
      <button
        type="button"
        onClick={() => passo(1)}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input bg-background active:bg-accent"
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
}: {
  secao: SecaoPedido
  marcado: boolean
  onChange: (v: boolean) => void
}) {
  const termo = TERMOS_PEDIDO.find((t) => t.id === secao)
  if (!termo) return null
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
      <span className="text-sm leading-relaxed">
        {termo.texto} <strong>Sim, concordo.</strong>
      </span>
    </label>
  )
}

// ---------------- Produtos (materiais e kit portaria) ----------------

export function SecaoProdutos({
  linhas,
  setLinhas,
  catalogo,
  ctx,
  permiteOutros,
}: {
  linhas: LinhaProdutoForm[]
  setLinhas: (f: (l: LinhaProdutoForm[]) => LinhaProdutoForm[]) => void
  catalogo: ItemPublico[]
  ctx: ContextoPedido
  permiteOutros: boolean
}) {
  const porId = new Map(ctx.catalogo.map((c) => [c.id, c]))
  const alterar = (chave: string, patch: Partial<LinhaProdutoForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))
  const remover = (chave: string) => setLinhas((ls) => ls.filter((l) => l.chave !== chave))
  const usados = new Set(linhas.map((l) => l.item_id))
  const disponiveis = catalogo.filter((c) => !usados.has(c.id) || c.variacoes.length > 0)

  return (
    <div className="space-y-3">
      {linhas.map((l) => {
        const item = l.item_id ? porId.get(l.item_id) : undefined
        const qtd = qtdNumero(l.quantidade)
        const exc = item
          ? excecoesLinhaPedido(ctx, item.id, l.variacao_id, qtd)
          : { qtdKit: null, acimaKit: false, validade: false, foraKit: qtd > 0, exigeJustificativa: qtd > 0 }
        const nome = item?.nome ?? 'Outros materiais'
        return (
          <div key={l.chave} className={cn('space-y-3 rounded-xl border bg-card p-4', exc.exigeJustificativa ? 'border-amber-400' : 'border-border')}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium leading-snug">{nome}</p>
                {exc.qtdKit != null && <p className="text-xs text-muted-foreground tabular-nums">Kit do mês: {exc.qtdKit}</p>}
              </div>
              {(!item || exc.qtdKit == null) && (
                <button
                  type="button"
                  onClick={() => remover(l.chave)}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                  aria-label={`Remover ${nome}`}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            {!item && (
              <input
                className={CAMPO}
                placeholder="Descreva o material (tipo, tamanho, cor...)"
                value={l.descricao_livre}
                maxLength={120}
                onChange={(e) => alterar(l.chave, { descricao_livre: e.target.value })}
                aria-label="Descrição do material"
              />
            )}
            {item && item.variacoes.length > 0 && (
              <select
                className={CAMPO}
                value={l.variacao_id ?? ''}
                onChange={(e) => alterar(l.chave, { variacao_id: e.target.value || null })}
                aria-label={`Variação de ${item.nome}`}
              >
                <option value="">Escolha a opção...</option>
                {item.variacoes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.rotulo}
                  </option>
                ))}
              </select>
            )}
            <CampoQuantidade valor={l.quantidade} onChange={(v) => alterar(l.chave, { quantidade: v })} unidade={item?.unidade} rotulo={nome} />
            {exc.exigeJustificativa && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Justifique: {item ? motivoExcecao(exc) : 'fora do kit'}
                </p>
                <textarea
                  className={cn(CAMPO, 'min-h-20')}
                  value={l.justificativa}
                  maxLength={500}
                  onChange={(e) => alterar(l.chave, { justificativa: e.target.value })}
                  placeholder="Por que o posto precisa desta quantidade?"
                  aria-label={`Justificativa de ${nome}`}
                />
              </div>
            )}
          </div>
        )
      })}

      {disponiveis.length > 0 && (
        <select
          className={CAMPO}
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            setLinhas((ls) => [
              ...ls,
              { chave: novaChave(), item_id: id, variacao_id: null, descricao_livre: '', quantidade: '1', justificativa: '' },
            ])
          }}
          aria-label="Adicionar item"
        >
          <option value="">+ Adicionar outro item da lista</option>
          {disponiveis.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({c.unidade})
            </option>
          ))}
        </select>
      )}
      {permiteOutros && (
        <button
          type="button"
          onClick={() =>
            setLinhas((ls) => [
              ...ls,
              { chave: novaChave(), item_id: null, variacao_id: null, descricao_livre: '', quantidade: '1', justificativa: '' },
            ])
          }
          className="w-full rounded-lg border border-dashed border-input py-3 text-sm font-medium text-primary active:bg-accent"
        >
          + Outros materiais (não estão na lista)
        </button>
      )}
    </div>
  )
}

// ---------------- Uniforme / EPI ----------------

export function SecaoPecas({
  tipo,
  linhas,
  setLinhas,
  itens,
}: {
  tipo: 'uniforme' | 'epi'
  linhas: LinhaCeuForm[]
  setLinhas: (f: (l: LinhaCeuForm[]) => LinhaCeuForm[]) => void
  itens: ItemCeuPublico[]
}) {
  const doTipo = linhas.filter((l) => l.tipo === tipo)
  const pecas = itens.filter((i) => i.tipo === tipo)
  const alterar = (chave: string, patch: Partial<LinhaCeuForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))
  const idLista = `tamanhos-${tipo}`
  return (
    <div className="space-y-3">
      <datalist id={idLista}>
        {TAMANHOS_SUGERIDOS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {doTipo.map((l, i) => (
        <div key={l.chave} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Pedido {i + 1}</p>
            <button
              type="button"
              onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
              aria-label={`Remover pedido ${i + 1}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <input
            className={CAMPO}
            placeholder="Nome do colaborador(a)"
            value={l.nome}
            maxLength={120}
            onChange={(e) => alterar(l.chave, { nome: e.target.value })}
            aria-label="Nome do colaborador"
          />
          <select className={CAMPO} value={l.item_id} onChange={(e) => alterar(l.chave, { item_id: e.target.value })} aria-label="Peça">
            <option value="">Escolha a peça...</option>
            {pecas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <input
            className={CAMPO}
            placeholder="Tamanho (ex.: M, GG, 40)"
            list={idLista}
            value={l.tamanho}
            maxLength={20}
            onChange={(e) => alterar(l.chave, { tamanho: e.target.value })}
            aria-label="Tamanho"
          />
          <CampoQuantidade valor={l.quantidade} onChange={(v) => alterar(l.chave, { quantidade: v })} unidade="peça(s)" rotulo="peças" minimo={1} />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setLinhas((ls) => [
            ...ls,
            { chave: novaChave(), tipo, nome: '', item_id: '', tamanho: '', quantidade: '1', cracha_motivo: '', cracha_cordao: false },
          ])
        }
        className="w-full rounded-lg border border-dashed border-input py-3 text-sm font-medium text-primary active:bg-accent"
      >
        + Adicionar {tipo === 'epi' ? 'EPI' : 'peça de uniforme'}
      </button>
    </div>
  )
}

// ---------------- Crachá ----------------

export function SecaoCrachas({
  linhas,
  setLinhas,
}: {
  linhas: LinhaCeuForm[]
  setLinhas: (f: (l: LinhaCeuForm[]) => LinhaCeuForm[]) => void
}) {
  const crachas = linhas.filter((l) => l.tipo === 'cracha')
  const alterar = (chave: string, patch: Partial<LinhaCeuForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))
  return (
    <div className="space-y-3">
      {crachas.map((l, i) => (
        <div key={l.chave} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Crachá {i + 1}</p>
            <button
              type="button"
              onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
              aria-label={`Remover crachá ${i + 1}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            <input
              className={CAMPO}
              placeholder="Nome que constará no crachá"
              value={l.nome}
              maxLength={40}
              onChange={(e) => alterar(l.chave, { nome: e.target.value })}
              aria-label="Nome que constará no crachá"
            />
            <Ajuda>
              Escreva um nome curto, só nome e sobrenome. Ex.: se o nome completo for Maria dos Santos Pereira da Costa, escreva Maria dos
              Santos.
            </Ajuda>
          </div>
          <select
            className={CAMPO}
            value={l.cracha_motivo}
            onChange={(e) => alterar(l.chave, { cracha_motivo: e.target.value })}
            aria-label="Motivo do pedido"
          >
            <option value="">Qual o motivo do pedido?</option>
            {MOTIVOS_CRACHA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
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
                  className={cn(
                    'rounded-lg border py-2.5 text-base font-medium',
                    l.cracha_cordao === v ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background'
                  )}
                >
                  {v ? 'Sim' : 'Não'}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setLinhas((ls) => [
            ...ls,
            { chave: novaChave(), tipo: 'cracha', nome: '', item_id: '', tamanho: '', quantidade: '1', cracha_motivo: '', cracha_cordao: false },
          ])
        }
        className="w-full rounded-lg border border-dashed border-input py-3 text-sm font-medium text-primary active:bg-accent"
      >
        + Adicionar crachá
      </button>
    </div>
  )
}

