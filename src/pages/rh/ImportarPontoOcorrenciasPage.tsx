import { useState } from 'react'
import { Upload, AlertCircle, FileUp, Loader2, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/corh/PageHeader'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { podeCriarOcorrencia } from '@/lib/permissoes'
import { mascararCPF } from '@/lib/utils'
import {
  parsePaginasEspelho,
  casarColaborador,
  planejarOcorrencias,
  marcarDuplicadas,
  montarPayloadInsert,
  formatarDataBR,
  type PaginaPDF,
  type OcorrenciaPlanejada,
  type OcorrenciaExistente,
  type ColaboradorResumo,
} from '@/lib/ocorrencias/importacaoPonto'
import type { Ocorrencia } from '@/types/database'
import { RhShell } from './RhShell'

// Mesmo padrão de carregamento do pdfjs usado em src/lib/vr/pdfExtractor.ts
async function getPdfjsLib() {
  const isVitest = typeof process !== 'undefined' && process.env?.VITEST === 'true'
  if (typeof document === 'undefined' || isVitest) {
    return await import('pdfjs-dist/legacy/build/pdf.mjs')
  }
  const pdfjsLibBrowser = await import('pdfjs-dist')
  pdfjsLibBrowser.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return pdfjsLibBrowser
}

/** Extrai de cada página os itens de texto posicionados (x, y) exigidos pelo parser. */
async function extrairPaginasPosicionais(file: File): Promise<PaginaPDF[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjsLib = await getPdfjsLib()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const paginas: PaginaPDF[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    paginas.push({
      numero: p,
      itens: content.items
        .filter((item) => 'str' in item)
        .map((item) => ({
          x: (item as { transform: number[] }).transform[4],
          y: (item as { transform: number[] }).transform[5],
          texto: (item as { str: string }).str,
        })),
    })
  }
  return paginas
}

async function buscarColaboradores(): Promise<ColaboradorResumo[]> {
  const todos: ColaboradorResumo[] = []
  const passo = 1000
  for (let offset = 0; ; offset += passo) {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nome_completo, cpf, empresa_id, status')
      .range(offset, offset + passo - 1)
    if (error) throw new Error('Erro ao buscar colaboradores: ' + error.message)
    todos.push(...((data as ColaboradorResumo[]) || []))
    if (!data || data.length < passo) break
  }
  return todos
}

interface LinhaPrevia extends OcorrenciaPlanejada {
  chave: number
  selecionada: boolean
}

interface ResultadoImportacao {
  inseridos: number
  erros: string[]
}

const TAMANHO_LOTE = 100

export function ImportarPontoOcorrenciasPage() {
  const { user } = useAuth()
  const podeImportar = user ? podeCriarOcorrencia(user.nivel_acesso) : false

  const [processando, setProcessando] = useState(false)
  const [linhas, setLinhas] = useState<LinhaPrevia[]>([])
  const [processado, setProcessado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)

  const handleArquivoSelecionado = async (file: File | null) => {
    setLinhas([])
    setProcessado(false)
    setErro(null)
    setResultado(null)
    if (!file) return

    setProcessando(true)
    try {
      const paginas = await extrairPaginasPosicionais(file)
      const espelhos = parsePaginasEspelho(paginas)
      const comDias = espelhos.filter((e) => e.dias.length > 0)
      if (comDias.length === 0) {
        setErro('Nenhum espelho de ponto foi reconhecido neste PDF. Confira se é o arquivo unificado exportado do Flit.')
        return
      }

      const colaboradores = await buscarColaboradores()

      const planejadas = comDias.flatMap((espelho) => {
        const { colaborador, match } = casarColaborador(espelho, colaboradores)
        return planejarOcorrencias(espelho, colaborador, match)
      })

      // Deduplicação: ocorrências já existentes (colaborador + data + tipo)
      const ids = [...new Set(planejadas.map((p) => p.colaborador?.id).filter(Boolean))] as string[]
      const datas = [...new Set(planejadas.map((p) => p.dataInicio))]
      if (ids.length > 0 && datas.length > 0) {
        const { data, error: erroDedup } = await supabase
          .from('ocorrencias')
          .select('colaborador_id, data_ocorrencia, tipo_ocorrencia')
          .in('colaborador_id', ids)
          .in('data_ocorrencia', datas)
        if (erroDedup) throw new Error('Erro ao verificar duplicidades: ' + erroDedup.message)
        marcarDuplicadas(planejadas, (data as OcorrenciaExistente[]) || [])
      }

      setLinhas(
        planejadas.map((p, i) => ({
          ...p,
          chave: i,
          selecionada: p.match === 'OK' && !p.duplicada,
        }))
      )
      setProcessado(true)
    } catch (err: unknown) {
      console.error('Erro ao processar espelho de ponto:', err)
      setErro(err instanceof Error ? err.message : 'Erro ao ler o arquivo PDF')
    } finally {
      setProcessando(false)
    }
  }

  const toggleLinha = (chave: number) => {
    setLinhas((prev) =>
      prev.map((l) => (l.chave === chave && l.match === 'OK' ? { ...l, selecionada: !l.selecionada } : l))
    )
  }

  const toggleTodas = (selecionar: boolean) => {
    setLinhas((prev) => prev.map((l) => (l.match === 'OK' ? { ...l, selecionada: selecionar } : l)))
  }

  const selecionadas = linhas.filter((l) => l.selecionada && l.match === 'OK' && l.colaborador)

  const handleImportar = async () => {
    if (!user || selecionadas.length === 0) return
    setImportando(true)
    setResultado(null)
    let inseridos = 0
    const erros: string[] = []
    try {
      for (let i = 0; i < selecionadas.length; i += TAMANHO_LOTE) {
        const lote = selecionadas.slice(i, i + TAMANHO_LOTE)
        const payloads = lote.map((l) => montarPayloadInsert(l, user.id))
        const { error } = await supabase
          .from('ocorrencias')
          .insert(payloads as Partial<Ocorrencia>[])
        if (error) {
          erros.push(`Lote ${i / TAMANHO_LOTE + 1}: ${error.message}`)
        } else {
          inseridos += lote.length
        }
      }
      setResultado({ inseridos, erros })
      if (erros.length === 0) {
        toast.success(`${inseridos} ocorrência(s) importada(s) com sucesso.`)
      } else {
        toast.warning(`${inseridos} importada(s), ${erros.length} lote(s) com erro.`)
      }
    } finally {
      setImportando(false)
    }
  }

  const contagem = {
    faltas: linhas.filter((l) => l.tipo === 'Falta Injustificada').length,
    atestados: linhas.filter((l) => l.tipo === 'Falta Justificada (atestado)').length,
    licencas: linhas.filter((l) => l.tipo.startsWith('Licença Médica')).length,
    duplicadas: linhas.filter((l) => l.duplicada).length,
    naoEncontrados: linhas.filter((l) => l.match !== 'OK').length,
  }

  return (
    <RhShell>
      <PageHeader
        backTo="/rh/ocorrencias"
        title="Importar espelho de ponto"
        description="Gera ocorrências de falta e atestado a partir do espelho de ponto unificado (PDF do Flit)"
      />

      <ModuleCard>
        <div className="space-y-4">
          <div>
            <Label htmlFor="arquivo-ponto">PDF do espelho de ponto (Flit)</Label>
            <input
              id="arquivo-ponto"
              type="file"
              accept=".pdf"
              onChange={(e) => handleArquivoSelecionado(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {processando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando o PDF, casando colaboradores e verificando duplicidades...
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Erro ao processar o arquivo</p>
                <p>{erro}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Como funciona a importação</p>
              <p>
                Apenas dias de <strong>Falta</strong> e <strong>Atestado</strong> viram ocorrência. Faltas
                consecutivas são agrupadas; atestados se fundem quando separados apenas por folga,
                feriado ou férias. Atestados de até 8 dias viram Falta Justificada; de 9 a 15 dias,
                Licença Médica; acima de 15 dias, Licença Médica (INSS). Ocorrências já existentes
                aparecem como duplicadas e ficam desmarcadas.
              </p>
            </div>
          </div>
        </div>
      </ModuleCard>

      {processado && linhas.length === 0 && (
        <ModuleCard>
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="Nada a importar"
            description="O PDF foi lido, mas não foram encontrados dias de falta ou atestado no período."
          />
        </ModuleCard>
      )}

      {linhas.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <ModuleCard contentClassName="p-4">
              <p className="text-2xl font-bold text-foreground tabular-nums">{contagem.faltas}</p>
              <p className="text-[12px] text-muted-foreground">Faltas injustificadas</p>
            </ModuleCard>
            <ModuleCard contentClassName="p-4">
              <p className="text-2xl font-bold text-foreground tabular-nums">{contagem.atestados}</p>
              <p className="text-[12px] text-muted-foreground">Atestados</p>
            </ModuleCard>
            <ModuleCard contentClassName="p-4">
              <p className="text-2xl font-bold text-foreground tabular-nums">{contagem.licencas}</p>
              <p className="text-[12px] text-muted-foreground">Licenças médicas</p>
            </ModuleCard>
            <ModuleCard contentClassName="p-4">
              <p className="text-2xl font-bold text-amber-600 tabular-nums">{contagem.duplicadas}</p>
              <p className="text-[12px] text-muted-foreground">Duplicadas</p>
            </ModuleCard>
            <ModuleCard contentClassName="p-4">
              <p className="text-2xl font-bold text-red-600 tabular-nums">{contagem.naoEncontrados}</p>
              <p className="text-[12px] text-muted-foreground">Não encontrados / divergentes</p>
            </ModuleCard>
          </div>

          <ModuleCard
            title="Pré-visualização das ocorrências"
            description={`${selecionadas.length} de ${linhas.length} ocorrência(s) selecionada(s) para importação`}
          >
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Selecionar todas"
                        checked={selecionadas.length > 0 && selecionadas.length === linhas.filter((l) => l.match === 'OK').length}
                        onChange={(e) => toggleTodas(e.target.checked)}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Avisos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <TableRow key={l.chave} className={l.match !== 'OK' ? 'bg-red-50/40' : l.duplicada ? 'bg-amber-50/40' : ''}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Selecionar ${l.nomePdf}`}
                          checked={l.selecionada}
                          disabled={l.match !== 'OK'}
                          onChange={() => toggleLinha(l.chave)}
                        />
                      </TableCell>
                      <TableCell className="max-w-[14rem]">
                        <p className="text-[13px] font-medium text-foreground break-words">
                          {l.colaborador?.nome_completo || l.nomePdf || '(sem nome)'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">página {l.pagina}</p>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{mascararCPF(l.cpfPdf)}</TableCell>
                      <TableCell className="text-xs">{l.tipo}</TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {l.dataInicio === l.dataFim
                          ? formatarDataBR(l.dataInicio)
                          : `${formatarDataBR(l.dataInicio)} a ${formatarDataBR(l.dataFim)}`}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{l.dias}</TableCell>
                      <TableCell>
                        <StatusBadge variant={l.status === 'Ativa' ? 'success' : 'warning'}>
                          {l.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="max-w-[16rem]">
                        <div className="flex flex-col gap-1">
                          {l.match === 'NAO_ENCONTRADO' && (
                            <StatusBadge variant="danger">Não encontrado no CORH</StatusBadge>
                          )}
                          {l.match === 'NOME_DIVERGE' && (
                            <StatusBadge variant="danger">Nome diverge do cadastro</StatusBadge>
                          )}
                          {l.duplicada && <StatusBadge variant="warning">Duplicada</StatusBadge>}
                          {l.avisos.map((aviso, i) => (
                            <span key={i} className="text-[11px] text-amber-700">{aviso}</span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {podeImportar ? (
                <ModuleButton onClick={handleImportar} disabled={importando || selecionadas.length === 0}>
                  {importando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {importando ? 'Importando...' : `Importar ${selecionadas.length} ocorrência(s)`}
                </ModuleButton>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Seu perfil não tem permissão para criar ocorrências.
                </p>
              )}
            </div>
          </ModuleCard>
        </>
      )}

      {resultado && (
        <ModuleCard title="Resumo da importação" icon={<FileUp className="size-4" />}>
          <p>
            <strong>{resultado.inseridos}</strong> ocorrência(s) importada(s)
          </p>
          {resultado.erros.length > 0 && (
            <div className="mt-2">
              <p className="text-red-600 font-medium">Erros ({resultado.erros.length}):</p>
              <ul className="list-disc list-inside text-sm text-slate-600">
                {resultado.erros.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </ModuleCard>
      )}
    </RhShell>
  )
}
