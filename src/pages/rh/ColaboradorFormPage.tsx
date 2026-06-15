import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save } from 'lucide-react'
import type { Colaborador } from '@/types/database'

function limparPayload(data: Record<string, string>): Partial<Colaborador> {
  const payload: Partial<Colaborador> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue
    // @ts-expect-error - mapeamento dinâmico de campos do formulário
    payload[key as keyof Colaborador] = value === '' || value === undefined ? null : value
  }
  return payload
}

export function ColaboradorFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [form, setForm] = useState<Record<string, string>>({
    matricula: '',
    nome_completo: '',
    cpf: '',
    rg: '',
    ctps: '',
    pis_pasep: '',
    data_nascimento: '',
    email: '',
    telefone: '',
    celular: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    data_admissao: '',
    data_demissao: '',
    tipo_contrato: 'CLT',
    cargo: '',
    departamento: '',
    status: 'Ativo',
  })
  const [loading, setLoading] = useState(false)

  const loadColaborador = useCallback(async () => {
    const { data } = await supabase.from('colaboradores').select('*').eq('id', id!).single()
    if (data) {
      const d = data as Colaborador
      setForm({
        matricula: d.matricula || '',
        nome_completo: d.nome_completo || '',
        cpf: d.cpf || '',
        rg: d.rg || '',
        ctps: d.ctps || '',
        pis_pasep: d.pis_pasep || '',
        data_nascimento: d.data_nascimento || '',
        email: d.email || '',
        telefone: d.telefone || '',
        celular: d.celular || '',
        endereco: d.endereco || '',
        cidade: d.cidade || '',
        estado: d.estado || '',
        cep: d.cep || '',
        data_admissao: d.data_admissao || '',
        data_demissao: d.data_demissao || '',
        tipo_contrato: d.tipo_contrato || 'CLT',
        cargo: d.cargo || '',
        departamento: d.departamento || '',
        status: d.status || 'Ativo',
      })
    }
  }, [id])

  useEffect(() => {
    // Carrega colaborador em modo edição

    if (isEdit) loadColaborador()
  }, [isEdit, loadColaborador])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.matricula.trim() || !form.nome_completo.trim()) {
      toast.error('Matrícula e Nome Completo são obrigatórios')
      return
    }

    setLoading(true)

    const payload = limparPayload({
      ...form,
      status: form.data_demissao ? 'Inativo' : form.status || 'Ativo',
    })

    try {
      if (isEdit) {
        const { error } = await supabase.from('colaboradores').update(payload).eq('id', id!)
        if (error) {
          console.error('Erro update:', error)
          toast.error('Erro ao atualizar: ' + error.message)
        } else {
          toast.success('Colaborador atualizado com sucesso')
          navigate('/colaboradores')
        }
      } else {
        const { error } = await supabase.from('colaboradores').insert(payload)
        if (error) {
          console.error('Erro insert:', error)
          if (error.message.includes('duplicate')) {
            toast.error('Erro: Matrícula já existe no sistema')
          } else {
            toast.error('Erro ao criar: ' + error.message)
          }
        } else {
          toast.success('Colaborador cadastrado com sucesso')
          navigate('/colaboradores')
        }
      }
    } catch (err: unknown) {
      console.error('Erro geral:', err)
      toast.error('Erro inesperado: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
    }

    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/colaboradores')}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <h2 className="text-xl font-bold text-slate-800">
          {isEdit ? 'Editar' : 'Novo'} Colaborador
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Pessoais *</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome Completo *</Label>
                <Input
                  name="nome_completo"
                  value={form.nome_completo}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label>Matrícula *</Label>
                <Input name="matricula" value={form.matricula} onChange={handleChange} required />
              </div>
              <div>
                <Label>CPF</Label>
                <Input
                  name="cpf"
                  value={form.cpf}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label>RG</Label>
                <Input name="rg" value={form.rg} onChange={handleChange} />
              </div>
              <div>
                <Label>CTPS</Label>
                <Input name="ctps" value={form.ctps} onChange={handleChange} />
              </div>
              <div>
                <Label>PIS/PASEP</Label>
                <Input name="pis_pasep" value={form.pis_pasep} onChange={handleChange} />
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  name="data_nascimento"
                  value={form.data_nascimento}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" name="email" value={form.email} onChange={handleChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endereço e Contato</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Endereço Completo</Label>
                <Input name="endereco" value={form.endereco} onChange={handleChange} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input name="cidade" value={form.cidade} onChange={handleChange} />
              </div>
              <div>
                <Label>Estado (UF)</Label>
                <Input name="estado" value={form.estado} onChange={handleChange} maxLength={2} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input name="cep" value={form.cep} onChange={handleChange} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input name="telefone" value={form.telefone} onChange={handleChange} />
              </div>
              <div>
                <Label>Celular</Label>
                <Input name="celular" value={form.celular} onChange={handleChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Profissionais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Cargo/Função</Label>
                <Input name="cargo" value={form.cargo} onChange={handleChange} />
              </div>
              <div>
                <Label>Departamento</Label>
                <Input name="departamento" value={form.departamento} onChange={handleChange} />
              </div>
              <div>
                <Label>Tipo de Contrato</Label>
                <Select
                  value={form.tipo_contrato}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, tipo_contrato: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLT">CLT</SelectItem>
                    <SelectItem value="PJ">PJ</SelectItem>
                    <SelectItem value="Estagio">Estágio</SelectItem>
                    <SelectItem value="Temporario">Temporário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Admissão</Label>
                <Input
                  type="date"
                  name="data_admissao"
                  value={form.data_admissao}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Data de Demissão</Label>
                <Input
                  type="date"
                  name="data_demissao"
                  value={form.data_demissao}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Afastado">Afastado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/colaboradores')}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4" /> {loading ? 'Salvando...' : 'Salvar Colaborador'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
