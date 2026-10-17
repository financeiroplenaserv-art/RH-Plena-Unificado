import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BadgeCheck, Check, Loader2, Minus, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { TONS, type Tom } from './tons'
import {
  MOTIVOS_CRACHA,
  TERMOS_PEDIDO,
  TERMO_UNIFORME_EPI,
  excecoesLinhaPedido,
  linhasIniciaisDoKit,
  qtdKitPublico,
  type ContextoPedido,
  type ErroCampo,
  type ItemBuscavelPublico,
  type ItemPublico,
  type SecaoPedido,
} from '@/lib/materiais/pedidoLider'
import { BUSCA_MAX_RESULTADOS, BUSCA_MIN_CARACTERES, buscarItens, normalizarBusca } from '@/lib/materiais/buscaItens'
import {
  GRUPOS_EQUIPE,
  equipeDoGrupo,
  equipeTemDoisGrupos,
  grupoDaFuncao,
  pecasParaFuncao,
  type GrupoEquipe,
  type MembroEquipePublico,
  type PecaPublica,
} from '@/lib/materiais/pecasCeu'
import { buscarItemPublico, type ItemBuscaPublico } from '@/services/pedidoMateriaisApi'
import { cn } from '@/lib/utils'
import { unidadeParaQuantidade } from '@/lib/materiais/unidades'
import {
  CAMPO,
  errosDe,
  maximoDaLinhaKit,
  nomeDaLinhaProduto,
  novaChave,
  perguntaSimples,
  qtdNumero,
  type LinhaCrachaForm,
  type LinhaPecaForm,
  type LinhaProdutoForm,
  type PessoaForm,
  ordenarEquipe,
  resumoLinhaCracha,
  resumoLinhaPeca,
  resumoLinhaProduto,
  type SecaoProduto,
} from './formPedido'
import { focarDepois, useQuadros } from './useQuadros'

// Peças da tela pública do líder (/pedido/:token). Público: ASGs com
// dificuldade de leitura e de uso do celular — então tudo é por TOQUE (botões
// grandes, +/−, tamanhos em botões), uma coluna, frases curtas, e o único
// texto obrigatório é "Seu nome", na revisão. Os avisos de erro vêm da
// validação recalculada a cada alteração: somem assim que o campo é corrigido.
//
// Visual (decisão da gestão, 16/10/2026): cada parte tem uma cor própria e
// constante — o que vem no mês em VERDE, o que a pessoa pede a mais em AZUL,
// uniforme/EPI em LARANJA e crachá em ROXO (tokens --pedido-* em
// src/index.css, com versão para o tema escuro). Sem degradês aqui: o único
// é o do botão primário.

/** Uma parte do pedido: fundo suave, borda forte à esquerda e título com ícone grande. */
export function Parte({
  tom,
  titulo,
  subtitulo,
  id,
  children,
}: {
  tom: Tom
  titulo: string
  subtitulo?: React.ReactNode
  id?: string
  children?: React.ReactNode
}) {
  const t = TONS[tom]
  const Icone = t.icone
  return (
    <section data-tom={tom} aria-labelledby={id} className={cn('space-y-3 rounded-2xl border-l-[6px] p-4', t.fundo, t.borda)}>
      <div className="flex items-center gap-3">
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full border-2', t.cheio)} aria-hidden>
          <Icone className="size-7" />
        </span>
        <div className="min-w-0">
          <h3 id={id} className={cn('text-xl font-bold leading-tight', t.texto)}>
            {titulo}
          </h3>
          {subtitulo && <p className="text-base leading-snug text-foreground">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function Ajuda({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-relaxed text-muted-foreground">{children}</p>
}

export function MensagemErro({ mensagens }: { mensagens: string[] }) {
  if (mensagens.length === 0) return null
  return (
    <div role="alert" className="space-y-0.5 text-base font-semibold text-red-700 dark:text-red-400">
      {mensagens.map((m, i) => (
        <p key={i}>{m}</p>
      ))}
    </div>
  )
}

const BOTAO_GRANDE = 'flex min-h-12 items-center justify-center rounded-xl border-2 px-3 text-base font-semibold active:scale-[0.98]'

/** Linha resumida de um quadro pronto: toda tocável (lápis) para reabrir; ícone de alerta opcional. */
export function LinhaResumo({ tom, texto, onAbrir, alerta }: { tom: Tom; texto: string; onAbrir: () => void; alerta?: boolean }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      data-resumo="true"
      aria-label={`Editar: ${texto}`}
      className={cn('flex min-h-14 w-full items-center gap-3 rounded-xl border-2 bg-card px-3 py-2 text-left active:scale-[0.99]', TONS[tom].borda)}
    >
      <Check className={cn('size-5 shrink-0', TONS[tom].texto)} aria-hidden />
      <span className="min-w-0 flex-1 text-base font-semibold leading-snug">{texto}</span>
      {alerta && <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-label="Atenção" />}
      <Pencil className={cn('size-5 shrink-0', TONS[tom].texto)} aria-hidden />
    </button>
  )
}

/** Botão grande "Pronto" no fim do quadro aberto. */
export function BotaoPronto({ tom, onClick }: { tom: Tom; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(BOTAO_GRANDE, 'min-h-14 w-full gap-2 text-lg', TONS[tom].cheio)}>
      <Check className="size-6" strokeWidth={3} aria-hidden /> Pronto
    </button>
  )
}

/** Lixeira com confirmação simples (2 toques): não apaga sem querer. */
export function BotaoApagar({ rotulo, onConfirmar }: { rotulo: string; onConfirmar: () => void }) {
  const [confirmando, setConfirmando] = useState(false)
  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent"
        aria-label={rotulo}
      >
        <Trash2 className="size-6" />
      </button>
    )
  }
  return (
    <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Confirmar">
      <button type="button" onClick={onConfirmar} className="min-h-12 rounded-xl bg-red-600 px-3 text-base font-bold text-white">
        Apagar
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="min-h-12 rounded-xl border-2 border-input bg-background px-3 text-base font-semibold">
        Voltar
      </button>
    </div>
  )
}

/** Quantidade com −/+ grandes (56px) e o número em destaque (aceita digitação, mas não é preciso). */
export function CampoQuantidade({
  valor,
  onChange,
  unidade,
  rotulo,
  minimo = 0,
  maximo,
  tom = 'extra',
}: {
  valor: string
  onChange: (v: string) => void
  unidade?: string | null
  rotulo: string
  minimo?: number
  /** Teto do botão + (linha do kit: o kit do mês — nunca aumenta). */
  maximo?: number
  tom?: Tom
}) {
  const atual = qtdNumero(valor)
  const limitar = (n: number) => (maximo != null ? Math.min(maximo, n) : n)
  const passo = (d: number) => onChange(String(limitar(Math.max(minimo, Math.round((atual + d) * 100) / 100))))
  const noMaximo = maximo != null && atual >= maximo
  const botao = cn(
    'flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 bg-background active:scale-95 disabled:opacity-35',
    TONS[tom].contorno
  )
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => passo(-1)} className={botao} aria-label={`Diminuir ${rotulo}`}>
        <Minus className="size-7" strokeWidth={3} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
        className={cn(CAMPO, 'h-14 w-20 border-2 px-1 text-center text-2xl font-bold tabular-nums')}
        aria-label={`Quantidade de ${rotulo}`}
      />
      <button type="button" onClick={() => passo(1)} disabled={noMaximo} className={botao} aria-label={`Aumentar ${rotulo}`}>
        <Plus className="size-7" strokeWidth={3} />
      </button>
      {unidade && <span className="min-w-0 text-base text-muted-foreground">{unidadeParaQuantidade(unidade, atual)}</span>}
    </div>
  )
}

export function Declaracao({
  secao,
  marcado,
  onChange,
  erro = false,
}: {
  secao: SecaoPedido | 'uniforme_epi'
  marcado: boolean
  onChange: (v: boolean) => void
  erro?: boolean
}) {
  const termo =
    secao === 'uniforme_epi' ? { texto: TERMO_UNIFORME_EPI } : TERMOS_PEDIDO.find((t) => t.id === secao)
  if (!termo) return null
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border-2 bg-card p-4',
        erro && !marcado ? 'border-red-500' : marcado ? 'border-pedido-kit' : 'border-border'
      )}
    >
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-7 shrink-0 accent-primary" />
      <span className="text-base leading-relaxed">
        {termo.texto} <strong>Sim, concordo.</strong>
      </span>
    </label>
  )
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** Convite (OPCIONAL) para contar o motivo do extra, com o campo logo abaixo. */
function MotivoOpcional({
  pergunta,
  valor,
  onChange,
  rotulo,
}: {
  pergunta: string
  valor: string
  onChange: (v: string) => void
  rotulo: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-base text-foreground">
        {pergunta} <span className="text-muted-foreground">(se quiser contar)</span>
      </p>
      <textarea
        className={cn(CAMPO, 'min-h-20')}
        value={valor}
        maxLength={500}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex.: quebrou; acabou antes; o prédio aumentou."
        aria-label={`Motivo de ${rotulo}`}
      />
    </div>
  )
}

// ---------------- Produtos (materiais e kit portaria) ----------------

/**
 * Duas partes (decisão da gestão, 16/10/2026):
 * 1. "Vem este mês" (verde): o Kit Mensal, o que o posto VAI RECEBER. O líder
 *    só confirma; pode tirar ("Não preciso") ou diminuir, nunca aumentar.
 * 2. "Precisa de mais alguma coisa?" (azul): pedido extra por UM campo de
 *    busca só (o que for do kit vira "a mais"; fora dele, "não vem todo mês";
 *    nada achado, "Não achei, enviar assim"). Cada quadro tem um item e uma
 *    variação definidos pela busca; motivo opcional.
 */
export function SecaoProdutos({
  linhas,
  setLinhas,
  ctx,
  erros,
  errosTodos,
  token,
  catalogoBusca,
  secao,
  onItemBusca,
}: {
  linhas: LinhaProdutoForm[]
  setLinhas: (f: (l: LinhaProdutoForm[]) => LinhaProdutoForm[]) => void
  ctx: ContextoPedido
  /** Erros visíveis (a etapa já tentou avançar). */
  erros: ErroCampo[]
  /** Todos os erros da validação (o "Pronto" usa estes). */
  errosTodos?: ErroCampo[]
  token: string
  /** Catálogo buscável (só nomes) enviado pelo `carregar`; ausente = function antiga (busca pela rede). */
  catalogoBusca?: ItemBuscavelPublico[]
  secao: SecaoProduto
  /** Guarda o item escolhido na busca (o contexto do navegador só tem o kit). */
  onItemBusca: (item: ItemPublico) => void
}) {
  const porId = new Map(ctx.catalogo.map((c) => [c.id, c]))
  const alterar = (chave: string, patch: Partial<LinhaProdutoForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))
  const remover = (chave: string) => setLinhas((ls) => ls.filter((l) => l.chave !== chave))
  const [avisoBusca, setAvisoBusca] = useState<string | null>(null)
  const quadros = useQuadros(errosTodos ?? erros, erros)
  const campoBuscaId = `busca-item-${secao}`

  const kit = linhas.filter((l) => l.origem === 'kit')
  const extras = linhas.filter((l) => l.origem !== 'kit')
  const itensKitDaSecao = linhasIniciaisDoKit(ctx).filter((k) => {
    const cat = porId.get(k.item_id)?.categoria
    return (cat === 'portaria' ? 'portaria' : 'materiais') === secao
  })
  const naoVemEsteMes = ctx.kitConfirmado
    ? []
    : itensKitDaSecao
        .filter((k) => k.quantidade === 0)
        .map((k) => nomeDaLinhaProduto({ item_id: k.item_id, variacao_id: k.variacao_id, descricao_livre: '' }, porId.get(k.item_id)))
  const semKit = itensKitDaSecao.length === 0

  /**
   * Resultado da busca escolhido: item + variação já definidos. Do kit (o
   * item/variação está no Kit Mensal) = linha "a mais"; fora = "não vem todo
   * mês". A mesma variação já na lista soma 1 no quadro existente.
   */
  const adicionarDaBusca = (r: ItemBuscaPublico) => {
    onItemBusca(r)
    const variacao = r.variacao_id ?? null
    const nome = r.nome_exibicao || nomeDaLinhaProduto({ item_id: r.id, variacao_id: variacao, descricao_livre: '' }, r)
    const existente = extras.find((l) => l.item_id === r.id && (l.variacao_id ?? null) === variacao)
    if (existente) {
      alterar(existente.chave, { quantidade: String(qtdNumero(existente.quantidade) + 1) })
      quadros.abrirSo(existente.chave)
      setAvisoBusca(`${nome} já estava na lista. Somamos mais 1.`)
      return
    }
    setAvisoBusca(null)
    const doKit = qtdKitPublico(ctx.kit, r.id, variacao) != null
    const chaveNova = novaChave()
    quadros.abrirSo(chaveNova)
    setLinhas((ls) => [
      ...ls,
      {
        chave: chaveNova,
        item_id: r.id,
        variacao_id: variacao,
        descricao_livre: '',
        quantidade: '1',
        justificativa: '',
        secao,
        origem: doKit ? 'mais' : 'busca',
      },
    ])
  }
  const adicionarLivre = (descricao: string) => {
    setAvisoBusca(null)
    const chaveNova = novaChave()
    quadros.abrirSo(chaveNova)
    setLinhas((ls) => [
      ...ls,
      { chave: chaveNova, item_id: null, variacao_id: null, descricao_livre: descricao, quantidade: '1', justificativa: '', secao, origem: 'livre' },
    ])
  }

  /**
   * Escolha da variação SÓ quando a linha não tem uma e o item tem: linha do
   * kit cadastrada sem variação ("qualquer cor" — opcional) e linha extra de
   * rascunho antigo (de antes de a busca trazer a variação).
   */
  const radioVariacao = (l: LinhaProdutoForm, item: ItemPublico, tom: Tom) => (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Qual ${item.nome}`}>
      {item.variacoes.map((v) => (
        <button
          key={v.id}
          type="button"
          role="radio"
          aria-checked={l.variacao_id === v.id}
          onClick={() => alterar(l.chave, { variacao_id: v.id })}
          className={cn(BOTAO_GRANDE, l.variacao_id === v.id ? TONS[tom].cheio : 'border-input bg-background')}
        >
          {v.rotulo}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* ---------- 1. Vem este mês (Kit Mensal) ---------- */}
      {ctx.kitConfirmado ? (
        <Parte
          tom="kit"
          titulo="Já está confirmado"
          subtitulo="O que vem todo mês já foi confirmado e já vai chegar. Aqui você pede só o que precisar a mais."
        />
      ) : semKit ? (
        <p className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-base text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Este posto ainda não tem kit cadastrado. Peça o que precisa no campo azul, logo abaixo.
        </p>
      ) : (
        <Parte tom="kit" id={`kit-${secao}`} titulo="Vem este mês" subtitulo="Confira. Se não precisar de algum, toque em “Não preciso”.">
          {kit.map((l) => {
            const item = l.item_id ? porId.get(l.item_id) : undefined
            const nome = nomeDaLinhaProduto(l, item)
            const maximo = maximoDaLinhaKit(ctx, l)
            const qtd = qtdNumero(l.quantidade)
            const tirou = qtd === 0
            const variacaoLivre = !!item && item.variacoes.length > 0 && ctx.kit.some((k) => k.item_id === item.id && k.variacao_id == null)
            const errosLinha = errosDe(erros, l.chave)
            return (
              <div
                key={l.chave}
                data-erro={errosLinha.length > 0 ? 'true' : undefined}
                className={cn('space-y-3 rounded-2xl border-2 p-4', tirou ? 'border-dashed border-border bg-muted/60' : 'border-pedido-kit/50 bg-card')}
              >
                <div className="flex items-start gap-2">
                  {!tirou && <BadgeCheck className="mt-0.5 size-6 shrink-0 text-pedido-kit" aria-hidden />}
                  <div className="min-w-0">
                    <p className={cn('text-lg font-bold leading-snug', tirou && 'text-muted-foreground line-through')}>{nome}</p>
                    <p className="text-base text-muted-foreground tabular-nums">
                      {tirou
                        ? 'Você avisou que não precisa este mês.'
                        : qtd < maximo
                          ? `Vai receber ${fmt(qtd)} de ${fmt(maximo)} ${unidadeParaQuantidade(item?.unidade, maximo)}`
                          : `Vai receber ${fmt(maximo)} ${unidadeParaQuantidade(item?.unidade, maximo)}`}
                    </p>
                  </div>
                </div>
                {!tirou && item && variacaoLivre && (
                  <div className="space-y-1.5">
                    <p className="text-base">
                      Qual você prefere? <span className="text-muted-foreground">(se quiser escolher)</span>
                    </p>
                    {radioVariacao(l, item, 'kit')}
                  </div>
                )}
                {tirou ? (
                  <button
                    type="button"
                    onClick={() => alterar(l.chave, { quantidade: String(maximo) })}
                    className={cn(BOTAO_GRANDE, 'w-full bg-background', TONS.kit.contorno)}
                  >
                    Quero receber
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <CampoQuantidade
                      valor={l.quantidade}
                      onChange={(v) => alterar(l.chave, { quantidade: v === '' ? '' : String(Math.min(maximo, qtdNumero(v))) })}
                      rotulo={nome}
                      maximo={maximo}
                      tom="kit"
                    />
                    <button
                      type="button"
                      onClick={() => alterar(l.chave, { quantidade: '0' })}
                      className={cn(BOTAO_GRANDE, 'border-input bg-background text-muted-foreground')}
                    >
                      Não preciso
                    </button>
                  </div>
                )}
                <MensagemErro mensagens={errosLinha} />
              </div>
            )
          })}
          {naoVemEsteMes.length > 0 && (
            <Ajuda>Não vem este mês (chega a cada alguns meses): {naoVemEsteMes.join(', ')}. Se precisar, peça no campo azul.</Ajuda>
          )}
        </Parte>
      )}

      {/* ---------- 2. Pedido extra ---------- */}
      <Parte tom="extra" id={`extra-${secao}`} titulo="Precisa de mais alguma coisa?" subtitulo="Escreva o que precisa. O inspetor confere.">
        {extras.length > 0 && (
          <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
            {extras.length === 1 ? '1 item pedido' : `${extras.length} itens pedidos`}
          </p>
        )}
        {extras.map((l) => {
          const item = l.item_id ? porId.get(l.item_id) : undefined
          const qtd = qtdNumero(l.quantidade)
          const nome = nomeDaLinhaProduto(l, item)
          const semQtd = qtd <= 0
          if (!quadros.estaAberta(l.chave, false) && !semQtd) {
            return <LinhaResumo key={l.chave} tom="extra" texto={resumoLinhaProduto(nome, l.quantidade)} onAbrir={() => quadros.abrirSo(l.chave)} />
          }
          const exc = item
            ? excecoesLinhaPedido(ctx, item.id, l.variacao_id, qtd, 'extra')
            : { acimaKit: false, foraKit: qtd > 0, pedeMotivo: qtd > 0 }
          const errosLinha = quadros.errosDaLinha(l.chave)
          const mensagens = quadros.mostrarErro(l.chave) && semQtd ? ['Diga quantos você precisa.', ...errosLinha] : errosLinha
          const etiqueta = l.origem === 'livre' ? 'Escrito por você' : l.origem === 'mais' ? 'A mais do que vem no mês' : 'Não vem todo mês'
          // Só rascunho antigo chega aqui sem a variação que o item exige.
          const precisaVariacao = !!item && item.variacoes.length > 0 && !l.variacao_id && qtdKitPublico(ctx.kit, item.id, null) == null
          return (
            <div
              key={l.chave}
              data-erro={mensagens.length > 0 ? 'true' : undefined}
              className="space-y-3 rounded-2xl border-2 border-pedido-extra/50 bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-snug">{nome}</p>
                  <p className={cn('text-base font-medium', TONS.extra.texto)}>{etiqueta}</p>
                </div>
                <BotaoApagar rotulo={`Remover ${nome}`} onConfirmar={() => remover(l.chave)} />
              </div>
              {item && precisaVariacao && (
                <div className="space-y-1.5">
                  <p className="text-base font-medium">Qual?</p>
                  {radioVariacao(l, item, 'extra')}
                </div>
              )}
              <CampoQuantidade
                valor={l.quantidade}
                onChange={(v) => alterar(l.chave, { quantidade: v })}
                unidade={item?.unidade}
                rotulo={nome}
                minimo={1}
                tom="extra"
              />
              {exc.pedeMotivo && (
                <MotivoOpcional
                  pergunta={perguntaSimples(exc, qtd)}
                  valor={l.justificativa}
                  onChange={(v) => alterar(l.chave, { justificativa: v })}
                  rotulo={nome}
                />
              )}
              <MensagemErro mensagens={mensagens} />
              <BotaoPronto
                tom="extra"
                onClick={() => {
                  const valida = !quadros.invalida(l.chave, semQtd)
                  if (quadros.pronto(l.chave, valida)) focarDepois(campoBuscaId)
                }}
              />
            </div>
          )
        })}
        <BuscaOutroItem token={token} catalogoBusca={catalogoBusca} secao={secao} kit={ctx.kit} onEscolher={adicionarDaBusca} onLivre={adicionarLivre} />
        {avisoBusca && (
          <p role="status" className={cn('rounded-xl border-2 bg-card p-3 text-base font-medium', TONS.extra.contorno)}>
            {avisoBusca}
          </p>
        )}
      </Parte>
    </div>
  )
}

/**
 * Campo único "O que mais você precisa?" (16/10/2026 — substitui os botões
 * "Quero mais de um item do kit" e "Preciso de outro item", que confundiam).
 * Sempre aberto; o líder digita (pode errar: "cab", "piacava", "disco 350")
 * e o servidor devolve até 8 resultados ativos do kit e do catálogo, um por
 * variação. Nada casou → "Não achei, enviar assim" (texto livre).
 */
export function BuscaOutroItem({
  token,
  catalogoBusca,
  secao,
  kit,
  onEscolher,
  onLivre,
}: {
  token: string
  catalogoBusca?: ItemBuscavelPublico[]
  secao: SecaoProduto
  kit: ContextoPedido['kit']
  onEscolher: (item: ItemBuscaPublico) => void
  onLivre: (descricao: string) => void
}) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ItemBuscaPublico[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const sequencia = useRef(0)

  const curto = normalizarBusca(termo).replace(/ /g, '').length < BUSCA_MIN_CARACTERES
  // Busca LOCAL (decisão da gestora, 16/10/2026): o catálogo de nomes veio no
  // `carregar`; só um debounce curto de digitação, sem rede.
  const local = !!catalogoBusca
  const [termoLocal, setTermoLocal] = useState('')
  useEffect(() => {
    if (!local) return
    const t = setTimeout(() => setTermoLocal(termo), 100)
    return () => clearTimeout(t)
  }, [local, termo])
  const resultadosLocais = useMemo(() => {
    if (!catalogoBusca) return null
    const candidatos = catalogoBusca.filter((c) => (secao === 'portaria' ? c.categoria === 'portaria' : c.categoria !== 'portaria'))
    return buscarItens(termoLocal, candidatos, BUSCA_MAX_RESULTADOS).map(
      ({ item, variacao, nome }): ItemBuscaPublico => ({
        id: item.id,
        nome: item.nome,
        nome_lider: item.nome_lider ?? null,
        categoria: item.categoria,
        unidade: item.unidade,
        validade_meses: item.validade_meses,
        variacoes: item.variacoes,
        nome_exibicao: nome,
        variacao_id: variacao?.id ?? null,
      })
    )
  }, [catalogoBusca, termoLocal, secao])

  // Sem catálogo (resposta de function antiga em cache): busca pela rede, como antes.
  useEffect(() => {
    if (curto || local) return
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
  }, [curto, local, termo, token, secao])

  const limpar = () => {
    sequencia.current++
    setTermo('')
    setTermoLocal('')
    setResultados(null)
    setBuscando(false)
  }

  const lista = curto ? null : local ? resultadosLocais : resultados
  const campoId = `busca-item-${secao}`

  // No celular, o teclado cobre a metade de baixo da tela e escondia os
  // resultados (achado da gestora, 16/10/2026): ao tocar no campo e ao começar
  // a digitar, a busca sobe para o topo (abaixo do cabeçalho fixo — scroll-mt)
  // e os resultados ficam entre o campo e o teclado. O atraso espera o teclado
  // abrir e a tela encolher.
  const blocoBusca = useRef<HTMLDivElement>(null)
  const levarAoTopo = () => {
    window.setTimeout(() => blocoBusca.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 300)
  }

  return (
    <div ref={blocoBusca} className="scroll-mt-32 space-y-3">
      <label htmlFor={campoId} className={cn('block text-lg font-bold', TONS.extra.texto)}>
        O que mais você precisa?
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-6 -translate-y-1/2 text-pedido-extra" aria-hidden />
        <input
          id={campoId}
          type="text"
          className={cn(CAMPO, 'h-14 border-2 border-pedido-extra pl-12 pr-12 text-lg')}
          value={termo}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="search"
          onFocus={levarAoTopo}
          onChange={(e) => {
            if (!termo) levarAoTopo()
            setTermo(e.target.value)
          }}
          // Exemplos da própria seção — contrato só de portaria (ex.: Exclusive)
          // não pode ver sugestão de limpeza (retorno da gestora, 17/10/2026).
          placeholder={secao === 'portaria' ? 'Ex.: livro de ocorrências, protocolo' : 'Ex.: vassoura, detergente, flanela'}
        />
        {termo && (
          <button
            type="button"
            onClick={limpar}
            className="absolute right-1 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground"
            aria-label="Apagar o que escreveu"
          >
            <X className="size-6" />
          </button>
        )}
      </div>
      {termo.trim() === '' ? null : curto ? (
        <Ajuda>Escreva pelo menos {BUSCA_MIN_CARACTERES} letras. Pode escrever do seu jeito.</Ajuda>
      ) : buscando && !lista ? (
        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Procurando...
        </p>
      ) : (
        <div className="space-y-2">
          {lista && lista.length > 0 && <p className="text-base font-medium">Toque no item certo:</p>}
          {lista?.map((item) => {
            const nome = item.nome_exibicao || item.nome
            const doKit = qtdKitPublico(kit, item.id, item.variacao_id ?? null) != null
            return (
              <button
                key={`${item.id}|${item.variacao_id ?? ''}`}
                type="button"
                onClick={() => {
                  onEscolher(item)
                  limpar()
                }}
                className={cn(BOTAO_GRANDE, 'min-h-14 w-full justify-between gap-2 bg-card text-left', TONS.extra.contorno)}
              >
                <span className="min-w-0">
                  <span className="block text-foreground">{nome}</span>
                  {doKit && <span className="block text-sm font-medium text-pedido-kit-texto">Já vem no mês · pedir a mais</span>}
                </span>
                <Plus className="size-6 shrink-0" strokeWidth={3} aria-hidden />
              </button>
            )
          })}
          {falhou && <p className="text-base text-red-700 dark:text-red-400">Não deu para procurar agora. Tente de novo ou envie assim.</p>}
          {lista && lista.length === 0 && !falhou && <p className="text-base text-muted-foreground">Não encontramos nada parecido.</p>}
          {lista && lista.length >= BUSCA_MAX_RESULTADOS && (
            <p className="text-base text-muted-foreground">Não achou? Escreva mais, por exemplo: disco preto 350</p>
          )}
          {lista && (
            <button
              type="button"
              onClick={() => {
                onLivre(termo.trim())
                limpar()
              }}
              className={cn(BOTAO_GRANDE, 'w-full border-dashed bg-background', TONS.extra.contorno)}
            >
              Não achei, enviar assim: &quot;{termo.trim()}&quot;
            </button>
          )}
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
  tom,
  idFoco,
}: {
  equipe: MembroEquipePublico[]
  jaEscolhidos: Set<string>
  onEscolher: (p: { ref: string | null; nome: string }) => void
  titulo: string
  tom: Tom
  /** Id do título, para o foco ir para cá depois do "Pronto". */
  idFoco?: string
}) {
  const [outra, setOutra] = useState(false)
  const [nome, setNome] = useState('')
  const disponiveis = ordenarEquipe(equipe.filter((m) => !jaEscolhidos.has(m.ref)))
  return (
    <div className="space-y-3 rounded-2xl border-2 border-border bg-card p-4">
      <p id={idFoco} tabIndex={idFoco ? -1 : undefined} className={cn('text-lg font-bold outline-none', TONS[tom].texto)}>
        {titulo}
      </p>
      {disponiveis.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {disponiveis.map((m) => (
            <button
              key={m.ref}
              type="button"
              onClick={() => onEscolher({ ref: m.ref, nome: m.nome })}
              className={cn(BOTAO_GRANDE, 'min-h-14 bg-background', TONS[tom].contorno)}
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
              className={cn(BOTAO_GRANDE, TONS[tom].cheio, 'disabled:opacity-50')}
            >
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOutra(true)}
          className={cn(BOTAO_GRANDE, 'w-full gap-2 border-dashed bg-background', TONS[tom].contorno)}
        >
          <UserPlus className="size-6" /> Outra pessoa (ferista/cobertura)
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
  errosTodos,
}: {
  pessoas: PessoaForm[]
  setPessoas: (f: (l: PessoaForm[]) => PessoaForm[]) => void
  linhas: LinhaPecaForm[]
  setLinhas: (f: (l: LinhaPecaForm[]) => LinhaPecaForm[]) => void
  pecas: PecaPublica[]
  equipe: MembroEquipePublico[]
  semKitUniforme: boolean
  erros: ErroCampo[]
  errosTodos?: ErroCampo[]
}) {
  const quadros = useQuadros(errosTodos ?? erros, erros)
  const pecaPorId = new Map(pecas.map((x) => [x.id, x]))
  const funcaoPorRef = new Map(equipe.map((m) => [m.ref, m.funcao]))
  const [todasPara, setTodasPara] = useState<Set<string>>(new Set())
  const doisGrupos = equipeTemDoisGrupos(equipe)
  // Quem já está no pedido (rascunho) define o grupo inicial.
  const [grupo, setGrupo] = useState<GrupoEquipe | null>(() => {
    const primeira = pessoas.find((p) => p.ref)
    return primeira ? grupoDaFuncao(equipe.find((m) => m.ref === primeira.ref)?.funcao) : null
  })
  const precisaEscolherGrupo = doisGrupos && grupo === null
  const alterar = (chave: string, patch: Partial<LinhaPecaForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))

  return (
    <div className="space-y-4">
      {doisGrupos && (
        // Fica fixo logo abaixo do cabeçalho enquanto a pessoa rola: trocar de
        // grupo nunca exige voltar ao topo (nem apaga o que já foi pedido).
        <div className="sticky top-[92px] z-[9] -mx-4 space-y-1 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
          <p className={cn('text-base font-bold', TONS.epi.texto)}>{grupo ? 'Grupo' : 'Qual grupo?'}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Grupo da equipe">
            {GRUPOS_EQUIPE.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={grupo === g.id}
                onClick={() => setGrupo(g.id)}
                className={cn(BOTAO_GRANDE, 'min-h-14 text-base', grupo === g.id ? TONS.epi.cheio : 'border-input bg-background')}
              >
                {g.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}
      {semKitUniforme && (
        <Ajuda>Este contrato ainda não tem as peças cadastradas: aparecem todas as peças do estoque.</Ajuda>
      )}
      {pessoas.map((p) => {
        const funcao = p.ref ? funcaoPorRef.get(p.ref) ?? null : null
        const daFuncao = pecasParaFuncao(pecas, funcao)
        const mostrar = todasPara.has(p.chave) ? pecas : daFuncao
        const dela = linhas.filter((l) => l.pessoa === p.chave)
        return (
          <section key={p.chave} className="space-y-3 rounded-2xl border-2 border-pedido-epi/50 bg-card p-4" aria-label={`Pedido de ${p.nome}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={cn('text-xl font-bold', TONS.epi.texto)}>{p.nome}</p>
              <BotaoApagar
                rotulo={`Tirar ${p.nome} do pedido`}
                onConfirmar={() => {
                  setPessoas((ps) => ps.filter((x) => x.chave !== p.chave))
                  setLinhas((ls) => ls.filter((l) => l.pessoa !== p.chave))
                }}
              />
            </div>
            {dela.length === 0 && <Ajuda>Toque nas peças que {p.nome} precisa.</Ajuda>}
            {dela.length > 0 && (
              <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
                {dela.length === 1 ? '1 peça pedida' : `${dela.length} peças pedidas`}
              </p>
            )}
            {dela.map((linha) => {
              const peca = pecaPorId.get(linha.peca_id)
              if (!peca) return null
              const tamanhos = peca.opcoes.map((o) => o.tamanho).filter(Boolean)
              if (!quadros.estaAberta(linha.chave)) {
                return (
                  <LinhaResumo
                    key={linha.chave}
                    tom="epi"
                    texto={resumoLinhaPeca(p.nome, peca.rotulo, linha.tamanho, linha.quantidade)}
                    onAbrir={() => quadros.abrirSo(linha.chave)}
                  />
                )
              }
              const errosLinha = quadros.errosDaLinha(linha.chave)
              return (
                <div
                  key={linha.chave}
                  data-erro={errosLinha.length > 0 ? 'true' : undefined}
                  className="space-y-3 rounded-xl border-2 border-pedido-epi bg-pedido-epi-bg p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold">{peca.rotulo}</p>
                    <BotaoApagar rotulo={`Tirar ${peca.rotulo}`} onConfirmar={() => setLinhas((ls) => ls.filter((l) => l.chave !== linha.chave))} />
                  </div>
                  {peca.compra_na_loja && (
                    <p className="rounded-xl bg-muted px-3 py-2 text-base font-medium">Compra na loja com autorização — não precisa de tamanho.</p>
                  )}
                  {tamanhos.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-base font-semibold">Tamanho</p>
                      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={`Tamanho de ${peca.rotulo}`}>
                        {tamanhos.map((t) => (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={linha.tamanho === t}
                            onClick={() => alterar(linha.chave, { tamanho: t })}
                            className={cn(BOTAO_GRANDE, 'px-1 text-lg', linha.tamanho === t ? TONS.epi.cheio : 'border-input bg-background')}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <CampoQuantidade valor={linha.quantidade} onChange={(v) => alterar(linha.chave, { quantidade: v })} unidade="peça(s)" rotulo={peca.rotulo} minimo={1} tom="epi" />
                  <MensagemErro mensagens={errosLinha} />
                  <BotaoPronto
                    tom="epi"
                    onClick={() => {
                      const valida = !quadros.invalida(linha.chave) && qtdNumero(linha.quantidade) > 0
                      if (quadros.pronto(linha.chave, valida)) focarDepois(`proxima-peca-${p.chave}`)
                    }}
                  />
                </div>
              )
            })}
            {mostrar.some((peca) => !dela.some((l) => l.peca_id === peca.id)) && (
              <p id={`proxima-peca-${p.chave}`} tabIndex={-1} className={cn('pt-1 text-base font-bold outline-none', TONS.epi.texto)}>
                {dela.length > 0 ? `Outra peça para ${p.nome}?` : `Qual peça ${p.nome} precisa?`}
              </p>
            )}
            <ul className="space-y-2">
              {mostrar
                .filter((peca) => !dela.some((l) => l.peca_id === peca.id))
                .map((peca) => (
                  <li key={peca.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const chaveNova = novaChave()
                        quadros.abrirSo(chaveNova)
                        setLinhas((ls) => [...ls, { chave: chaveNova, pessoa: p.chave, peca_id: peca.id, tamanho: '', quantidade: '1' }])
                      }}
                      className={cn(BOTAO_GRANDE, 'min-h-14 w-full justify-between gap-2 border-input bg-background text-left')}
                    >
                      <span>{peca.rotulo}</span>
                      <Plus className="size-6 shrink-0 text-pedido-epi" strokeWidth={3} aria-hidden />
                    </button>
                  </li>
                ))}
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
                className={cn('w-full py-3 text-base font-semibold underline underline-offset-4', TONS.epi.texto)}
              >
                {todasPara.has(p.chave) ? 'Mostrar só as peças da função' : 'Ver todas as peças do posto'}
              </button>
            )}
          </section>
        )
      })}

      {!precisaEscolherGrupo && <EscolherPessoa
        equipe={equipeDoGrupo(equipe, doisGrupos ? grupo : null)}
        jaEscolhidos={new Set(pessoas.map((p) => p.ref).filter((r): r is string => !!r))}
        titulo={
          pessoas.length === 0
            ? 'Para quem é o pedido?'
            : doisGrupos && grupo
              ? `Mais alguém de ${GRUPOS_EQUIPE.find((g) => g.id === grupo)?.rotulo}?`
              : 'Mais alguém precisa?'
        }
        tom="epi"
        idFoco="escolher-pessoa-uniforme"
        onEscolher={(p) => {
          quadros.recolherValidas()
          setPessoas((ps) => [...ps, { chave: novaChave(), ref: p.ref, nome: p.nome }])
        }}
      />}
      {doisGrupos && grupo && (
        // Atalho grande para o OUTRO grupo, sempre abaixo das linhas já feitas.
        <button
          type="button"
          onClick={() => {
            setGrupo(grupo === 'portaria' ? 'limpeza' : 'portaria')
            focarDepois('escolher-pessoa-uniforme')
          }}
          className={cn(BOTAO_GRANDE, 'min-h-16 w-full gap-2 border-2 border-dashed text-lg', TONS.epi.contorno)}
        >
          <Plus className="size-6" strokeWidth={3} aria-hidden />
          {grupo === 'portaria' ? 'Pedir para Limpeza e encarregado' : 'Pedir para a Portaria'}
        </button>
      )}
    </div>
  )
}

// ---------------- Crachá ----------------

export function SecaoCrachas({
  linhas,
  setLinhas,
  equipe,
  erros,
  errosTodos,
}: {
  linhas: LinhaCrachaForm[]
  setLinhas: (f: (l: LinhaCrachaForm[]) => LinhaCrachaForm[]) => void
  equipe: MembroEquipePublico[]
  erros: ErroCampo[]
  errosTodos?: ErroCampo[]
}) {
  const quadros = useQuadros(errosTodos ?? erros, erros)
  const alterar = (chave: string, patch: Partial<LinhaCrachaForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))
  return (
    <div className="space-y-4">
      {linhas.length > 0 && (
        <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
          {linhas.length === 1 ? '1 crachá pedido' : `${linhas.length} crachás pedidos`}
        </p>
      )}
      {linhas.map((l) => {
        if (!quadros.estaAberta(l.chave)) {
          return <LinhaResumo key={l.chave} tom="cracha" texto={resumoLinhaCracha(l.nome, l.cracha_motivo)} onAbrir={() => quadros.abrirSo(l.chave)} />
        }
        const errosLinha = quadros.errosDaLinha(l.chave)
        return (
        <section
          key={l.chave}
          data-erro={errosLinha.length > 0 ? 'true' : undefined}
          className="space-y-3 rounded-2xl border-2 border-pedido-cracha/50 bg-card p-4"
          aria-label={`Crachá de ${l.nome}`}
        >
          <div className="flex items-center justify-between">
            <p className={cn('text-xl font-bold', TONS.cracha.texto)}>{l.nome}</p>
            <BotaoApagar rotulo={`Tirar o crachá de ${l.nome}`} onConfirmar={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))} />
          </div>
          <div>
            <p className="mb-1.5 text-base font-semibold">Por que precisa?</p>
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
                    'justify-start text-left',
                    l.cracha_motivo === m ? TONS.cracha.cheio : 'border-input bg-background'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-base font-semibold">Precisa de cordão novo com prendedor?</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Precisa de novo cordão com prendedor?">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={l.cracha_cordao === v}
                  onClick={() => alterar(l.chave, { cracha_cordao: v })}
                  className={cn(BOTAO_GRANDE, l.cracha_cordao === v ? TONS.cracha.cheio : 'border-input bg-background')}
                >
                  {v ? 'Sim' : 'Não'}
                </button>
              ))}
            </div>
          </div>
          {l.ref ? (
            <div className="space-y-1.5">
              <label htmlFor={`cracha-${l.chave}`} className="text-base font-semibold">
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
          <MensagemErro mensagens={errosLinha} />
          <BotaoPronto
            tom="cracha"
            onClick={() => {
              if (quadros.pronto(l.chave, !quadros.invalida(l.chave))) focarDepois('proximo-cracha')
            }}
          />
        </section>
        )
      })}
      <EscolherPessoa
        idFoco="proximo-cracha"
        equipe={equipe}
        jaEscolhidos={new Set(linhas.map((l) => l.ref).filter((r): r is string => !!r))}
        titulo={linhas.length === 0 ? 'Quem precisa de crachá?' : 'Mais alguém precisa de crachá?'}
        tom="cracha"
        onEscolher={(p) => {
          const chaveNova = novaChave()
          quadros.abrirSo(chaveNova)
          setLinhas((ls) => [...ls, { chave: chaveNova, ref: p.ref, nome: p.nome, cracha_nome: '', cracha_motivo: '', cracha_cordao: false }])
        }}
      />
    </div>
  )
}
