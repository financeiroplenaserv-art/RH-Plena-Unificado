import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Download, FileUp, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { extrairPaginasPosicionais } from '@/lib/pdfPosicional'
import { formatarData, hojeBrasil } from '@/lib/utils'
import {
  calcularPreviaOptantes,
  extrairRelatorioAlterdata,
  type ColaboradorOptante,
  type PreviaOptantes,
  type RegistroAlterdata,
} from '@/lib/vt/importacaoAlterdata'
import {
  calcularPreviaRiocard,
  extrairRiocard,
  type ColaboradorRiocard,
  type LinhaRiocard,
  type PreviaRiocard,
  type RelatorioRiocard,
} from '@/lib/vt/importacaoRiocard'
import {
  abasConferenciaOptantes,
  abasConferenciaRiocard,
  baixarExcelConferencia,
  dataParaNomeArquivo,
} from '@/lib/vt/excelImportacoes'
import { useVtImportacoes, type ResultadoGravacao } from '@/hooks/useVtImportacoes'
import { InstrucoesImportacoes } from '@/pages/vt/InstrucoesArquivosVt'

// Aba "Importações do mês" do VT: a gestora sobe os relatórios que antes eram
// processados à mão (optantes do Alterdata e situação do BU da Riocard). Tudo é
// lido no navegador; nada grava sem a prévia e a confirmação.

interface Props {
  podeGerenciar: boolean
  recarregarVt: () => Promise<void> | void
}

type ColabCompleto = ColaboradorOptante & ColaboradorRiocard

function Secao({
  titulo,
  quantidade,
  dica,
  children,
  variante = 'neutral',
}: {
  titulo: string
  quantidade: number
  dica?: string
  children?: React.ReactNode
  variante?: 'neutral' | 'info' | 'warning' | 'danger' | 'success'
}) {
  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-foreground">
        <span>{titulo}</span>
        <StatusBadge variant={quantidade === 0 ? 'neutral' : variante} dot={false}>
          {quantidade}
        </StatusBadge>
        {dica && <span className="text-[12px] font-normal text-muted-foreground">{dica}</span>}
      </summary>
      {quantidade > 0 && <div className="overflow-x-auto border-t border-border">{children}</div>}
    </details>
  )
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: (string | number)[][] }) {
  const limite = 300
  return (
    <table className="w-full min-w-[640px] text-[12px] tabular-nums">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          {cabecalho.map((c) => (
            <th key={c} className="px-4 py-2 font-semibold">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.slice(0, limite).map((l, i) => (
          <tr key={i} className="border-t border-border hover:bg-accent/40">
            {l.map((c, j) => (
              <td key={j} className="px-4 py-1.5">
                {c}
              </td>
            ))}
          </tr>
        ))}
        {linhas.length > limite && (
          <tr>
            <td colSpan={cabecalho.length} className="px-4 py-2 text-muted-foreground">
              … e mais {linhas.length - limite}. A lista completa está no Excel de conferência.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function Resultado({ r }: { r: ResultadoGravacao }) {
  const ok = r.erros.length === 0 && r.gravadas === r.esperadas
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-[13px] ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}
    >
      <p className="font-semibold">
        {ok ? 'Tudo gravado.' : 'Gravação com problema.'} {r.gravadas} de {r.esperadas} cadastros atualizados.
      </p>
      {r.erros.slice(0, 10).map((e) => (
        <p key={e} className="mt-1 text-[12px]">
          {e}
        </p>
      ))}
    </div>
  )
}

export function VtImportacoesTab({ podeGerenciar, recarregarVt }: Props) {
  const { carregarColaboradores, gravarOptantes, gravarBU } = useVtImportacoes()
  const [colaboradores, setColaboradores] = useState<ColabCompleto[] | null>(null)

  // --- A) Optantes ---
  const [descontaReg, setDescontaReg] = useState<RegistroAlterdata[] | null>(null)
  const [naoReg, setNaoReg] = useState<RegistroAlterdata[] | null>(null)
  const [arquivosAlterdata, setArquivosAlterdata] = useState<string[]>([])
  const [lendoA, setLendoA] = useState(false)
  const [desmarcadosA, setDesmarcadosA] = useState<Set<string>>(new Set())
  const [confirmarA, setConfirmarA] = useState(false)
  const [gravandoA, setGravandoA] = useState(false)
  const [resultadoA, setResultadoA] = useState<ResultadoGravacao | null>(null)

  // --- B) Riocard ---
  const [relatoriosRio, setRelatoriosRio] = useState<RelatorioRiocard[]>([])
  const [dataConsulta, setDataConsulta] = useState(hojeBrasil())
  const [lendoB, setLendoB] = useState(false)
  const [desmarcadosB, setDesmarcadosB] = useState<Set<string>>(new Set())
  const [confirmarB, setConfirmarB] = useState(false)
  const [gravandoB, setGravandoB] = useState(false)
  const [resultadoB, setResultadoB] = useState<ResultadoGravacao | null>(null)

  async function garantirColaboradores(forcar = false): Promise<ColabCompleto[]> {
    if (colaboradores && !forcar) return colaboradores
    const lista = (await carregarColaboradores()) as unknown as ColabCompleto[]
    setColaboradores(lista)
    return lista
  }

  async function lerAlterdata(files: FileList | null) {
    if (!files?.length) return
    setLendoA(true)
    setResultadoA(null)
    try {
      await garantirColaboradores(true)
      let desc: RegistroAlterdata[] = descontaReg ?? []
      let nao: RegistroAlterdata[] = naoReg ?? []
      const nomes: string[] = [...arquivosAlterdata]
      for (const f of Array.from(files)) {
        const rel = extrairRelatorioAlterdata(await extrairPaginasPosicionais(f))
        if (!rel.tipo || rel.registros.length === 0) {
          toast.error(`"${f.name}": não reconheci como relatório de optantes do Alterdata.`)
          continue
        }
        if (rel.tipo === 'desconta') desc = rel.registros
        else nao = rel.registros
        nomes.push(`${f.name} (${rel.tipo === 'desconta' ? 'desconta VT' : 'não beneficiário'}: ${rel.registros.length})`)
      }
      setDescontaReg(desc)
      setNaoReg(nao)
      setArquivosAlterdata(nomes)
      setDesmarcadosA(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui ler o PDF.')
    } finally {
      setLendoA(false)
    }
  }

  async function lerRiocard(files: FileList | null) {
    if (!files?.length) return
    setLendoB(true)
    setResultadoB(null)
    try {
      await garantirColaboradores(true)
      const novos: RelatorioRiocard[] = [...relatoriosRio]
      for (const f of Array.from(files)) {
        const rel = extrairRiocard(await extrairPaginasPosicionais(f))
        if (rel.linhas.length === 0) {
          toast.error(`"${f.name}": não encontrei funcionários da Riocard neste PDF.`)
          continue
        }
        // Mesmo CNPJ de novo = substitui o arquivo anterior da conta.
        const i = novos.findIndex((r) => r.cnpj && r.cnpj === rel.cnpj)
        if (i >= 0) novos[i] = rel
        else novos.push(rel)
        if (rel.emitidoEm) setDataConsulta(rel.emitidoEm)
      }
      setRelatoriosRio(novos)
      setDesmarcadosB(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui ler o PDF.')
    } finally {
      setLendoB(false)
    }
  }

  const previaA: PreviaOptantes | null = useMemo(
    () => (colaboradores && (descontaReg || naoReg) ? calcularPreviaOptantes(descontaReg ?? [], naoReg ?? [], colaboradores) : null),
    [colaboradores, descontaReg, naoReg],
  )

  const linhasRio: LinhaRiocard[] = useMemo(() => relatoriosRio.flatMap((r) => r.linhas), [relatoriosRio])
  const previaB: PreviaRiocard | null = useMemo(
    () => (colaboradores && linhasRio.length ? calcularPreviaRiocard(linhasRio, colaboradores, dataConsulta) : null),
    [colaboradores, linhasRio, dataConsulta],
  )

  const mudancasA = useMemo(
    () => (previaA ? [...previaA.virarOptante, ...previaA.deixarDeSerOptante].filter((m) => !desmarcadosA.has(m.colaborador.id)) : []),
    [previaA, desmarcadosA],
  )
  const mudancasB = useMemo(
    () => (previaB ? [...previaB.mudancas, ...previaB.semMudancaSituacao].filter((m) => !desmarcadosB.has(m.colaborador.id)) : []),
    [previaB, desmarcadosB],
  )

  async function gravarA() {
    setConfirmarA(false)
    setGravandoA(true)
    try {
      const r = await gravarOptantes(mudancasA)
      setResultadoA(r)
      if (r.erros.length === 0) toast.success(`${r.gravadas} optantes atualizados.`)
      else toast.error('Houve erro na gravação. Veja o resumo abaixo.')
      await recarregarVt()
      const lista = await garantirColaboradores(true)
      setColaboradores(lista)
    } finally {
      setGravandoA(false)
    }
  }

  async function gravarB() {
    setConfirmarB(false)
    setGravandoB(true)
    try {
      const r = await gravarBU(mudancasB)
      setResultadoB(r)
      if (r.erros.length === 0) toast.success(`${r.gravadas} cadastros atualizados.`)
      else toast.error('Houve erro na gravação. Veja o resumo abaixo.')
      await recarregarVt()
      await garantirColaboradores(true)
    } finally {
      setGravandoB(false)
    }
  }

  function alternar(set: Set<string>, id: string): Set<string> {
    const novo = new Set(set)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    return novo
  }

  if (!podeGerenciar) {
    return (
      <EmptyState
        icon={<FileUp className="size-6" />}
        title="Importações do mês"
        description="Só quem gerencia o Vale-Transporte pode importar os relatórios. Peça para a mesa ou o DP."
      />
    )
  }

  return (
    <div className="space-y-6">
      <InstrucoesImportacoes />

      {/* ---------- A) Optantes ---------- */}
      <ModuleCard
        title="1. Quem é optante do VT (Alterdata)"
        description="Atualiza a marcação de optante de cada colaborador a partir dos relatórios do Alterdata."
        icon={<FileUp className="size-4" />}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-alterdata">PDFs do Alterdata (desconta VT e Declaração de Não Beneficiário)</Label>
            <Input
              id="pdf-alterdata"
              type="file"
              accept="application/pdf"
              multiple
              disabled={lendoA}
              onChange={(e) => {
                void lerAlterdata(e.target.files)
                e.target.value = ''
              }}
            />
            {lendoA && <p className="text-[12px] text-muted-foreground">Lendo os arquivos…</p>}
            {arquivosAlterdata.map((n) => (
              <p key={n} className="text-[12px] text-muted-foreground">
                Lido: {n}
              </p>
            ))}
          </div>

          {previaA && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-[12px]">
                <StatusBadge variant="success">{previaA.virarOptante.length} vão virar optantes</StatusBadge>
                <StatusBadge variant="warning">{previaA.deixarDeSerOptante.length} vão deixar de ser</StatusBadge>
                <StatusBadge variant="neutral">{previaA.semMudanca.length} sem mudança</StatusBadge>
                {previaA.conflitos.length > 0 && <StatusBadge variant="danger">{previaA.conflitos.length} nos dois relatórios (não grava)</StatusBadge>}
              </div>

              {!descontaReg && <p className="text-[12px] text-amber-700">Falta o relatório "desconta VT": só estou vendo os não beneficiários.</p>}
              {!naoReg && <p className="text-[12px] text-amber-700">Falta a "Declaração de Não Beneficiário": só estou vendo quem desconta.</p>}

              <Secao titulo="Vão virar optantes" quantidade={previaA.virarOptante.length} variante="success" dica="desmarque quem não deve mudar">
                <TabelaMudancasOptante lista={previaA.virarOptante} desmarcados={desmarcadosA} onAlternar={(id) => setDesmarcadosA((s) => alternar(s, id))} />
              </Secao>
              <Secao titulo="Vão deixar de ser optantes" quantidade={previaA.deixarDeSerOptante.length} variante="warning" dica="desmarque quem não deve mudar">
                <TabelaMudancasOptante lista={previaA.deixarDeSerOptante} desmarcados={desmarcadosA} onAlternar={(id) => setDesmarcadosA((s) => alternar(s, id))} />
              </Secao>
              <Secao titulo="Sem mudança" quantidade={previaA.semMudanca.length}>
                <Tabela cabecalho={['Nome', 'CPF', 'Optante']} linhas={previaA.semMudanca.map((m) => [m.colaborador.nome_completo, m.registro.cpf ?? '', m.para ? 'Sim' : 'Não'])} />
              </Secao>
              <Secao titulo="Estão nos DOIS relatórios (não grava, confira no Alterdata)" quantidade={previaA.conflitos.length} variante="danger">
                <Tabela cabecalho={['Nome', 'CPF']} linhas={previaA.conflitos.map((c) => [c.colaborador.nome_completo, c.descontaRegistro.cpf ?? ''])} />
              </Secao>
              <Secao titulo="Não encontrados no CORH" quantidade={previaA.naoEncontradosDesconta.length + previaA.naoEncontradosNaoBeneficiario.length} variante="warning" dica="prováveis desligados ou CPF diferente">
                <Tabela
                  cabecalho={['Relatório', 'Nome', 'CPF', 'Motivo']}
                  linhas={[
                    ...previaA.naoEncontradosDesconta.map((s) => ['Desconta VT', s.registro.nome, s.registro.cpf ?? '', s.motivo]),
                    ...previaA.naoEncontradosNaoBeneficiario.map((s) => ['Não beneficiário', s.registro.nome, s.registro.cpf ?? '', s.motivo]),
                  ]}
                />
              </Secao>
              <Secao titulo="Ativos e afastados do CORH fora dos dois relatórios" quantidade={previaA.foraDosRelatorios.length} dica="só para conferir, nada é alterado">
                <Tabela cabecalho={['Nome', 'Matrícula', 'Situação', 'Optante hoje']} linhas={previaA.foraDosRelatorios.map((c) => [c.nome_completo, c.matricula ?? '', c.status, c.vt_optante === true ? 'Sim' : c.vt_optante === false ? 'Não' : '—'])} />
              </Secao>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ModuleButton onClick={() => setConfirmarA(true)} disabled={gravandoA || mudancasA.length === 0}>
                  <Save className="size-4" />
                  {gravandoA ? 'Gravando…' : `Gravar mudanças (${mudancasA.length})`}
                </ModuleButton>
                <ModuleButton variant="outline" onClick={() => baixarExcelConferencia(abasConferenciaOptantes(previaA), `conferencia-optantes-vt-${dataParaNomeArquivo(hojeBrasil())}.xlsx`)}>
                  <Download className="size-4" />
                  Excel de conferência
                </ModuleButton>
              </div>
              {resultadoA && <Resultado r={resultadoA} />}
            </div>
          )}
        </div>
      </ModuleCard>

      {/* ---------- B) Riocard ---------- */}
      <ModuleCard
        title="2. Situação do Bilhete Único (Riocard)"
        description="Atualiza a situação do BU de cada optante a partir do cadastro de funcionários da Riocard."
        icon={<FileUp className="size-4" />}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pdf-riocard">PDFs da Riocard (um por conta: Plena EA e Plena Tech)</Label>
              <Input
                id="pdf-riocard"
                type="file"
                accept="application/pdf"
                multiple
                disabled={lendoB}
                onChange={(e) => {
                  void lerRiocard(e.target.files)
                  e.target.value = ''
                }}
              />
              {lendoB && <p className="text-[12px] text-muted-foreground">Lendo os arquivos…</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data-consulta">Data da consulta (fica gravada no cadastro)</Label>
              <Input id="data-consulta" type="date" value={dataConsulta} onChange={(e) => setDataConsulta(e.target.value || hojeBrasil())} />
            </div>
          </div>

          {relatoriosRio.map((r) => (
            <p key={r.cnpj || r.empresa} className="text-[12px] text-muted-foreground">
              Lido: <strong className="text-foreground">{r.empresa || 'empresa não identificada'}</strong> (CNPJ {r.cnpj || '—'}) —{' '}
              {r.linhas.length} funcionários{r.emitidoEm ? `, emitido em ${formatarData(r.emitidoEm)}` : ''}
            </p>
          ))}

          {previaB && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-[12px]">
                <StatusBadge variant="info">{previaB.mudancas.length} com situação nova</StatusBadge>
                <StatusBadge variant="neutral">{previaB.semMudancaSituacao.length} só atualizam data/cartão</StatusBadge>
                <StatusBadge variant="warning">{previaB.semCadastroAtivoNoCorh.length} sem cadastro ativo no CORH</StatusBadge>
                <StatusBadge variant="warning">{previaB.optantesSemCadastroNaRiocard.length} optantes sem cadastro na Riocard</StatusBadge>
              </div>

              <Secao titulo="Mudanças de situação (antes → depois)" quantidade={previaB.mudancas.length} variante="info" dica="desmarque quem não deve mudar">
                <TabelaMudancasBU lista={previaB.mudancas} desmarcados={desmarcadosB} onAlternar={(id) => setDesmarcadosB((s) => alternar(s, id))} />
              </Secao>
              <Secao titulo="Situação igual (só atualiza data da consulta e nº do cartão)" quantidade={previaB.semMudancaSituacao.length}>
                <TabelaMudancasBU lista={previaB.semMudancaSituacao} desmarcados={desmarcadosB} onAlternar={(id) => setDesmarcadosB((s) => alternar(s, id))} />
              </Secao>
              <Secao titulo="Ativos na Riocard sem cadastro ativo no CORH" quantidade={previaB.semCadastroAtivoNoCorh.length} variante="warning" dica="prováveis desligados: inativar na Riocard">
                <Tabela cabecalho={['Nome', 'CPF', 'Matrícula Riocard', 'Situação do BU']} linhas={previaB.semCadastroAtivoNoCorh.map((l) => [l.nome, l.cpf ?? '', l.matricula, l.situacao])} />
              </Secao>
              <Secao titulo="Optantes do CORH sem cadastro ativo na Riocard" quantidade={previaB.optantesSemCadastroNaRiocard.length} variante="warning" dica="cadastrar na Riocard">
                <Tabela cabecalho={['Nome', 'CPF']} linhas={previaB.optantesSemCadastroNaRiocard.map((c) => [c.nome_completo, c.cpf ?? ''])} />
              </Secao>
              <Secao titulo="Ativos na Riocard que não são optantes" quantidade={previaB.ativosNaRiocardNaoOptantes.length} dica="só para conferir">
                <Tabela cabecalho={['Nome', 'CPF', 'Situação do BU']} linhas={previaB.ativosNaRiocardNaoOptantes.map((a) => [a.colaborador.nome_completo, a.linha.cpf ?? '', a.linha.situacao])} />
              </Secao>
              <Secao titulo="Só têm cadastro inativo na Riocard" quantidade={previaB.soInativoNaRiocard.length} dica="não grava">
                <Tabela cabecalho={['Nome', 'CPF', 'Matrícula Riocard']} linhas={previaB.soInativoNaRiocard.map((a) => [a.colaborador.nome_completo, a.linha.cpf ?? '', a.linha.matricula])} />
              </Secao>
              <Secao titulo="Conflitos, sem CPF ou situação desconhecida (não grava)" quantidade={previaB.conflitosAtivoDuplicado.length + previaB.semCpf.length + previaB.situacoesDesconhecidas.length} variante="danger">
                <Tabela
                  cabecalho={['Tipo', 'Nome', 'CPF', 'Matrícula Riocard']}
                  linhas={[
                    ...previaB.conflitosAtivoDuplicado.map((l) => ['Ativo em mais de um cadastro', l.nome, l.cpf ?? '', l.matricula]),
                    ...previaB.semCpf.map((l) => ['Sem CPF no arquivo', l.nome, '', l.matricula]),
                    ...previaB.situacoesDesconhecidas.map((l) => [`Situação nova: ${l.situacao}`, l.nome, l.cpf ?? '', l.matricula]),
                  ]}
                />
              </Secao>

              {previaB.conflitosAtivoDuplicado.length + previaB.situacoesDesconhecidas.length > 0 && (
                <p className="flex items-center gap-1.5 text-[12px] text-amber-700">
                  <AlertTriangle className="size-3.5" /> Há linhas que o sistema não soube tratar; elas ficam de fora da gravação.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ModuleButton onClick={() => setConfirmarB(true)} disabled={gravandoB || mudancasB.length === 0}>
                  <Save className="size-4" />
                  {gravandoB ? 'Gravando…' : `Gravar mudanças (${mudancasB.length})`}
                </ModuleButton>
                <ModuleButton variant="outline" onClick={() => baixarExcelConferencia(abasConferenciaRiocard(previaB), `conferencia-riocard-${dataParaNomeArquivo(dataConsulta)}.xlsx`)}>
                  <Download className="size-4" />
                  Excel de conferência
                </ModuleButton>
              </div>
              {resultadoB && <Resultado r={resultadoB} />}
            </div>
          )}
        </div>
      </ModuleCard>

      <ConfirmDialog
        open={confirmarA}
        onOpenChange={setConfirmarA}
        icon={<Save className="size-5" />}
        title="Gravar optantes?"
        description={`Vou atualizar ${mudancasA.length} cadastros (${mudancasA.filter((m) => m.para).length} viram optantes e ${mudancasA.filter((m) => !m.para).length} deixam de ser). Quem está nos dois relatórios não é alterado.`}
        confirmLabel="Gravar"
        onConfirm={() => void gravarA()}
      />
      <ConfirmDialog
        open={confirmarB}
        onOpenChange={setConfirmarB}
        icon={<Save className="size-5" />}
        title="Gravar situação do Bilhete Único?"
        description={`Vou atualizar ${mudancasB.length} cadastros com a situação do BU e a data de consulta ${formatarData(dataConsulta)}.`}
        confirmLabel="Gravar"
        onConfirm={() => void gravarB()}
      />
    </div>
  )
}

function TabelaMudancasOptante({
  lista,
  desmarcados,
  onAlternar,
}: {
  lista: { colaborador: ColaboradorOptante; registro: RegistroAlterdata; casadoPor: 'cpf' | 'matricula' }[]
  desmarcados: Set<string>
  onAlternar: (id: string) => void
}) {
  return (
    <table className="w-full min-w-[640px] text-[12px] tabular-nums">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2" />
          <th className="px-4 py-2 font-semibold">Nome</th>
          <th className="px-4 py-2 font-semibold">CPF</th>
          <th className="px-4 py-2 font-semibold">Hoje</th>
          <th className="px-4 py-2 font-semibold">Casou por</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((m) => (
          <tr key={m.colaborador.id} className="border-t border-border hover:bg-accent/40">
            <td className="px-4 py-1.5">
              <input type="checkbox" checked={!desmarcados.has(m.colaborador.id)} onChange={() => onAlternar(m.colaborador.id)} aria-label={`Gravar ${m.colaborador.nome_completo}`} />
            </td>
            <td className="px-4 py-1.5">{m.colaborador.nome_completo}</td>
            <td className="px-4 py-1.5">{m.registro.cpf ?? '—'}</td>
            <td className="px-4 py-1.5">{m.colaborador.vt_optante === true ? 'Optante' : m.colaborador.vt_optante === false ? 'Não optante' : 'não informado'}</td>
            <td className="px-4 py-1.5">{m.casadoPor === 'cpf' ? 'CPF' : 'matrícula'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TabelaMudancasBU({
  lista,
  desmarcados,
  onAlternar,
}: {
  lista: { colaborador: ColaboradorRiocard; linha: LinhaRiocard; depois: { vt_bu_situacao: string } }[]
  desmarcados: Set<string>
  onAlternar: (id: string) => void
}) {
  return (
    <table className="w-full min-w-[640px] text-[12px] tabular-nums">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2" />
          <th className="px-4 py-2 font-semibold">Nome</th>
          <th className="px-4 py-2 font-semibold">Antes</th>
          <th className="px-4 py-2 font-semibold">Depois</th>
          <th className="px-4 py-2 font-semibold">Conta</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((m) => (
          <tr key={m.colaborador.id} className="border-t border-border hover:bg-accent/40">
            <td className="px-4 py-1.5">
              <input type="checkbox" checked={!desmarcados.has(m.colaborador.id)} onChange={() => onAlternar(m.colaborador.id)} aria-label={`Gravar ${m.colaborador.nome_completo}`} />
            </td>
            <td className="px-4 py-1.5">{m.colaborador.nome_completo}</td>
            <td className="px-4 py-1.5">{m.colaborador.vt_bu_situacao ?? 'não consultado'}</td>
            <td className="px-4 py-1.5">{m.depois.vt_bu_situacao}</td>
            <td className="px-4 py-1.5">{m.linha.conta}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
