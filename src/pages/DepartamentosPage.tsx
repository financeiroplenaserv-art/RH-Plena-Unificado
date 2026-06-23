import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2, Search, Save, Pencil, Trash2, X, FileSpreadsheet, Upload, Loader2, RefreshCw, Plus
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { mascaraCEP, mascaraTelefone } from '@/lib/utils'
import type { Departamento } from '@/types/database'

function getStatusBadge(status: string) {
  return status === 'Ativo'
    ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Ativo</Badge>
    : <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Inativo</Badge>
}

function exportarExcel(departamentos: Departamento[]) {
  const rows = departamentos.map(d => ({
    Nome: d.nome,
    'Nome curto': d.nome_curto || '',
    'Contato portaria/adm': d.contato_portaria || '',
    Endereço: d.endereco || '',
    Bairro: d.bairro || '',
    Cidade: d.cidade || '',
    Estado: d.estado || '',
    CEP: d.cep || '',
    'Nome do contato': d.nome_contato || '',
    'Telefone do contato': d.telefone_contato || '',
    'E-mail do contato': d.email_contato || '',
    'Nome do contato 2': d.nome_contato_2 || '',
    'Telefone do contato 2': d.telefone_contato_2 || '',
    'E-mail do contato 2': d.email_contato_2 || '',
    Status: d.status,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Departamentos')
  XLSX.writeFile(wb, 'departamentos.xlsx')
}

function parseCSV(texto: string): Record<string, string>[] {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim())
  if (linhas.length < 2) return []
  const headers = linhas[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return linhas.slice(1).map(linha => {
    const valores: string[] = []
    let atual = ''
    let dentroAspas = false
    for (let i = 0; i < linha.length; i++) {
      const char = linha[i]
      if (char === '"') {
        if (dentroAspas && linha[i + 1] === '"') {
          atual += '"'
          i++
        } else {
          dentroAspas = !dentroAspas
        }
      } else if (char === ',' && !dentroAspas) {
        valores.push(atual.trim())
        atual = ''
      } else {
        atual += char
      }
    }
    valores.push(atual.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = valores[idx]?.replace(/^"|"$/g, '') || '' })
    return obj
  })
}

const formVazio: Partial<Departamento> = {
  status: 'Ativo',
  nome: '',
  nome_curto: '',
  contato_portaria: '',
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  nome_contato: '',
  telefone_contato: '',
  email_contato: '',
  nome_contato_2: '',
  telefone_contato_2: '',
  email_contato_2: '',
}

export function DepartamentosPage() {
  const { departamentos, loading, sincronizando, listar, criar, atualizar, remover, sincronizar } = useDepartamentos()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'Ativo' | 'Inativo'>('Ativo')
  const [form, setForm] = useState<Partial<Departamento>>(formVazio)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listar()
  }, [listar])

  const departamentosFiltrados = useMemo(() => {
    let lista = departamentos
    if (filtroStatus !== 'todos') {
      lista = lista.filter(d => d.status === filtroStatus)
    }
    const termo = busca.trim().toLowerCase()
    if (termo) {
      lista = lista.filter(d =>
        d.nome.toLowerCase().includes(termo) ||
        (d.nome_curto || '').toLowerCase().includes(termo) ||
        (d.contato_portaria || '').toLowerCase().includes(termo) ||
        (d.nome_contato || '').toLowerCase().includes(termo)
      )
    }
    return lista
  }, [departamentos, busca, filtroStatus])

  const handleNovo = () => {
    setEditandoId(null)
    setForm(formVazio)
    setMostrarForm(true)
  }

  const handleSalvar = async () => {
    if (!form.nome?.trim()) return
    const payload = { ...form }
    if (editandoId) {
      await atualizar(editandoId, payload)
      setEditandoId(null)
    } else {
      await criar(payload as Omit<Departamento, 'id' | 'created_at'>)
    }
    setForm(formVazio)
    setMostrarForm(false)
  }

  const handleEditar = (d: Departamento) => {
    setEditandoId(d.id)
    setForm({
      nome: d.nome,
      nome_curto: d.nome_curto,
      contato_portaria: d.contato_portaria,
      endereco: d.endereco,
      bairro: d.bairro,
      cidade: d.cidade,
      estado: d.estado,
      cep: d.cep,
      nome_contato: d.nome_contato,
      telefone_contato: d.telefone_contato,
      email_contato: d.email_contato,
      nome_contato_2: d.nome_contato_2,
      telefone_contato_2: d.telefone_contato_2,
      email_contato_2: d.email_contato_2,
      status: d.status,
    })
    setMostrarForm(true)
  }

  const handleCancelar = () => {
    setEditandoId(null)
    setForm(formVazio)
    setMostrarForm(false)
  }

  const handleExcluir = async (id: string) => {
    await remover(id)
    setConfirmarExclusao(null)
  }

  const handleImportarCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const texto = await file.text()
      const registros = parseCSV(texto)
      let criados = 0
      for (const r of registros) {
        if (!r.Nome?.trim()) continue
        const resultado = await criar({
          nome: r.Nome.trim(),
          nome_curto: r['Nome curto']?.trim() || r.nome_curto?.trim() || null,
          contato_portaria: r['Contato portaria/adm']?.trim() || r.contato_portaria?.trim() || null,
          empresa_id: null,
          endereco: r.Endereço || r.Endereco || null,
          bairro: r.Bairro || r.bairro || null,
          cidade: r.Cidade || r.cidade || null,
          estado: r.Estado || r.estado || null,
          cep: r.CEP || r.cep || null,
          nome_contato: r['Nome do contato'] || r.nome_contato || null,
          telefone_contato: r['Telefone do contato'] || r.telefone_contato || null,
          email_contato: r['E-mail do contato'] || r.email_contato || null,
          nome_contato_2: r['Nome do contato 2'] || r.nome_contato_2 || null,
          telefone_contato_2: r['Telefone do contato 2'] || r.telefone_contato_2 || null,
          email_contato_2: r['E-mail do contato 2'] || r.email_contato_2 || null,
          status: (r.Status?.trim() === 'Inativo' ? 'Inativo' : 'Ativo') as 'Ativo' | 'Inativo',
        })
        if (resultado) criados++
      }
      toast.success(`${criados} departamento(s) importado(s)`)
    } catch {
      toast.error('Erro ao importar CSV')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-full p-4 md:p-6" style={{ backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>Departamentos</h2>
            <p className="text-sm" style={{ color: '#94A3B8' }}>Gestão de condomínios, empresas e hospitais</p>
          </div>
          <button
            onClick={handleNovo}
            className="inline-flex items-center justify-center rounded-lg h-10 px-4 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#1F2937' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo departamento
          </button>
        </div>

        {/* Filtros */}
        <div className="rounded-xl shadow-sm border-0 overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
            <h3 className="text-base font-semibold" style={{ color: '#1F2937' }}>Filtros</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
                <Input
                  placeholder="Buscar por nome, contato..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="pl-10 rounded-lg"
                />
              </div>
              <div>
                <Select
                  value={filtroStatus}
                  onValueChange={v => setFiltroStatus(v as 'todos' | 'Ativo' | 'Inativo')}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativos</SelectItem>
                    <SelectItem value="Inativo">Inativos</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => exportarExcel(departamentosFiltrados)}
                  className="inline-flex items-center justify-center rounded-lg h-10 px-4 text-sm font-medium bg-white hover:bg-slate-50 transition-colors"
                  style={{ borderColor: '#1F2937', color: '#1F2937', borderWidth: '1px' }}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center rounded-lg h-10 px-4 text-sm font-medium bg-white hover:bg-slate-50 transition-colors"
                  style={{ borderColor: '#1F2937', color: '#1F2937', borderWidth: '1px' }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  CSV
                </button>
                <button
                  onClick={sincronizar}
                  disabled={sincronizando || departamentos.length === 0}
                  className="inline-flex items-center justify-center rounded-lg h-10 px-4 text-sm font-medium bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
                  style={{ borderColor: '#1F2937', color: '#1F2937', borderWidth: '1px' }}
                >
                  {sincronizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Sync
                </button>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportarCSV} />
              </div>
            </div>
          </div>
        </div>

        {/* Formulário */}
        {mostrarForm && (
          <div className="rounded-xl shadow-sm border-0 overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <h3 className="text-base font-semibold" style={{ color: '#1F2937' }}>{editandoId ? 'Editar departamento' : 'Novo departamento'}</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Linha 1: Nome | Nome Curto | Contato portaria/adm */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>Nome *</Label>
                  <Input
                    placeholder="Ex: Condomínio Solar da Praia"
                    value={form.nome || ''}
                    onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>Nome curto</Label>
                  <Input
                    placeholder="Ex: Solar"
                    value={form.nome_curto || ''}
                    onChange={e => setForm(prev => ({ ...prev, nome_curto: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>Contato portaria/adm</Label>
                  <Input
                    placeholder="Ex: João - Porteiro"
                    value={form.contato_portaria || ''}
                    onChange={e => setForm(prev => ({ ...prev, contato_portaria: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* Linha 2: Endereço | Bairro | Cidade | Estado | CEP */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="space-y-2 md:col-span-4">
                  <Label style={{ color: '#1F2937' }}>Endereço</Label>
                  <Input
                    placeholder="Endereço completo"
                    value={form.endereco || ''}
                    onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label style={{ color: '#1F2937' }}>Bairro</Label>
                  <Input
                    placeholder="Bairro"
                    value={form.bairro || ''}
                    onChange={e => setForm(prev => ({ ...prev, bairro: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label style={{ color: '#1F2937' }}>Cidade</Label>
                  <Input
                    placeholder="Cidade"
                    value={form.cidade || ''}
                    onChange={e => setForm(prev => ({ ...prev, cidade: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label style={{ color: '#1F2937' }}>Estado</Label>
                  <Input
                    placeholder="UF"
                    maxLength={2}
                    value={form.estado || ''}
                    onChange={e => setForm(prev => ({ ...prev, estado: e.target.value.toUpperCase() }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label style={{ color: '#1F2937' }}>CEP</Label>
                  <Input
                    placeholder="00000-000"
                    value={mascaraCEP(form.cep || '')}
                    onChange={e => setForm(prev => ({ ...prev, cep: mascaraCEP(e.target.value) }))}
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* Linha 3: Nome do síndico | Telefone | E-mail */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>Nome do síndico/administrador</Label>
                  <Input
                    placeholder="Nome do contato"
                    value={form.nome_contato || ''}
                    onChange={e => setForm(prev => ({ ...prev, nome_contato: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={mascaraTelefone(form.telefone_contato || '')}
                    onChange={e => setForm(prev => ({ ...prev, telefone_contato: mascaraTelefone(e.target.value) }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>E-mail</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={form.email_contato || ''}
                    onChange={e => setForm(prev => ({ ...prev, email_contato: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* Linha 4: Nome do 2º contato | Telefone 2 | E-mail 2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>Nome do 2º contato</Label>
                  <Input
                    placeholder="Nome do segundo contato"
                    value={form.nome_contato_2 || ''}
                    onChange={e => setForm(prev => ({ ...prev, nome_contato_2: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>Telefone 2</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={mascaraTelefone(form.telefone_contato_2 || '')}
                    onChange={e => setForm(prev => ({ ...prev, telefone_contato_2: mascaraTelefone(e.target.value) }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>E-mail 2</Label>
                  <Input
                    type="email"
                    placeholder="email2@exemplo.com"
                    value={form.email_contato_2 || ''}
                    onChange={e => setForm(prev => ({ ...prev, email_contato_2: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* Linha 5: Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label style={{ color: '#1F2937' }}>Status</Label>
                  <Select
                    value={form.status || 'Ativo'}
                    onValueChange={v => setForm(prev => ({ ...prev, status: v as 'Ativo' | 'Inativo' }))}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSalvar}
                  disabled={!form.nome?.trim() || loading}
                  className="inline-flex items-center justify-center rounded-lg h-10 px-4 text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#1F2937' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {editandoId ? 'Atualizar' : 'Salvar'}
                </button>
                <button
                  onClick={handleCancelar}
                  className="inline-flex items-center justify-center rounded-lg h-10 px-4 text-sm font-medium bg-white hover:bg-slate-50 transition-colors"
                  style={{ borderColor: '#1F2937', color: '#1F2937', borderWidth: '1px' }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="rounded-xl shadow-sm border-0 overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
            <h3 className="text-base font-semibold" style={{ color: '#1F2937' }}>
              Departamentos cadastrados ({departamentosFiltrados.length})
            </h3>
          </div>
          <div className="p-6">
            {departamentosFiltrados.length === 0 ? (
              <p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum departamento encontrado.</p>
            ) : (
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
                <Table>
                  <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                    <TableRow>
                      <TableHead style={{ color: '#1F2937' }}>Departamento</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Contato portaria/adm</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Síndico / Administrador</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Status</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departamentosFiltrados.map(d => (
                      <TableRow key={d.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium" style={{ color: '#1F2937' }}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" style={{ color: '#94A3B8' }} />
                            <div className="flex flex-col">
                              <span>{d.nome_curto?.trim() || d.nome}</span>
                              {d.nome_curto?.trim() && <span className="text-xs" style={{ color: '#94A3B8' }}>{d.nome}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell style={{ color: '#64748B' }}>{d.contato_portaria || '—'}</TableCell>
                        <TableCell style={{ color: '#64748B' }}>
                          {d.nome_contato ? (
                            <div className="flex flex-col">
                              <span>{d.nome_contato}</span>
                              <span className="text-xs" style={{ color: '#94A3B8' }}>{mascaraTelefone(d.telefone_contato) || '—'}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{getStatusBadge(d.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1.5 rounded-md hover:bg-slate-100"
                              style={{ color: '#1F2937' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditar(d)
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                              onClick={() => setConfirmarExclusao(d.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!confirmarExclusao} onOpenChange={() => setConfirmarExclusao(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>Excluir departamento?</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setConfirmarExclusao(null)}
              className="inline-flex items-center justify-center rounded-lg h-9 px-3 text-sm font-medium bg-white hover:bg-slate-50"
              style={{ borderColor: '#1F2937', color: '#1F2937', borderWidth: '1px' }}
            >
              Cancelar
            </button>
            <button
              onClick={() => confirmarExclusao && handleExcluir(confirmarExclusao)}
              className="inline-flex items-center justify-center rounded-lg h-9 px-3 text-sm font-medium bg-red-600 text-white hover:bg-red-700"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
