import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useCEUFornecedores } from '@/hooks/useCEUFornecedores'
import { CeuPageWrapper } from './CeuPageWrapper'
import { CeuCard } from '@/components/ceu/CeuCard'
import { CeuButton } from '@/components/ceu/CeuButton'
import { CeuBadge } from '@/components/ceu/CeuBadge'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import type { Fornecedor, ItemCEU } from '@/types/database'

type TipoImportacao = 'itens' | 'fornecedores'

interface LinhaImportacao {
  dados: Record<string, string>
  valido: boolean
  erros: string[]
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''))
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ''
    })
    return row
  })
}

const TIPOS: { id: TipoImportacao; label: string; colunas: string[] }[] = [
  {
    id: 'itens',
    label: 'Itens',
    colunas: ['nome', 'tipo', 'ca', 'validade', 'subgrupo', 'estoque', 'estoque_minimo', 'prazo_uso_dias'],
  },
  {
    id: 'fornecedores',
    label: 'Fornecedores',
    colunas: ['nome', 'cnpj', 'telefone', 'email'],
  },
]

function validarLinha(tipo: TipoImportacao, row: Record<string, string>): LinhaImportacao {
  const erros: string[] = []
  const get = (...keys: string[]) => keys.map((k) => row[k]).find((v) => v !== undefined && v !== '')

  if (tipo === 'itens') {
    if (!get('nome', 'Nome')) erros.push('Nome obrigatório')
    if (!get('tipo', 'Tipo')) erros.push('Tipo obrigatório')
  }
  if (tipo === 'fornecedores') {
    if (!get('nome', 'Nome')) erros.push('Nome obrigatório')
  }

  return { dados: row, valido: erros.length === 0, erros }
}

export function CeuImportarPage() {
  const { criar: criarItem } = useCEUItens()
  const { criar: criarFornecedor } = useCEUFornecedores()

  const [tipo, setTipo] = useState<TipoImportacao>('itens')
  const [linhas, setLinhas] = useState<LinhaImportacao[] | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [importando, setImportando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    let rows: Record<string, string>[] = []

    if (file.name.endsWith('.csv')) {
      rows = parseCSV(text)
    } else {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(sheet) as Record<string, string>[]
    }

    if (rows.length === 0) {
      toast.error('Arquivo vazio ou formato inválido')
      return
    }

    const validadas = rows.map((row) => validarLinha(tipo, row))
    setLinhas(validadas)
    setNomeArquivo(file.name)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const importar = async () => {
    if (!linhas) return
    const validas = linhas.filter((l) => l.valido)
    if (validas.length === 0) {
      toast.error('Nenhuma linha válida para importar')
      return
    }

    setImportando(true)
    let sucesso = 0

    for (const linha of validas) {
      const row = linha.dados
      try {
        if (tipo === 'itens') {
          const payload: Partial<ItemCEU> = {
            nome: row.nome || row.Nome || '',
            tipo: row.tipo || row.Tipo || '',
            ca: row.ca || row.CA || null,
            validade: row.validade || row.Validade || null,
            subgrupo: row.subgrupo || row.Subgrupo || null,
            estoque: parseInt(row.estoque || row.Estoque || '0', 10),
            estoque_minimo: parseInt(row.estoque_minimo || row['Estoque Minimo'] || row['Estoque Mínimo'] || '0', 10),
            prazo_uso_dias: row.prazo_uso_dias || row['Prazo Uso Dias']
              ? parseInt(row.prazo_uso_dias || row['Prazo Uso Dias'] || '0', 10)
              : null,
          }
          const result = await criarItem(payload)
          if (result) sucesso++
        }
        if (tipo === 'fornecedores') {
          const payload: Partial<Fornecedor> = {
            nome: row.nome || row.Nome || '',
            cnpj: row.cnpj || row.CNPJ || null,
            telefone: row.telefone || row.Telefone || null,
            email: row.email || row.Email || null,
          }
          const result = await criarFornecedor(payload)
          if (result) sucesso++
        }
      } catch {
        // continua
      }
    }

    setImportando(false)
    toast.success(`${sucesso} registro(s) importado(s) com sucesso`)
    setLinhas(null)
    setNomeArquivo('')
  }

  const tipoAtual = TIPOS.find((t) => t.id === tipo)!

  return (
    <CeuPageWrapper>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Importação em massa CEU</h2>
          <p className="text-sm text-slate-500">Importe itens ou fornecedores via CSV/Excel</p>
        </div>

        <CeuCard title="Tipo de importação" icon={<Upload className="w-4 h-4" />} gradient="blue">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTipo(t.id)
                  setLinhas(null)
                }}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  tipo === t.id
                    ? 'border-[#3B82F6] bg-blue-50'
                    : 'border-slate-200 hover:border-[#3B82F6]/50'
                }`}
              >
                <p className="font-medium text-slate-900">{t.label}</p>
                <p className="text-xs text-slate-500 mt-1">{t.colunas.join(', ')}</p>
              </button>
            ))}
          </div>
        </CeuCard>

        <CeuCard title="Upload do arquivo" icon={<FileSpreadsheet className="w-4 h-4" />} gradient="blue">
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-[#3B82F6]/30 border-dashed rounded-lg cursor-pointer bg-blue-50/30 hover:bg-blue-50/50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-[#3B82F6] mb-2" />
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold">Clique para fazer upload</span> ou arraste o arquivo
                  </p>
                  <p className="text-xs text-slate-400">CSV ou Excel (.xlsx, .xls)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            {nomeArquivo && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileSpreadsheet className="w-4 h-4 text-[#3B82F6]" />
                {nomeArquivo}
                <button onClick={() => { setLinhas(null); setNomeArquivo('') }}>
                  <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                </button>
              </div>
            )}
          </div>
        </CeuCard>

        {linhas && (
          <CeuCard
            title={`Preview: ${linhas.filter((l) => l.valido).length} válido(s) / ${linhas.filter((l) => !l.valido).length} inválido(s)`}
            icon={<AlertTriangle className="w-4 h-4" />}
            gradient={linhas.some((l) => !l.valido) ? 'orange' : 'green'}
          >
            <div className="max-h-96 overflow-auto border rounded-lg border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium border-b">Status</th>
                    {tipoAtual.colunas.map((col) => (
                      <th key={col} className="text-left px-3 py-2 font-medium border-b capitalize">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                    <th className="text-left px-3 py-2 font-medium border-b">Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${!linha.valido ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2">
                        {linha.valido ? (
                          <CeuBadge type="equipamento">Válido</CeuBadge>
                        ) : (
                          <CeuBadge type="epi">Inválido</CeuBadge>
                        )}
                      </td>
                      {tipoAtual.colunas.map((col) => (
                        <td key={col} className="px-3 py-2 whitespace-nowrap">
                          {linha.dados[col] || linha.dados[col.charAt(0).toUpperCase() + col.slice(1)] || '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-red-600">
                        {linha.erros.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <CeuButton variant="outline" size="sm" onClick={() => { setLinhas(null); setNomeArquivo('') }}>
                Cancelar
              </CeuButton>
              <CeuButton size="sm" onClick={importar} disabled={importando || linhas.every((l) => !l.valido)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                {importando ? 'Importando...' : 'Importar válidos'}
              </CeuButton>
            </div>
          </CeuCard>
        )}
      </div>
    </CeuPageWrapper>
  )
}
