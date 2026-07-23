import { useEffect, useState } from 'react'
import { Upload, AlertCircle, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/corh/PageHeader'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useFerias, type ResultadoImportacao } from '@/hooks/useFerias'
import { podeImportarFerias } from '@/lib/permissoes'
import {
  parseExcelFerias,
  casarColaboradores,
  type ResultadoCasamentoFerias,
} from '@/lib/ferias/importarFeriasFlit'
import { FeriasShell } from './FeriasShell'

export function FeriasImportarPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeImportar = perfil ? podeImportarFerias(perfil) : false

  const { loading, listarColaboradoresResumo, importar } = useFerias()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<ResultadoCasamentoFerias | null>(null)
  const [erroPreview, setErroPreview] = useState<string | null>(null)
  const [resumo, setResumo] = useState<ResultadoImportacao | null>(null)

  useEffect(() => {
    listarColaboradoresResumo()
  }, [listarColaboradoresResumo])

  const handleArquivoSelecionado = async (file: File | null) => {
    setArquivo(file)
    setPreview(null)
    setErroPreview(null)
    setResumo(null)

    if (!file) return

    try {
      const linhas = await parseExcelFerias(file)
      const colaboradores = await listarColaboradoresResumo()
      setPreview(casarColaboradores(linhas, colaboradores))
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao ler o arquivo Excel'
      console.error('Erro no preview do Excel de férias:', err)
      setErroPreview(mensagem)
    }
  }

  const handleImportar = async () => {
    if (!preview) return
    const resultado = await importar(preview.periodos)
    if (resultado) {
      setResumo(resultado)
      toast.success(`${resultado.inseridos} período(s) importado(s) para ${resultado.colaboradoresAtualizados} colaborador(es).`)
    }
  }

  return (
    <FeriasShell>
      <PageHeader backTo="/" title="Importar férias do Flit" description="Importe a planilha de férias exportada do Flit (controle de ponto)" />

      <ModuleCard>
        <div className="space-y-4">
          <div>
            <Label>Arquivo Excel de férias</Label>
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

          <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Como funciona a importação</p>
              <p>
                A planilha deve ter as colunas Colaborador, Último período e Próximo período
                (formato "DD/MM/AAAA - DD/MM/AAAA"). Os nomes são casados com o cadastro do CORH.
                Ao reimportar, os períodos anteriores vindos do Flit dos mesmos colaboradores são
                substituídos — nunca duplicados.
              </p>
            </div>
          </div>

          {podeImportar ? (
            <ModuleButton
              onClick={handleImportar}
              disabled={!arquivo || !preview || loading || !!erroPreview || preview.periodos.length === 0}
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading ? 'Importando...' : 'Importar para o CORH'}
            </ModuleButton>
          ) : (
            <p className="text-sm text-muted-foreground">Seu perfil não tem permissão para importar férias.</p>
          )}
        </div>
      </ModuleCard>

      {preview && (
        <ModuleCard title="Pré-visualização">
          <div className="space-y-1 text-[13px]">
            <p><strong>{preview.colaboradoresEncontrados}</strong> colaborador(es) encontrado(s) no cadastro</p>
            <p>
              <strong>{preview.periodos.filter((p) => p.tipo === 'gozo').length}</strong> período(s) de gozo e{' '}
              <strong>{preview.periodos.filter((p) => p.tipo === 'agendado').length}</strong> período(s) agendado(s) a importar
            </p>
            {preview.naoEncontrados.length > 0 && (
              <div className="mt-3">
                <p className="text-amber-600 font-medium">Não encontrados no CORH ({preview.naoEncontrados.length}):</p>
                <ul className="list-disc list-inside text-sm text-slate-600 max-h-40 overflow-y-auto">
                  {preview.naoEncontrados.map((nome) => (
                    <li key={nome}>{nome}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.ambiguos.length > 0 && (
              <div className="mt-3">
                <p className="text-amber-600 font-medium">Nomes duplicados no cadastro — não importados ({preview.ambiguos.length}):</p>
                <ul className="list-disc list-inside text-sm text-slate-600">
                  {preview.ambiguos.map((nome) => (
                    <li key={nome}>{nome}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.periodosInvalidos.length > 0 && (
              <div className="mt-3">
                <p className="text-amber-600 font-medium">Períodos não interpretados ({preview.periodosInvalidos.length}):</p>
                <ul className="list-disc list-inside text-sm text-slate-600">
                  {preview.periodosInvalidos.map((nome) => (
                    <li key={nome}>{nome}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ModuleCard>
      )}

      {resumo && (
        <ModuleCard title="Resumo da importação" icon={<CalendarDays className="size-4" />}>
          <p><strong>{resumo.inseridos}</strong> período(s) importado(s)</p>
          <p><strong>{resumo.colaboradoresAtualizados}</strong> colaborador(es) atualizado(s)</p>
          {resumo.previsoesAlinhadas > 0 && (
            <p className="text-blue-600">
              <strong>{resumo.previsoesAlinhadas}</strong> previsão(ões) do RH baixada(s) automaticamente
              (período confirmado chegou do Flit)
            </p>
          )}
        </ModuleCard>
      )}
    </FeriasShell>
  )
}
