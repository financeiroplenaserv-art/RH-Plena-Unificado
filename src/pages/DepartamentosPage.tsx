import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2, Search, Save, Pencil, Trash2, X, FileSpreadsheet, Upload, Loader2, RefreshCw, Plus, ArrowUp, ArrowDown, ArrowUpDown
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
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { useAuth } from '@/hooks/useAuth'
import * as XLSX from '@e965/xlsx'
import { toast } from 'sonner'
import { mascaraCEP, mascaraTelefone } from '@/lib/utils'
import {
  podeEditarDepartamento,
  podeExcluirDepartamento,
  podeImportarDepartamentos,
} from '@/lib/permissoes'
import type { Departamento } from '@/types/database'

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
    'Data início contrato': d.data_inicio_contrato || '',
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
  data_inicio_contrato: '',
}

export function DepartamentosPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeEditar = perfil ? podeEditarDepartamento(perfil) : false
  const podeExcluir = perfil ? podeExcluirDepartamento(perfil) : false
  const podeImportar = perfil ? podeImportarDepartamentos(perfil) : false

  const { departamentos, loading, sincronizando, listar, criar, atualizar, remover, sincronizar } = useDepartamentos()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'Ativo' | 'Inativo'>('Ativo')
  type OrdenacaoColuna = 'nome_curto' | 'nome' | 'endereco'
  type OrdenacaoDirecao = 'asc' | 'desc'
  const [ordenacao, setOrdenacao] = useState<{ coluna: OrdenacaoColuna; direcao: OrdenacaoDirecao }>({ coluna: 'nome_curto', direcao: 'asc' })

  const alternarOrdenacao = (coluna: OrdenacaoColuna) => {
    setOrdenacao(prev => ({
      coluna,
      direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc',
    }))
  }
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
    lista = [...lista].sort((a, b) => {
      let comparacao = 0
      if (ordenacao.coluna === 'nome_curto') {
        comparacao = (a.nome_curto || a.nome).localeCompare(b.nome_curto || b.nome)
      } else if (ordenacao.coluna === 'nome') {
        comparacao = a.nome.localeCompare(b.nome)
      } else if (ordenacao.coluna === 'endereco') {
        comparacao = (a.endereco || '').localeCompare(b.endereco || '')
      }
      return ordenacao.direcao === 'asc' ? comparacao : -comparacao
    })
    return lista
  }, [departamentos, busca, filtroStatus, ordenacao])

  const handleNovo = () => {
    setEditandoId(null)
    setForm(formVazio)
    setMostrarForm(true)
  }

  const handleSalvar = async () => {
    if (!form.nome?.trim()) {
      toast.error('Informe o nome do departamento')
      return
    }
    if (!form.nome_curto?.trim()) {
      toast.error('Informe o nome curto do departamento')
      return
    }
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
      data_inicio_contrato: d.data_inicio_contrato,
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
          data_inicio_contrato: r['Data início contrato'] || r.data_inicio_contrato || r['Data inicio contrato'] || null,
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

  const limparFiltros = () => {
    setBusca('')
    setFiltroStatus('Ativo')
  }

  const aplicarFiltros = () => {
    // filtros são reativos; botão mantém padrão de UX
  }

  return (
    <div className="min-h-full space-y-5">
      <PageHeader backTo="/" title="Departamentos" description="Gestão de condomínios, empresas e hospitais">
        {podeEditar && (
          <Button onClick={handleNovo}>
            <Plus className="size-4" />
            Novo departamento
          </Button>
        )}
      </PageHeader>

      <Filters onApply={aplicarFiltros} onClear={limparFiltros} loading={loading}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, contato..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filtroStatus}
          onValueChange={v => setFiltroStatus(v as 'todos' | 'Ativo' | 'Inativo')}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Ativo">Ativos</SelectItem>
            <SelectItem value="Inativo">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button variant="outline" size="sm" onClick={() => exportarExcel(departamentosFiltrados)}>
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
          {podeImportar && (
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              CSV
            </Button>
          )}
          {podeImportar && (
            <Button
              variant="outline"
              size="sm"
              onClick={sincronizar}
              disabled={sincronizando || departamentos.length === 0}
            >
              {sincronizando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sync
            </Button>
          )}
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportarCSV} />
        </div>
      </Filters>

      <DataTable title="Departamentos cadastrados" count={departamentosFiltrados.length}>
        {departamentosFiltrados.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum departamento encontrado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => alternarOrdenacao('nome_curto')}
                    className="flex items-center gap-1 font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Departamento
                    {ordenacao.coluna === 'nome_curto' && ordenacao.direcao === 'asc' ? (
                      <ArrowUp className="size-3" />
                    ) : ordenacao.coluna === 'nome_curto' && ordenacao.direcao === 'desc' ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => alternarOrdenacao('endereco')}
                    className="flex items-center gap-1 font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Endereço
                    {ordenacao.coluna === 'endereco' && ordenacao.direcao === 'asc' ? (
                      <ArrowUp className="size-3" />
                    ) : ordenacao.coluna === 'endereco' && ordenacao.direcao === 'desc' ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-muted-foreground">Contato portaria/adm</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-muted-foreground">Síndico / Administrador</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-muted-foreground">Início contrato</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departamentosFiltrados.map(d => (
                <TableRow key={d.id} className="hover:bg-accent/40">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{d.nome_curto?.trim() || d.nome}</span>
                        {d.nome_curto?.trim() && <span className="text-xs text-muted-foreground">{d.nome}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.endereco ? (
                      <div className="flex flex-col">
                        <span>{d.endereco}</span>
                        <span className="text-xs text-muted-foreground/80">{[d.bairro, d.cidade].filter(Boolean).join(' - ')}</span>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.contato_portaria || d.telefone_contato ? (
                      <div className="flex flex-col">
                        <span>{d.contato_portaria || '—'}</span>
                        <span className="text-xs text-muted-foreground/80">{mascaraTelefone(d.telefone_contato) || '—'}</span>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.nome_contato ? (
                      <div className="flex flex-col">
                        <span>{d.nome_contato}</span>
                        <span className="text-xs text-muted-foreground/80">{mascaraTelefone(d.telefone_contato) || '—'}</span>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.data_inicio_contrato ? (
                      <span>{new Date(d.data_inicio_contrato + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={d.status === 'Ativo' ? 'success' : 'neutral'}>
                      {d.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {podeEditar && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-foreground hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditar(d)
                          }}
                        >
                          <Pencil className="size-4" />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          onClick={() => setConfirmarExclusao(d.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <Dialog open={mostrarForm} onOpenChange={setMostrarForm}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editandoId ? 'Editar departamento' : 'Novo departamento'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do departamento. Os campos com * são obrigatórios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Ex: Condomínio Solar da Praia"
                  value={form.nome || ''}
                  onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome curto *</Label>
                <Input
                  placeholder="Ex: Solar"
                  value={form.nome_curto || ''}
                  onChange={e => setForm(prev => ({ ...prev, nome_curto: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contato portaria/adm</Label>
                <Input
                  placeholder="Ex: João - Porteiro"
                  value={form.contato_portaria || ''}
                  onChange={e => setForm(prev => ({ ...prev, contato_portaria: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="space-y-2 md:col-span-4">
                <Label>Endereço</Label>
                <Input
                  placeholder="Endereço completo"
                  value={form.endereco || ''}
                  onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Bairro</Label>
                <Input
                  placeholder="Bairro"
                  value={form.bairro || ''}
                  onChange={e => setForm(prev => ({ ...prev, bairro: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={form.cidade || ''}
                  onChange={e => setForm(prev => ({ ...prev, cidade: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Estado</Label>
                <Input
                  placeholder="UF"
                  maxLength={2}
                  value={form.estado || ''}
                  onChange={e => setForm(prev => ({ ...prev, estado: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>CEP</Label>
                <Input
                  placeholder="00000-000"
                  value={mascaraCEP(form.cep || '')}
                  onChange={e => setForm(prev => ({ ...prev, cep: mascaraCEP(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nome do síndico/administrador</Label>
                <Input
                  placeholder="Nome do contato"
                  value={form.nome_contato || ''}
                  onChange={e => setForm(prev => ({ ...prev, nome_contato: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={mascaraTelefone(form.telefone_contato || '')}
                  onChange={e => setForm(prev => ({ ...prev, telefone_contato: mascaraTelefone(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={form.email_contato || ''}
                  onChange={e => setForm(prev => ({ ...prev, email_contato: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nome do 2º contato</Label>
                <Input
                  placeholder="Nome do segundo contato"
                  value={form.nome_contato_2 || ''}
                  onChange={e => setForm(prev => ({ ...prev, nome_contato_2: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone 2</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={mascaraTelefone(form.telefone_contato_2 || '')}
                  onChange={e => setForm(prev => ({ ...prev, telefone_contato_2: mascaraTelefone(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail 2</Label>
                <Input
                  type="email"
                  placeholder="email2@exemplo.com"
                  value={form.email_contato_2 || ''}
                  onChange={e => setForm(prev => ({ ...prev, email_contato_2: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status || 'Ativo'}
                  onValueChange={v => setForm(prev => ({ ...prev, status: v as 'Ativo' | 'Inativo' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de início do contrato</Label>
                <Input
                  type="date"
                  value={form.data_inicio_contrato || ''}
                  onChange={e => setForm(prev => ({ ...prev, data_inicio_contrato: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelar}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={!form.nome?.trim() || loading} loading={loading}>
              <Save className="size-4" />
              {editandoId ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmarExclusao}
        onOpenChange={() => setConfirmarExclusao(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Excluir departamento?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => confirmarExclusao && handleExcluir(confirmarExclusao)}
        destructive
      />
    </div>
  )
}
