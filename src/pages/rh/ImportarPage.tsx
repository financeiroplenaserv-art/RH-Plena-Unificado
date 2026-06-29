import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { parseExcelColaboradores } from '@/lib/importar'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PageHeader } from '@/components/PageHeader'
import { BadgeStatus } from '@/components/BadgeStatus'
import { toast } from 'sonner'
import type { Colaborador } from '@/types/database'

export function ImportarPage() {
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
      const batchSize = 100
      let total = 0

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize)
        const { error } = await supabase.from('colaboradores').upsert(batch, {
          onConflict: 'matricula',
          ignoreDuplicates: false,
        })

        if (error) {
          toast.error(`Erro no lote ${i / batchSize + 1}: ${error.message}`)
        } else {
          total += batch.length
          setImported(total)
        }
      }

      toast.success(`${total} colaboradores importados com sucesso!`)
      setFile(null)
      setPreview([])
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
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader backTo="/rh" title="Importar RH" description="Importe dados de colaboradores via arquivo Excel" />

      <Card>
        <CardContent className="pt-6">
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
                <Button variant="ghost" size="sm" onClick={clearFile} className="text-red-600">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {importing ? (
                <LoadingScreen mensagem={`Importando... ${imported} registros`} className="py-4" />
              ) : (
                <Button onClick={handleImport} className="w-full gap-2 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4" /> Iniciar Importação
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Pré-visualização (primeiros {preview.length} registros)
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Colunas Suportadas</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}
