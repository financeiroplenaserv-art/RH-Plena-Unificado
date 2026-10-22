import { useMemo, useState } from 'react'
import { ExternalLink, Route, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { hojeBrasil } from '@/lib/utils'
import { bilhetesVigentes, custoDiaBilhetesCentavos, formatarCentavos } from '@/lib/vt/bilhetes'
import { custoDiaTrajetoCentavos, escopoSugerido } from '@/lib/vt/trajetos'
import { linkGoogleMapsTransito, precisaoDoEndereco, textoOrigemCasa } from '@/lib/vt/enderecos'
import type { NovoTrajetoVT, VtColaborador, VtDepartamento, VtTrajetoComDetalhes } from '@/hooks/useVt'
import type { EscopoTrajetoVT, VtBilhete } from '@/types/vt'

// Aba Trajetos do VT (Fase 1): uma linha por par colaborador × posto. A
// precificação é por bilhete nomeado com valor diário (modelo de 21/10/2026,
// plano §2d; "combinação" virou "bilhete" — migration 156): bilhete 1
// obrigatório + bilhete 2 opcional, custo = soma. O trajeto só entra no
// cálculo depois de confirmado pelo RH — "importação nunca grava palpite"
// (AGENTS.md §12, plano §4). O escopo é apenas um selo informacional das
// cidades casa × posto (não precifica).

/** Selo somente leitura do escopo: Niterói / Intermunicipal / cidade da casa. */
function seloEscopo(escopo: EscopoTrajetoVT, cidadeCasa: string | null): string {
  if (escopo === 'niteroi_municipal') return 'Niterói'
  if (escopo === 'intermunicipal') return 'Intermunicipal'
  return cidadeCasa?.trim() || 'Outra cidade'
}

function destinoPosto(dep: { endereco: string | null; cidade: string | null; nome_curto: string | null; nome: string }): string {
  const partes = [dep.endereco, dep.cidade].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : dep.nome_curto || dep.nome
}

interface LinhaTrajeto {
  chave: string
  colaboradorId: string
  nomeColaborador: string
  departamentoId: string
  nomePosto: string
  enderecoCasa: string | null
  cidadeCasa: string | null
  enderecoPosto: string | null
  cidadePosto: string | null
  trajeto: VtTrajetoComDetalhes | null // null = sugestão ainda não gravada
}

interface VtTrajetosTabProps {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  bilhetes: VtBilhete[]
  trajetos: VtTrajetoComDetalhes[]
  loading: boolean
  usuarioId: string
  podeGerenciar: boolean
  salvarTrajeto: (dados: NovoTrajetoVT) => Promise<string | null>
  confirmarTrajeto: (id: string, usuarioId: string) => Promise<boolean>
  removerTrajeto: (id: string) => Promise<boolean>
  recarregarTrajetos: () => Promise<boolean>
}

const NENHUM = '__nenhum__'

export function VtTrajetosTab({
  colaboradores,
  departamentos,
  bilhetes,
  trajetos,
  loading,
  usuarioId,
  podeGerenciar,
  salvarTrajeto,
  confirmarTrajeto,
  removerTrajeto,
  recarregarTrajetos,
}: VtTrajetosTabProps) {
  const hoje = hojeBrasil()
  const [edicoes, setEdicoes] = useState<Record<string, { b1: string; b2: string }>>({})
  // Visibilidade do 2º bilhete por linha (poucos colaboradores usam — não
  // ocupa a tela de todo mundo). Padrão: visível só quando o trajeto gravado
  // já tem bilhete_2_id (dado gravado nunca é escondido).
  const [mostrarB2, setMostrarB2] = useState<Record<string, boolean>>({})
  const [dialogAberto, setDialogAberto] = useState(false)
  const [excluindo, setExcluindo] = useState<LinhaTrajeto | null>(null)
  const [novoColaboradorId, setNovoColaboradorId] = useState('')
  const [novoDepartamentoId, setNovoDepartamentoId] = useState('')
  const [novoB1, setNovoB1] = useState('')
  const [novoB2, setNovoB2] = useState('')
  const [temB2, setTemB2] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Opções dos selects: os vigentes hoje. Bilhete referenciado por trajeto
  // gravado que saiu de vigor continua aparecendo (selo "vigência antiga")
  // para o select não ficar vazio — trocar por um vigente atualiza o custo.
  const vigentes = useMemo(() => bilhetesVigentes(bilhetes, hoje), [bilhetes, hoje])

  const nomePosto = (depId: string, nomeTexto?: string | null) =>
    departamentos.find((d) => d.id === depId)?.nome_curto?.trim() ||
    departamentos.find((d) => d.id === depId)?.nome.trim() ||
    nomeTexto?.trim() ||
    '—'

  const linhas = useMemo<LinhaTrajeto[]>(() => {
    const porChave = new Map<string, LinhaTrajeto>()
    for (const t of trajetos) {
      const colab = t.colaborador ?? colaboradores.find((c) => c.id === t.colaborador_id) ?? null
      const dep = t.departamento ?? departamentos.find((d) => d.id === t.departamento_id) ?? null
      porChave.set(`${t.colaborador_id}|${t.departamento_id}`, {
        chave: t.id,
        colaboradorId: t.colaborador_id,
        nomeColaborador: colab?.nome_completo ?? '—',
        departamentoId: t.departamento_id,
        nomePosto: dep ? nomePosto(dep.id, dep.nome) : '—',
        enderecoCasa: colab?.endereco ?? null,
        cidadeCasa: colab?.cidade ?? null,
        enderecoPosto: dep?.endereco ?? null,
        cidadePosto: dep?.cidade ?? null,
        trajeto: t,
      })
    }
    // Sugestão padrão: optante × posto atual do cadastro. NÃO lê
    // locais_trabalho_diario (mapeamento local→departamento é fuzzy —
    // descoberta por escala fica para a Fase 2).
    for (const c of colaboradores) {
      if (!c.vt_optante || !c.departamento_id) continue
      const chavePar = `${c.id}|${c.departamento_id}`
      if (porChave.has(chavePar)) continue
      const dep = departamentos.find((d) => d.id === c.departamento_id) ?? null
      porChave.set(chavePar, {
        chave: `sug:${chavePar}`,
        colaboradorId: c.id,
        nomeColaborador: c.nome_completo,
        departamentoId: c.departamento_id,
        nomePosto: dep ? nomePosto(dep.id, c.departamento) : (c.departamento ?? '—'),
        enderecoCasa: c.endereco,
        cidadeCasa: c.cidade,
        enderecoPosto: dep?.endereco ?? null,
        cidadePosto: dep?.cidade ?? null,
        trajeto: null,
      })
    }
    return Array.from(porChave.values()).sort((a, b) =>
      a.nomeColaborador.localeCompare(b.nomeColaborador, 'pt-BR')
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajetos, colaboradores, departamentos])

  const valoresDa = (linha: LinhaTrajeto) =>
    edicoes[linha.chave] ?? {
      b1: linha.trajeto?.bilhete_id ?? '',
      b2: linha.trajeto?.bilhete_2_id ?? '',
    }

  /** Opções do select da linha: vigentes + os referenciados pelo trajeto (antigos). */
  const opcoesDa = (linha: LinhaTrajeto): { id: string; nome: string; antigo: boolean }[] => {
    const base = vigentes.map((b) => ({ id: b.id, nome: b.nome, antigo: false }))
    const valores = valoresDa(linha)
    for (const id of [valores.b1, valores.b2]) {
      if (id && !base.some((o) => o.id === id)) {
        const ref = bilhetes.find((b) => b.id === id)
        if (ref) base.push({ id: ref.id, nome: ref.nome, antigo: true })
      }
    }
    return base
  }

  const dadosDaLinha = (linha: LinhaTrajeto, valores: { b1: string; b2: string }): NovoTrajetoVT => ({
    colaborador_id: linha.colaboradorId,
    departamento_id: linha.departamentoId,
    bilhete_id: valores.b1,
    bilhete_2_id: valores.b2 || null,
    escopo: linha.trajeto?.escopo ?? escopoSugerido(linha.cidadeCasa, linha.cidadePosto),
    precisao_origem: linha.trajeto?.precisao_origem ?? precisaoDoEndereco(linha.enderecoCasa),
    observacao: linha.trajeto?.observacao ?? null,
  })

  // Trajeto já gravado: salva na troca do bilhete (mesmo padrão de antes).
  // Sugestões (ainda não gravadas) só persistem no "Confirmar".
  const editar = (linha: LinhaTrajeto, parcial: Partial<{ b1: string; b2: string }>) => {
    const valores = { ...valoresDa(linha), ...parcial }
    // O 2º nunca repete o 1º (CHECK bilhete_2_id <> bilhete_id).
    if (valores.b1 && valores.b1 === valores.b2) valores.b2 = ''
    setEdicoes((atual) => ({ ...atual, [linha.chave]: valores }))
    if (linha.trajeto && podeGerenciar && valores.b1) {
      salvarTrajeto(dadosDaLinha(linha, valores)).then((id) => {
        if (id) recarregarTrajetos()
      })
    }
  }

  const confirmar = async (linha: LinhaTrajeto) => {
    const valores = valoresDa(linha)
    if (!linha.trajeto && !valores.b1) return
    setSalvando(true)
    if (linha.trajeto) {
      await confirmarTrajeto(linha.trajeto.id, usuarioId)
    } else {
      const id = await salvarTrajeto(dadosDaLinha(linha, valores))
      if (id) await confirmarTrajeto(id, usuarioId)
    }
    await recarregarTrajetos()
    setSalvando(false)
  }

  const abrirRota = (linha: LinhaTrajeto) => {
    const origem = textoOrigemCasa(linha.enderecoCasa, linha.cidadeCasa)
    const dep = departamentos.find((d) => d.id === linha.departamentoId)
    const destino = dep
      ? destinoPosto(dep)
      : [linha.enderecoPosto, linha.cidadePosto].filter(Boolean).join(', ') || linha.nomePosto
    window.open(linkGoogleMapsTransito(origem, destino), '_blank', 'noopener,noreferrer')
  }

  const custoDaLinha = (linha: LinhaTrajeto): number | null => {
    if (linha.trajeto && !edicoes[linha.chave]) {
      return custoDiaTrajetoCentavos(linha.trajeto, bilhetes, hoje)
    }
    const valores = valoresDa(linha)
    const b1 = vigentes.find((b) => b.id === valores.b1)
    if (!b1) return null
    const b2 = valores.b2 ? (vigentes.find((b) => b.id === valores.b2) ?? null) : null
    if (valores.b2 && !b2) return null
    return custoDiaBilhetesCentavos(b1, b2)
  }

  const optantes = useMemo(() => colaboradores.filter((c) => c.vt_optante), [colaboradores])

  const salvarNovo = async () => {
    const colab = colaboradores.find((c) => c.id === novoColaboradorId)
    if (!colab || !novoDepartamentoId || !novoB1) return
    const dep = departamentos.find((d) => d.id === novoDepartamentoId)
    setSalvando(true)
    const id = await salvarTrajeto({
      colaborador_id: colab.id,
      departamento_id: novoDepartamentoId,
      bilhete_id: novoB1,
      bilhete_2_id: novoB2 || null,
      escopo: escopoSugerido(colab.cidade, dep?.cidade ?? null),
      precisao_origem: precisaoDoEndereco(colab.endereco),
    })
    setSalvando(false)
    if (id) {
      await recarregarTrajetos()
      setDialogAberto(false)
      setNovoColaboradorId('')
      setNovoDepartamentoId('')
      setNovoB1('')
      setNovoB2('')
      setTemB2(false)
      toast.success('Trajeto adicionado — confira a rota e confirme')
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo?.trajeto) return
    const ok = await removerTrajeto(excluindo.trajeto.id)
    if (ok) await recarregarTrajetos()
    setExcluindo(null)
  }

  const selectBilhete = (
    linha: LinhaTrajeto,
    campo: 'b1' | 'b2',
    valor: string,
    opcoes: { id: string; nome: string; antigo: boolean }[]
  ) => (
    <Select
      value={campo === 'b2' ? valor || NENHUM : valor}
      disabled={!podeGerenciar || salvando}
      onValueChange={(v) => {
        editar(linha, { [campo]: v === NENHUM ? '' : v })
        // "Nenhum" no 2º recolhe o select — volta ao estado simples da linha.
        if (campo === 'b2' && v === NENHUM) {
          setMostrarB2((atual) => ({ ...atual, [linha.chave]: false }))
        }
      }}
    >
      <SelectTrigger className="h-8 w-52 text-[13px]">
        <SelectValue placeholder={campo === 'b1' ? 'Escolha o bilhete' : 'Nenhum'} />
      </SelectTrigger>
      <SelectContent>
        {campo === 'b2' && <SelectItem value={NENHUM}>Nenhum</SelectItem>}
        {opcoes
          .filter((o) => campo === 'b2' && o.id === valoresDa(linha).b1 ? false : true)
          .map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nome}
              {o.antigo ? ' (vigência antiga)' : ''}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      <ModuleCard>
        <p className="text-[13px] text-muted-foreground">
          Abra a rota no Google Maps, veja o trajeto que a pessoa faz, escolha o bilhete de VT
          correspondente e confirme — a maioria usa um bilhete só; se a pessoa precisa de dois,
          clique em + 2º bilhete. Só trajetos <strong>confirmados</strong> entram no custo do dia.
        </p>
      </ModuleCard>

      <ModuleCard
        title="Trajetos casa → posto"
        description={`${linhas.filter((l) => l.trajeto?.status === 'confirmado').length} confirmados de ${linhas.length} pares`}
      >
        {podeGerenciar && (
          <div className="mb-4 flex justify-end">
            <ModuleButton size="sm" onClick={() => setDialogAberto(true)}>
              <Route className="size-4" />
              Adicionar trajeto
            </ModuleButton>
          </div>
        )}
        {linhas.length === 0 ? (
          <EmptyState
            icon={<Route className="size-6" />}
            description={
              loading
                ? 'Carregando trajetos...'
                : 'Nenhum trajeto. Marque os optantes na aba Colaboradores.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3">Colaborador</th>
                  <th className="px-3 py-3">Posto</th>
                  <th className="px-3 py-3">Escopo</th>
                  <th className="px-3 py-3">Bilhete</th>
                  <th className="px-3 py-3 text-right">Custo/dia</th>
                  <th className="px-3 py-3">Precisão</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => {
                  const valores = valoresDa(linha)
                  const opcoes = opcoesDa(linha)
                  const custo = custoDaLinha(linha)
                  const escopo = linha.trajeto?.escopo ?? escopoSugerido(linha.cidadeCasa, linha.cidadePosto)
                  const precisao = linha.trajeto?.precisao_origem ?? precisaoDoEndereco(linha.enderecoCasa)
                  const confirmado = linha.trajeto?.status === 'confirmado'
                  const b2Visivel = mostrarB2[linha.chave] ?? !!valores.b2
                  return (
                    <tr key={linha.chave} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-3 py-2.5 font-medium text-foreground">{linha.nomeColaborador}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{linha.nomePosto}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge variant="info" dot={false}>
                          {seloEscopo(escopo, linha.cidadeCasa)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            {selectBilhete(linha, 'b1', valores.b1, opcoes)}
                            {podeGerenciar && !b2Visivel && (
                              <button
                                type="button"
                                className="shrink-0 rounded-md px-1.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-primary"
                                title="Adicionar segundo bilhete — poucos colaboradores usam"
                                onClick={() =>
                                  setMostrarB2((atual) => ({ ...atual, [linha.chave]: true }))
                                }
                              >
                                + 2º bilhete
                              </button>
                            )}
                          </div>
                          {b2Visivel && selectBilhete(linha, 'b2', valores.b2, opcoes)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {custo == null ? '—' : formatarCentavos(custo)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge variant={precisao === 'exato' ? 'success' : 'warning'}>
                          {precisao === 'exato' ? 'exato' : 'bairro'}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge variant={confirmado ? 'success' : 'warning'}>
                          {confirmado ? 'Confirmado' : 'A confirmar'}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-primary hover:bg-accent"
                            title="Ver rota no Google Maps"
                            onClick={() => abrirRota(linha)}
                          >
                            <ExternalLink className="size-4" />
                          </button>
                          {podeGerenciar && !confirmado && (
                            <ModuleButton
                              size="sm"
                              variant="outline"
                              disabled={salvando || (!linha.trajeto && !valores.b1)}
                              onClick={() => confirmar(linha)}
                            >
                              Confirmar
                            </ModuleButton>
                          )}
                          {podeGerenciar && linha.trajeto && (
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                              title="Excluir trajeto"
                              onClick={() => setExcluindo(linha)}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </ModuleCard>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar trajeto</DialogTitle>
            <DialogDescription>
              Par extra de colaborador optante × posto (ex.: cobertura em outro contrato).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Colaborador (optante)</Label>
              <Select value={novoColaboradorId} onValueChange={setNovoColaboradorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {optantes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_completo} — {nomePosto(c.departamento_id ?? '', c.departamento)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Posto</Label>
              <DepartamentoAutocomplete
                value={novoDepartamentoId}
                onChange={setNovoDepartamentoId}
                clearValue=""
                clearLabel="Selecione o posto"
                placeholder="Buscar posto..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bilhete 1</Label>
              <Select
                value={novoB1}
                onValueChange={(v) => {
                  setNovoB1(v)
                  if (v === novoB2) setNovoB2('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Obrigatório" />
                </SelectTrigger>
                <SelectContent>
                  {vigentes.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome} ({formatarCentavos(b.valor_diario_centavos)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="vt-tem-b2"
                checked={temB2}
                onCheckedChange={(marcado) => {
                  setTemB2(marcado === true)
                  if (!marcado) setNovoB2('')
                }}
              />
              <Label htmlFor="vt-tem-b2" className="cursor-pointer text-muted-foreground">
                Tem segundo bilhete (poucos colaboradores usam)
              </Label>
            </div>
            {temB2 && (
              <div className="space-y-1.5">
                <Label>Bilhete 2</Label>
                <Select value={novoB2 || NENHUM} onValueChange={(v) => setNovoB2(v === NENHUM ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Nenhum</SelectItem>
                    {vigentes
                      .filter((b) => b.id !== novoB1)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.nome} ({formatarCentavos(b.valor_diario_centavos)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <ModuleButton variant="outline" onClick={() => setDialogAberto(false)} disabled={salvando}>
              Cancelar
            </ModuleButton>
            <ModuleButton
              onClick={salvarNovo}
              disabled={!novoColaboradorId || !novoDepartamentoId || !novoB1 || salvando}
            >
              {salvando ? 'Salvando...' : 'Adicionar'}
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!excluindo}
        onOpenChange={() => setExcluindo(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Excluir trajeto?"
        description={
          excluindo
            ? `O trajeto ${excluindo.nomeColaborador} → ${excluindo.nomePosto} será removido e sai do cálculo do custo do dia.`
            : ''
        }
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExclusao}
        destructive
      />
    </div>
  )
}
