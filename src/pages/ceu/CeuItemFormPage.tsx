import { useEffect, useState } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CeuShell } from './CeuShell'
import { Input } from '@/components/ui/input'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useCEUFornecedores } from '@/hooks/useCEUFornecedores'
import { LoadingScreen } from '@/components/LoadingScreen'
import { parseMoedaParaCentavos, mascaraMoedaInput } from '@/lib/utils'
import { toast } from 'sonner'

const TIPOS = ['Crachá', 'Uniforme', 'EPI']

const SUBGRUPOS_POR_TIPO: Record<string, string[]> = {
  EPI: ['CABEÇA', 'OCULAR', 'AURICULAR', 'RESPIRATÓRIA', 'MÃOS', 'PÉS', 'VESTIMENTA', 'FACIAL'],
  Uniforme: ['VESTUÁRIO SUPERIOR', 'VESTUÁRIO INFERIOR', 'ACESSÓRIOS'],
  Crachá: ['CRACHÁ'],
  Outros: ['OUTROS'],
}

export function CeuItemFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { criar, atualizar, buscarPorId } = useCEUItens()
  const { fornecedores, listar: listarFornecedores } = useCEUFornecedores()
  const [loading, setLoading] = useState(!!id)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<{
    codigo: string
    tipo: string
    subgrupo: string
    nome: string
    valor: string
    ca: string
    validade: string
    fornecedor_id: string
    estoque: string
    estoque_minimo: string
    prazo_uso_dias: string
    unidade: string
    ultima_compra: string
    situacao: string
  }>({
    codigo: '',
    tipo: '',
    subgrupo: '',
    nome: '',
    valor: '',
    ca: '',
    validade: '',
    fornecedor_id: '',
    estoque: '0',
    estoque_minimo: '0',
    prazo_uso_dias: '',
    unidade: '',
    ultima_compra: '',
    situacao: 'A',
  })

  useEffect(() => {
    listarFornecedores()
  }, [listarFornecedores])

  useEffect(() => {
    if (!id) return
    buscarPorId(id).then((item) => {
      if (item) {
        setForm({
          codigo: item.codigo || '',
          tipo: item.tipo || '',
          subgrupo: item.subgrupo || '',
          nome: item.nome || '',
          valor: item.valor != null ? mascaraMoedaInput((item.valor / 100).toFixed(2).replace('.', ',')) : '',
          ca: item.ca || '',
          validade: item.validade || '',
          fornecedor_id: item.fornecedor_id || '',
          estoque: String(item.estoque ?? 0),
          estoque_minimo: String(item.estoque_minimo ?? 0),
          prazo_uso_dias: item.prazo_uso_dias ? String(item.prazo_uso_dias) : '',
          unidade: item.unidade || '',
          ultima_compra: item.ultima_compra || '',
          situacao: item.situacao || 'A',
        })
      }
      setLoading(false)
    })
  }, [id, buscarPorId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome || !form.tipo) {
      toast.error('Preencha nome e tipo do item')
      return
    }

    setSalvando(true)
    const payload = {
      ...form,
      codigo: form.codigo?.trim() || null,
      fornecedor_id: form.fornecedor_id || null,
      validade: form.tipo === 'EPI' ? form.validade || null : null,
      ca: form.tipo === 'EPI' ? form.ca || null : null,
      subgrupo: form.subgrupo || null,
      valor: parseMoedaParaCentavos(form.valor),
      estoque: parseInt(form.estoque || '0', 10),
      estoque_minimo: parseInt(form.estoque_minimo || '0', 10),
      prazo_uso_dias: form.prazo_uso_dias ? parseInt(form.prazo_uso_dias, 10) : null,
      unidade: form.unidade?.trim() || null,
      ultima_compra: form.ultima_compra || null,
      situacao: form.situacao?.trim() || 'A',
    }

    const sucesso = id
      ? await atualizar(id, payload)
      : await criar(payload)
    setSalvando(false)
    if (sucesso) {
      navigate('/ceu/itens')
    }
  }

  if (loading) return <LoadingScreen mensagem="Carregando item..." />

  return (
    <CeuShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <ModuleButton variant="ghost" onClick={() => navigate('/ceu/itens')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </ModuleButton>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{id ? 'Editar item' : 'Novo item'}</h2>
            <p className="text-sm text-slate-500">Dados do item CEU</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <ModuleCard title="Informações do item">
            <div className="space-y-4">
              {/* Linha 1: Tipo */}
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={form.tipo || '__placeholder__'}
                  onValueChange={(v) => {
                    if (v === '__placeholder__') return
                    setForm((f) => ({ ...f, tipo: v, subgrupo: '' }))
                  }}
                >
                  <SelectTrigger id="tipo" className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__placeholder__" disabled>Selecione o tipo...</SelectItem>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Linha 2: Subgrupo */}
              <div className="space-y-2">
                <Label htmlFor="subgrupo">Subgrupo</Label>
                <Select
                  value={form.subgrupo}
                  onValueChange={(v) => setForm((f) => ({ ...f, subgrupo: v }))}
                  disabled={!form.tipo}
                >
                  <SelectTrigger id="subgrupo" className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                    <SelectValue placeholder={form.tipo ? 'Selecione...' : 'Escolha um tipo primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(SUBGRUPOS_POR_TIPO[form.tipo] || []).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Linha 3: Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Camisa polo, Crachá..."
                />
              </div>

              {/* Linha 4: Código + Valor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código</Label>
                  <Input
                    id="codigo"
                    value={form.codigo}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    placeholder="Ex: 00123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor unitário (R$)</Label>
                  <Input
                    id="valor"
                    type="text"
                    inputMode="decimal"
                    value={form.valor}
                    onChange={(e) => setForm((f) => ({ ...f, valor: mascaraMoedaInput(e.target.value) }))}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Linha 5: Fornecedor */}
              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Select
                  value={form.fornecedor_id || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, fornecedor_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger id="fornecedor" className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Linha 5: Unidade + Última compra + Situação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unidade">Unidade</Label>
                  <Input
                    id="unidade"
                    value={form.unidade}
                    onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                    placeholder="Ex: UN, PA, KG"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ultima_compra">Última compra</Label>
                  <Input
                    id="ultima_compra"
                    type="date"
                    value={form.ultima_compra}
                    onChange={(e) => setForm((f) => ({ ...f, ultima_compra: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="situacao">Situação</Label>
                  <Select
                    value={form.situacao || 'A'}
                    onValueChange={(v) => setForm((f) => ({ ...f, situacao: v }))}
                  >
                    <SelectTrigger id="situacao" className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Ativo</SelectItem>
                      <SelectItem value="I">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Linha 6: Estoque atual + Estoque mínimo + Prazo de uso */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estoque">Estoque atual</Label>
                  <Input
                    id="estoque"
                    type="number"
                    min={0}
                    value={form.estoque}
                    onChange={(e) => setForm((f) => ({ ...f, estoque: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estoque_minimo">Estoque mínimo</Label>
                  <Input
                    id="estoque_minimo"
                    type="number"
                    min={0}
                    value={form.estoque_minimo}
                    onChange={(e) => setForm((f) => ({ ...f, estoque_minimo: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prazo_uso_dias">Prazo de uso (dias)</Label>
                  <Input
                    id="prazo_uso_dias"
                    type="number"
                    min={0}
                    value={form.prazo_uso_dias}
                    onChange={(e) => setForm((f) => ({ ...f, prazo_uso_dias: e.target.value }))}
                    placeholder="Ex: 365"
                  />
                </div>
              </div>

              {/* Linha 6: CA + Validade do CA — só EPI */}
              {form.tipo === 'EPI' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ca">Certificado de Aprovação (CA)</Label>
                    <Input
                      id="ca"
                      value={form.ca}
                      onChange={(e) => setForm((f) => ({ ...f, ca: e.target.value }))}
                      placeholder="Ex: 12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validade">Validade do CA</Label>
                    <Input
                      id="validade"
                      type="date"
                      value={form.validade}
                      onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <ModuleButton type="submit" disabled={salvando || !form.nome || !form.tipo}>
                  <Save className="w-4 h-4 mr-2" />
                  {salvando ? 'Salvando...' : 'Salvar item'}
                </ModuleButton>
              </div>
            </div>
          </ModuleCard>
        </form>
      </div>
    </CeuShell>
  )
}
