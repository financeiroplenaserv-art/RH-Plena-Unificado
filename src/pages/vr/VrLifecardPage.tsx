import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, Download, FileSpreadsheet, Upload, Users } from 'lucide-react'
import * as XLSX from '@e965/xlsx'
import { toast } from 'sonner'
import { PageHeader } from '@/components/corh/PageHeader'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useEmpresas } from '@/hooks/useEmpresas'
import { formatarCPF, hojeBrasil, mascaraMoeda } from '@/lib/utils'
import {
  competenciaDoNomeArquivo,
  conciliarLinhasLifecard,
  gerarTxtLifecard,
  parseDemonstrativoLifecard,
  referenciasAlterdataLifecard,
  type ErroLifecard,
  type LinhaLifecard,
} from '@/lib/vr/lifecard'
import { VrShell } from './VrShell'

function baixarTxt(conteudo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function VrLifecardPage() {
  const { colaboradores, listarResumido, loading: loadingColaboradores } = useColaboradores()
  const { empresas, listar: listarEmpresas, loading: loadingEmpresas } = useEmpresas()
  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const [processando, setProcessando] = useState(false)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [linhas, setLinhas] = useState<LinhaLifecard[]>([])
  const [erros, setErros] = useState<ErroLifecard[]>([])
  const [competencia, setCompetencia] = useState(hojeBrasil().slice(0, 7))

  useEffect(() => {
    listarResumido()
    listarEmpresas()
  }, [listarResumido, listarEmpresas])

  const conferidas = useMemo(
    () => conciliarLinhasLifecard(linhas, colaboradores, empresas),
    [linhas, colaboradores, empresas]
  )
  const prontas = conferidas.filter(linha => !linha.pendencia)
  const pendencias = conferidas.filter(linha => linha.pendencia).length + erros.length
  const totalPronto = prontas.reduce((total, linha) => total + linha.valorCentavos, 0)
  const totalArquivo = conferidas.reduce((total, linha) => total + linha.valorCentavos, 0)
  const referencias = competencia ? referenciasAlterdataLifecard(competencia) : { ref1: '——', ref2: '——' }

  const importarArquivo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return
    setProcessando(true)
    try {
      const workbook = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' })
      const planilha = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(planilha, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false,
      }) as unknown[][]
      const resultado = parseDemonstrativoLifecard(rows)
      if (resultado.linhas.length === 0) throw new Error('Nenhum registro válido encontrado no demonstrativo')

      setNomeArquivo(arquivo.name)
      setLinhas(resultado.linhas)
      setErros(resultado.erros)
      setCompetencia(competenciaDoNomeArquivo(arquivo.name) ?? competencia)
      toast.success(`${resultado.linhas.length} registros lidos do demonstrativo`)
      if (resultado.erros.length > 0) toast.warning(`${resultado.erros.length} linhas precisam de revisão`)
    } catch (error) {
      setNomeArquivo('')
      setLinhas([])
      setErros([])
      toast.error(error instanceof Error ? error.message : 'Erro ao ler o demonstrativo Lifecard')
    } finally {
      setProcessando(false)
      event.target.value = ''
    }
  }

  const exportar = () => {
    try {
      const resultado = gerarTxtLifecard(conferidas, competencia)
      if (resultado.gerados === 0) {
        toast.error('Nenhum colaborador está pronto para exportação')
        return
      }
      baixarTxt(resultado.conteudo, `lifecard_664_${competencia}.txt`)
      if (resultado.pulados.length > 0) {
        toast.warning(`TXT gerado com ${resultado.gerados} registros; ${resultado.pulados.length} ficaram de fora por pendência`)
      } else {
        toast.success(`TXT gerado com ${resultado.gerados} registros`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar o TXT')
    }
  }

  return (
    <VrShell>
      <PageHeader
        backTo="/vr/projetos"
        title="Lifecard"
        description="Importe o demonstrativo mensal e gere o desconto para a Alterdata com o evento 664"
      >
        <ModuleButton variant="outline" onClick={() => inputArquivoRef.current?.click()} disabled={processando}>
          <Upload className="w-4 h-4" />
          {processando ? 'Lendo arquivo...' : 'Selecionar demonstrativo'}
        </ModuleButton>
        <ModuleButton onClick={exportar} disabled={prontas.length === 0 || loadingColaboradores || loadingEmpresas}>
          <Download className="w-4 h-4" />
          Baixar TXT ({prontas.length})
        </ModuleButton>
      </PageHeader>

      <input
        ref={inputArquivoRef}
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={importarArquivo}
      />

      {!nomeArquivo ? (
        <ModuleCard>
          <EmptyState
            icon={<FileSpreadsheet className="w-6 h-6" />}
            title="Nenhum demonstrativo importado"
            description="Selecione o arquivo Lifecard no formato .xls ou .xlsx para conferir os descontos do mês."
            action={{ label: 'Selecionar arquivo', onClick: () => inputArquivoRef.current?.click() }}
          />
        </ModuleCard>
      ) : (
        <>
          <ModuleCard title="Demonstrativo importado" icon={<FileSpreadsheet className="w-4 h-4" />}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900" title={nomeArquivo}>{nomeArquivo}</p>
                <p className="mt-1 text-xs text-slate-500">O valor exportado é a coluna DESC, incluindo eventual 2ª via.</p>
              </div>
              <div className="w-full lg:w-56">
                <Label htmlFor="competencia-lifecard">Competência no TXT</Label>
                <div className="relative mt-1">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="competencia-lifecard"
                    type="month"
                    value={competencia}
                    onChange={event => setCompetencia(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Referências: {referencias.ref1} a {referencias.ref2} (DDMMAA)
                </p>
              </div>
            </div>
          </ModuleCard>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ModuleCard contentClassName="p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500"><Users className="w-4 h-4" />Registros</div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{conferidas.length}</p>
            </ModuleCard>
            <ModuleCard contentClassName="p-4">
              <div className="text-xs text-slate-500">Prontos para o TXT</div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">{prontas.length}</p>
            </ModuleCard>
            <ModuleCard contentClassName="p-4">
              <div className="text-xs text-slate-500">Pendências</div>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${pendencias > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{pendencias}</p>
            </ModuleCard>
            <ModuleCard contentClassName="p-4">
              <div className="text-xs text-slate-500">Total pronto / arquivo</div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{mascaraMoeda(totalPronto / 100)}</p>
              <p className="text-[11px] text-slate-500">de {mascaraMoeda(totalArquivo / 100)}</p>
            </ModuleCard>
          </div>

          {erros.length > 0 && (
            <ModuleCard title={`Linhas não importadas (${erros.length})`} icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}>
              <div className="space-y-1 text-xs text-amber-800">
                {erros.map(erro => (
                  <p key={erro.linha}>Linha {erro.linha} — {erro.nome}: {erro.motivo}</p>
                ))}
              </div>
            </ModuleCard>
          )}

          <ModuleCard title="Conferência dos colaboradores" description="Somente registros sem pendência entram no TXT. O cruzamento é feito por CPF exato.">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula CORH</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conferidas.map(linha => (
                    <TableRow key={`${linha.linha}-${linha.cpf}`} className="hover:bg-accent/40">
                      <TableCell>
                        <div className="font-medium text-slate-900">{linha.nomeCorh ?? linha.nome}</div>
                        {linha.nomeCorh && linha.nomeCorh !== linha.nome && (
                          <div className="text-[11px] text-slate-500">No arquivo: {linha.nome}</div>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatarCPF(linha.cpf)}</TableCell>
                      <TableCell className="tabular-nums">{linha.matricula ?? '—'}</TableCell>
                      <TableCell>
                        {linha.empresaNome ?? '—'}
                        {linha.empresaCodigo && <span className="ml-1 text-[11px] text-slate-500">({linha.empresaCodigo})</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {mascaraMoeda(linha.valorCentavos / 100)}
                        {linha.segundaViaCentavos > 0 && (
                          <div className="text-[11px] text-slate-500">inclui 2ª via de {mascaraMoeda(linha.segundaViaCentavos / 100)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {linha.pendencia ? (
                          <div className="max-w-xs">
                            <StatusBadge variant="warning">Pendente</StatusBadge>
                            <p className="mt-1 text-[11px] text-amber-700">{linha.pendencia}</p>
                          </div>
                        ) : (
                          <StatusBadge variant="success">Pronto</StatusBadge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ModuleCard>
        </>
      )}
    </VrShell>
  )
}
