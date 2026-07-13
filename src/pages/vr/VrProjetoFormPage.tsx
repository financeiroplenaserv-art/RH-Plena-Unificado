import { useEffect, useState } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useProjetosVR } from '@/hooks/useProjetosVR'
import { useConfiguracaoVR } from '@/hooks/useConfiguracaoVR'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingScreen } from '@/components/LoadingScreen'
import { VrShell } from './VrShell'
import type { ProjetoVR, VRConfiguracao, VRDadosEmpresa } from '@/types'

const PRODUTOS_VR = ['FLX', 'VBR', 'AXR', 'VBA', 'AXA', 'VCA', 'VBV', 'MBF', 'RAD', 'MNT']

const DADOS_EMPRESA_PADRAO: VRDadosEmpresa = {
  razaoSocial: 'PLENA EA FACILITIES SERVICOS',
  tipoLogradouro: 'RUA',
  logradouro: 'DR BORMAN',
  numero: '000023',
  complemento: '1210',
  bairro: 'CENTRO',
  cidade: 'NITERÓI',
  uf: 'RJ',
  cep: '24020320',
  nomeInterlocutor: 'LUDMILA SILVA DE ALMEIDA NOBRE',
  nomeImpressaoCartao: 'VR - PLENA',
  codLocalEntrega: 'VR - PLENA_4',
  nomeLocalEntrega: 'VR - PLENA, filial 4'
}

const CONFIG_VAZIA: VRConfiguracao = {
  valorVR: 22.00,
  descontoPercentual: 10,
  dataCorte: '',
  dataEfetivacao: '',
  cnpjCliente: '00378476000160',
  produto: 'FLX',
  empresaAlterdata: '00032',
  dadosEmpresa: { ...DADOS_EMPRESA_PADRAO }
}

function mergeConfig(cfg: Record<string, unknown>, padrao: VRConfiguracao | null): VRConfiguracao {
  const dados = (cfg.dadosEmpresa || {}) as VRDadosEmpresa
  return {
    ...CONFIG_VAZIA,
    ...(padrao || {}),
    ...cfg,
    dadosEmpresa: { ...CONFIG_VAZIA.dadosEmpresa, ...dados }
  } as VRConfiguracao
}

export function VrProjetoFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { buscarPorId, criar, atualizar } = useProjetosVR()
  const { config: configPadrao, carregar: carregarPadrao } = useConfiguracaoVR()

  const [nome, setNome] = useState('')
  const [dataCorte, setDataCorte] = useState('')
  const [dataEfetivacao, setDataEfetivacao] = useState('')
  const [config, setConfig] = useState<VRConfiguracao>(() =>
    configPadrao ? { ...configPadrao, dataCorte: '', dataEfetivacao: '' } : CONFIG_VAZIA
  )
  const [loading, setLoading] = useState(false)
  const [carregando, setCarregando] = useState(!!id)

  useEffect(() => {
    carregarPadrao()
  }, [carregarPadrao])

  useEffect(() => {
    const carregar = async () => {
      if (!id) {
        if (configPadrao) {
          setConfig(prev => (prev === CONFIG_VAZIA ? mergeConfig({}, configPadrao) : prev))
        }
        setCarregando(false)
        return
      }

      const projeto = await buscarPorId(id)
      if (projeto) {
        setNome(projeto.nome)
        setDataCorte(projeto.data_corte)
        setDataEfetivacao(projeto.data_efetivacao)
        const cfg = (projeto.configuracao_json || {}) as Record<string, unknown>
        setConfig(mergeConfig(cfg, configPadrao))
      }
      setCarregando(false)
    }
    carregar()
  }, [id, buscarPorId, configPadrao])

  const atualizarConfig = (patch: Partial<VRConfiguracao>) => {
    setConfig(prev => ({ ...prev, ...patch }))
  }

  const atualizarDadosEmpresa = (patch: Partial<VRDadosEmpresa>) => {
    setConfig(prev => ({
      ...prev,
      dadosEmpresa: { ...prev.dadosEmpresa, ...patch }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const payload: Partial<ProjetoVR> = {
      nome,
      data_corte: dataCorte,
      data_efetivacao: dataEfetivacao,
      configuracao_json: {
        ...config,
        dataCorte,
        dataEfetivacao
      }
    }

    let result: ProjetoVR | null
    if (id) {
      result = await atualizar(id, payload)
    } else {
      result = await criar(payload)
    }

    setLoading(false)
    if (result) {
      navigate(`/vr/projetos/${result.id}`)
    }
  }

  if (carregando) {
    return <LoadingScreen mensagem="Carregando projeto..." />
  }

  return (
    <VrShell>
      <PageHeader backTo="/vr/projetos" title={id ? 'Editar projeto VR' : 'Novo projeto VR'} description="Configure os dados para cálculo e geração de arquivos" />

      <div className="flex items-center gap-4">
        <ModuleButton variant="outline" size="sm" onClick={() => navigate('/vr/projetos')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </ModuleButton>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <ModuleCard title="Informações básicas">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do projeto</Label>
              <Input
                id="nome"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: VR Maio/2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataCorte">Data de corte</Label>
              <Input
                id="dataCorte"
                type="date"
                value={dataCorte}
                onChange={e => setDataCorte(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataEfetivacao">Data de efetivação</Label>
              <Input
                id="dataEfetivacao"
                type="date"
                value={dataEfetivacao}
                onChange={e => setDataEfetivacao(e.target.value)}
                required
              />
            </div>
          </div>
        </ModuleCard>

        <ModuleCard title="Configuração do cálculo">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valorVR">Valor do VR (R$)</Label>
              <Input
                id="valorVR"
                type="number"
                step="0.01"
                value={config.valorVR}
                onChange={e => atualizarConfig({ valorVR: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desconto">Desconto funcionário (%)</Label>
              <Input
                id="desconto"
                type="number"
                step="0.01"
                value={config.descontoPercentual}
                onChange={e => atualizarConfig({ descontoPercentual: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="produto">Produto VR</Label>
              <Select
                value={config.produto}
                onValueChange={(v) => atualizarConfig({ produto: v })}
              >
                <SelectTrigger id="produto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTOS_VR.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ do cliente</Label>
              <Input
                id="cnpj"
                value={config.cnpjCliente}
                onChange={e => atualizarConfig({ cnpjCliente: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresaAlterdata">Empresa Alterdata</Label>
              <Select
                value={config.empresaAlterdata}
                onValueChange={(v) => atualizarConfig({ empresaAlterdata: v as '00032' | '00035' })}
              >
                <SelectTrigger id="empresaAlterdata">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="00032">00032</SelectItem>
                  <SelectItem value="00035">00035</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ModuleCard>

        <ModuleCard title="Dados da empresa / local de entrega">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">Razão social</Label>
              <Input
                id="razaoSocial"
                value={config.dadosEmpresa.razaoSocial}
                onChange={e => atualizarDadosEmpresa({ razaoSocial: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codLocal">Código local de entrega</Label>
              <Input
                id="codLocal"
                value={config.dadosEmpresa.codLocalEntrega}
                onChange={e => atualizarDadosEmpresa({ codLocalEntrega: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nomeLocal">Nome local de entrega</Label>
              <Input
                id="nomeLocal"
                value={config.dadosEmpresa.nomeLocalEntrega}
                onChange={e => atualizarDadosEmpresa({ nomeLocalEntrega: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipoLogradouro">Tipo logradouro</Label>
              <Input
                id="tipoLogradouro"
                value={config.dadosEmpresa.tipoLogradouro}
                onChange={e => atualizarDadosEmpresa({ tipoLogradouro: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logradouro">Logradouro</Label>
              <Input
                id="logradouro"
                value={config.dadosEmpresa.logradouro}
                onChange={e => atualizarDadosEmpresa({ logradouro: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={config.dadosEmpresa.numero}
                onChange={e => atualizarDadosEmpresa({ numero: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input
                id="complemento"
                value={config.dadosEmpresa.complemento}
                onChange={e => atualizarDadosEmpresa({ complemento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={config.dadosEmpresa.bairro}
                onChange={e => atualizarDadosEmpresa({ bairro: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={config.dadosEmpresa.cidade}
                onChange={e => atualizarDadosEmpresa({ cidade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                maxLength={2}
                value={config.dadosEmpresa.uf}
                onChange={e => atualizarDadosEmpresa({ uf: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={config.dadosEmpresa.cep}
                onChange={e => atualizarDadosEmpresa({ cep: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interlocutor">Nome do interlocutor</Label>
              <Input
                id="interlocutor"
                value={config.dadosEmpresa.nomeInterlocutor}
                onChange={e => atualizarDadosEmpresa({ nomeInterlocutor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nomeCartao">Nome impressão cartão</Label>
              <Input
                id="nomeCartao"
                value={config.dadosEmpresa.nomeImpressaoCartao}
                onChange={e => atualizarDadosEmpresa({ nomeImpressaoCartao: e.target.value })}
              />
            </div>
          </div>
        </ModuleCard>

        <div className="flex justify-end">
          <ModuleButton type="submit" disabled={loading} size="lg">
            <Save className="w-5 h-5 mr-2" />
            {loading ? 'Salvando...' : 'Salvar e continuar'}
          </ModuleButton>
        </div>
      </form>
    </VrShell>
  )
}
