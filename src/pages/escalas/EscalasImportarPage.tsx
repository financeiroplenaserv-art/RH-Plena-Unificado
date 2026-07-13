import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { useEscalasDiario, calcularCompetencia, type Competencia } from '@/hooks/useEscalasDiario'
import { useEscalasMapeamento } from '@/hooks/useEscalasMapeamento'
import { useColaboradores } from '@/hooks/useColaboradores'
import { parseExcelFlit, type BatidaFlit } from '@/lib/escalas/importarFlit'
import { Upload, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { EscalasShell } from './EscalasShell'

export function EscalasImportarPage() {
  const { importando, importarExcelFlit } = useEscalasDiario()
  const { mapeamentos, listar: listarMapeamentos } = useEscalasMapeamento()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [resumo, setResumo] = useState<{ sucesso: number; identificados: number; pendentes: number; preservados: number; naoEncontrados: string[] } | null>(null)
  const [preview, setPreview] = useState<BatidaFlit[] | null>(null)
  const [erroPreview, setErroPreview] = useState<string | null>(null)

  useEffect(() => {
    listarMapeamentos()
    listarColaboradores()
  }, [listarMapeamentos, listarColaboradores])

  const competencia: Competencia = calcularCompetencia(ano, mes)

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
    const resultado = await importarExcelFlit(arquivo, colaboradores, mapeamentos, competencia)
    setResumo(resultado)
  }

  return (
    <EscalasShell>
      <PageHeader backTo="/" title="Importar Excel do Flit" description="Importe marcações do Flit para local de trabalho diário" />

      <ModuleCard>
        <div className="space-y-4">
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

          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
            Competência selecionada: <strong>{competencia.label}</strong> ({competencia.inicio} a {competencia.fim})
          </p>

          <div>
            <Label htmlFor="arquivo">Arquivo Excel do Flit</Label>
            <input
              id="arquivo"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleArquivoSelecionado(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {erroPreview && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Erro ao ler o arquivo</p>
                <p>{erroPreview}</p>
              </div>
            </div>
          )}

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
                    <th className="py-2 pr-2">Data</th>
                    <th className="py-2 pr-2">Hora</th>
                    <th className="py-2 pr-2">Dispositivo</th>
                    <th className="py-2 pr-2">Perímetro</th>
                    <th className="py-2 pr-2">Departamento</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((batida, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-2 pr-2 whitespace-nowrap">{batida.nomeColaborador}</td>
                      <td className="py-2 pr-2">{batida.data}</td>
                      <td className="py-2 pr-2">{batida.hora}</td>
                      <td className="py-2 pr-2">{batida.nomeDispositivo || batida.tipoDispositivo}</td>
                      <td className="py-2 pr-2">{batida.perimetro || '-'}</td>
                      <td className="py-2 pr-2">{batida.departamento}</td>
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
