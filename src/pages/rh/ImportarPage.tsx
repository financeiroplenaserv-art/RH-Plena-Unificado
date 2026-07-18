import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { parseExcelColaboradores, limparRegistroParaUpsert } from '@/lib/importar'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PageHeader } from '@/components/corh/PageHeader'
import { BadgeStatus } from '@/components/BadgeStatus'
import { toast } from 'sonner'
import type { Colaborador } from '@/types/database'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { RhShell } from './RhShell'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { podeImportarColaboradores } from '@/lib/permissoes'

export function ImportarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !podeImportarColaboradores(user.nivel_acesso)) {
      toast.error('Você não tem permissão para importar colaboradores')
      navigate('/colaboradores')
    }
  }, [user, navigate])

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Partial<Colaborador>[]>([])
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!selected.name.endsWith('.xlsx') && !selected.name.endsWith('.xls')) {
      toast.error('Formato inválido. Use .xlsx ou .xls')
      return
    }

    setFile(selected)

    try {
      const data = await parseExcelColaboradores(selected)
      setPreview(data.slice(0, 10))
      toast.success(`${data.length} registros encontrados no arquivo`)
    } catch (err) {
      console.error('Erro ao ler arquivo Excel:', err)
      toast.error('Erro ao ler arquivo')
    }
  }, [])

  const handleImport = async () => {
    if (!file) return
    setImporting(true)

    try {
      const data = await parseExcelColaboradores(file)

      const payloads: Record<string, unknown>[] = []
      let ignoradas = 0
      let cpfsInvalidos = 0
      for (const registro of data) {
        const limpo = limparRegistroParaUpsert(registro)
        if (!limpo) {
          ignoradas++
          continue
        }
        if (limpo.cpfInvalido) cpfsInvalidos++
        payloads.push(limpo.payload)
      }

      if (ignoradas > 0) {
        toast.warning(`${ignoradas} linha(s) ignorada(s) por falta de matrícula ou nome`)
      }
      if (cpfsInvalidos > 0) {
        toast.warning(`${cpfsInvalidos} CPF(s) inválido(s) não foram salvos (demais dados importados)`)
      }

      const batchSize = 100
      let total = 0
      let lotesComErro = 0

      for (let i = 0; i < payloads.length; i += batchSize) {
        const batch = payloads.slice(i, i + batchSize)
        const { error } = await supabase.from('colaboradores').upsert(batch, {
          onConflict: 'matricula',
          ignoreDuplicates: false,
        })

        if (error) {
          lotesComErro++
          toast.error(`Erro no lote ${i / batchSize + 1}: ${error.message}`)
        } else {
          total += batch.length
          setImported(total)
        }
      }

      if (lotesComErro === 0) {
        toast.success(`${total} colaboradores importados com sucesso!`)
        setFile(null)
        setPreview([])
      }
    } catch (error: unknown) {
      console.error('Erro na importação de colaboradores:', error)
      toast.error('Erro na importação: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
    }

    setImporting(false)
  }

  const clearFile = () => {
    setFile(null)
    setPreview([])
    setImported(0)
  }

  return (
    <RhShell>
      <PageHeader backTo="/" title="Importar RH" description="Importe dados de colaboradores via arquivo Excel" />

      <ModuleCard>
        <div className="pt-2">
          {!file ? (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all">
              <Upload className="h-10 w-10 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">Clique para selecionar arquivo Excel</p>
              <p className="text-xs text-slate-500 mt-1">Formatos: .xlsx, .xls</p>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium text-slate-800">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <ModuleButton variant="ghost" size="icon" onClick={clearFile} className="text-red-600">
                  <X className="h-4 w-4" />
                </ModuleButton>
              </div>

              {importing ? (
                <LoadingScreen mensagem={`Importando... ${imported} registros`} className="py-4" />
              ) : (
                <ModuleButton onClick={handleImport} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" /> Iniciar Importação
                </ModuleButton>
              )}
            </div>
          )}
        </div>
      </ModuleCard>

      {preview.length > 0 && (
        <ModuleCard title={`Pré-visualização (primeiros ${preview.length} registros)`} icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.matricula}</TableCell>
                    <TableCell>{row.nome_completo}</TableCell>
                    <TableCell>{row.cpf}</TableCell>
                    <TableCell>{row.cargo || '-'}</TableCell>
                    <TableCell>
                      <BadgeStatus status={row.status || 'Ativo'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </ModuleCard>
      )}

      <ModuleCard title="Colunas Suportadas">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {[
              'matricula',
              'nome_completo',
              'cpf',
              'rg',
              'ctps',
              'pis_pasep',
              'data_nascimento',
              'email',
              'telefone',
              'celular',
              'endereco',
              'cidade',
              'estado',
              'cep',
              'data_admissao',
              'data_demissao',
              'tipo_contrato',
              'cargo',
              'departamento',
              'status',
            ].map((col) => (
              <div key={col} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span className="text-slate-700">{col}</span>
              </div>
            ))}
          </div>
      </ModuleCard>
    </RhShell>
  )
}
