import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { useEscalasDiario, calcularCompetencia, type Competencia } from '@/hooks/useEscalasDiario'
import { useEscalasMapeamento } from '@/hooks/useEscalasMapeamento'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useEscalasLocais } from '@/hooks/useEscalasLocais'
import { parseExcelFlit, type DiaFlit } from '@/lib/escalas/importarFlit'
import { Upload, AlertCircle, Calendar } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { EscalasShell } from './EscalasShell'

type ModoImportacao = 'todos' | 'dia_anterior' | 'competencia'

function calcularCompetenciaOntem(): Competencia {
  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  const dataOntem = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, '0')}-${String(ontem.getDate()).padStart(2, '0')}`
  return {
    ano: ontem.getFullYear(),
    mes: ontem.getMonth() + 1,
    inicio: dataOntem,
    fim: dataOntem,
    label: `Dia ${dataOntem}`,
  }
}

export function EscalasImportarPage() {
  const { importando, importarExcelFlit } = useEscalasDiario()
  const { mapeamentos, listar: listarMapeamentos } = useEscalasMapeamento()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()
  const { locais, listar: listarLocais } = useEscalasLocais()

  const [modoImportacao, setModoImportacao] = useState<ModoImportacao>('todos')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [resumo, setResumo] = useState<{ sucesso: number; identificados: number; pendentes: number; preservados: number; naoEncontrados: string[] } | null>(null)
  const [preview, setPreview] = useState<DiaFlit[] | null>(null)
  const [erroPreview, setErroPreview] = useState<string | null>(null)

  useEffect(() => {
    listarMapeamentos()
    listarColaboradores()
    listarLocais()
  }, [listarMapeamentos, listarColaboradores, listarLocais])

  const competencia = calcularCompetencia(ano, mes)

  const handleArquivoSelecionado = async (file: File | null) => {
    setArquivo(file)
    setPreview(null)
    setErroPreview(null)
    setResumo(null)

    if (!file) return

    try {
      const batidas = await parseExcelFlit(file)
      setPreview(batidas.slice(0, 5))
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao ler o arquivo Excel'
      console.error('Erro no preview do Excel:', err)
      setErroPreview(mensagem)
    }
  }

  const handleImportar = async () => {
    if (!arquivo) return
    setResumo(null)

    let filtroCompetencia: Competencia | null = null
    if (modoImportacao === 'competencia') {
      filtroCompetencia = competencia
    } else if (modoImportacao === 'dia_anterior') {
      filtroCompetencia = calcularCompetenciaOntem()
    }

    const resultado = await importarExcelFlit(arquivo, colaboradores, mapeamentos, locais, filtroCompetencia)
    setResumo(resultado)
  }

  return (
    <EscalasShell>
      <PageHeader backTo="/" title="Importar Excel do Flit" description="Importe marcações do Flit para local de trabalho diário" />

      <ModuleCard>
        <div className="space-y-4">
          <div>
            <Label>Arquivo Excel do Flit</Label>
            <input
              id="arquivo"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleArquivoSelecionado(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="space-y-2">
            <Label>Modo de importação</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={modoImportacao === 'todos'}
                  onChange={() => setModoImportacao('todos')}
                />
                Importar todos os dias do Excel
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={modoImportacao === 'dia_anterior'}
                  onChange={() => setModoImportacao('dia_anterior')}
                />
                Apenas o dia anterior
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={modoImportacao === 'competencia'}
                  onChange={() => setModoImportacao('competencia')}
                />
                Filtrar por competência
              </label>
            </div>
          </div>

          {modoImportacao === 'competencia' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ano</Label>
                  <input
                    type="number"
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <Label>Mês base</Label>
                  <select
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                Competência selecionada: <strong>{competencia.label}</strong> ({competencia.inicio} a {competencia.fim})
              </p>
            </>
          )}

          {erroPreview && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Erro ao ler o arquivo</p>
                <p>{erroPreview}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Como funciona a importação</p>
              <p>
                Os dias importados ficam salvos no CORH. Se você importar um período que já existia,
                os dias em comum serão atualizados com os novos dados. Confirmações manuais feitas
                na tela Escalas não são sobrescritas.
              </p>
            </div>
          </div>

          <ModuleButton
            onClick={handleImportar}
            disabled={!arquivo || importando || !!erroPreview}
          >
            <Upload className="h-4 w-4 mr-2" />
            {importando ? 'Importando...' : 'Importar para o CORH'}
          </ModuleButton>
        </div>
      </ModuleCard>

      {preview && preview.length > 0 && (
        <ModuleCard title="Pré-visualização (primeiras linhas)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-2">Colaborador</th>
                  <th className="py-2 pr-2">Matrícula</th>
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Local de Trabalho</th>
                  <th className="py-2 pr-2">Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((dia, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 pr-2 whitespace-nowrap">{dia.nomeColaborador}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{dia.matricula || '-'}</td>
                    <td className="py-2 pr-2">{new Date(dia.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 pr-2">{dia.localTrabalhoNome || '-'}</td>
                    <td className="py-2 pr-2">{dia.nomeDispositivo || dia.tipoDispositivo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModuleCard>
      )}

      {resumo && (
        <ModuleCard title="Resumo da importação">
          <p><strong>{resumo.sucesso}</strong> dia(s) importado(s)</p>
          <p><strong>{resumo.identificados}</strong> identificado(s) automaticamente</p>
          <p><strong>{resumo.pendentes}</strong> dia(s) não identificado(s)</p>
          {resumo.preservados > 0 && (
            <p className="text-blue-600"><strong>{resumo.preservados}</strong> confirmação(ões) manual(is) preservada(s)</p>
          )}
          {resumo.naoEncontrados.length > 0 && (
            <div className="mt-4">
              <p className="text-amber-600 font-medium">Colaboradores não encontrados no CORH:</p>
              <ul className="list-disc list-inside text-sm text-slate-600">
                {resumo.naoEncontrados.map((nome) => (
                  <li key={nome}>{nome}</li>
                ))}
              </ul>
            </div>
          )}
        </ModuleCard>
      )}
    </EscalasShell>
  )
}
