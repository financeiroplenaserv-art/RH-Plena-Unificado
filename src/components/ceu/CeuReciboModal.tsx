import { useState, useCallback, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { gerarReciboEPIColorido, gerarReciboEPIPB, gerarReciboUniformeColorido, gerarReciboUniformePB, gerarNumeroRecibo } from '@/lib/ceuRecibos'
import { Download, HardHat, Shirt } from 'lucide-react'

export interface DadosEntrega {
  colaborador: { nome: string; matricula: string; cargo: string; departamento: string; cpf: string; data_admissao?: string | null }
  itens: Array<{ nome: string; grupo: string; subgrupo: string; quantidade: number }>
  dataEntrega: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  dadosEntrega: DadosEntrega | DadosEntrega[] | null
}

type Modo = 'colorido' | 'pb'

function detectarTipoEPI(itens: DadosEntrega['itens']): boolean {
  return itens.some((i) => {
    const g = (i.grupo || '').toUpperCase()
    const n = (i.nome || '').toUpperCase()
    return (
      g === 'EPI' ||
      g.includes('EPI') ||
      n.includes('LUVA') ||
      n.includes('CAPACETE') ||
      n.includes('BOTA') ||
      n.includes('MASCARA') ||
      n.includes('OCULOS') ||
      n.includes('PROTETOR') ||
      n.includes('CINTO') ||
      n.includes('RESPIRADOR')
    )
  })
}

export function CeuReciboModal({ isOpen, onClose, dadosEntrega }: Props) {
  const [modo, setModo] = useState<Modo>('colorido')
  const [abaAtiva, setAbaAtiva] = useState(0)
  const [numeroRecibo] = useState(() => gerarNumeroRecibo())

  const grupos = useMemo(() => {
    if (!dadosEntrega) return []
    return Array.isArray(dadosEntrega) ? dadosEntrega : [dadosEntrega]
  }, [dadosEntrega])

  useEffect(() => {
    if (isOpen) {
      setModo('colorido')
      setAbaAtiva(0)
    }
  }, [isOpen])

  const montarReciboData = useCallback(
    (grupo: DadosEntrega) => {
      return {
        colaborador: {
          nome: grupo.colaborador.nome,
          matricula: grupo.colaborador.matricula,
          funcao: grupo.colaborador.cargo,
          departamento: grupo.colaborador.departamento,
          cpf: grupo.colaborador.cpf.replace(/\D/g, ''),
          data_admissao: grupo.colaborador.data_admissao || null,
        },
        entregas: grupo.itens.map((i) => ({
          item: {
            descricao: i.nome,
            numero_ca: null,
            grupo_macro: i.grupo,
            subgrupo: i.subgrupo || '—',
          },
          quantidade: i.quantidade,
          situacao: 'Novo',
        })),
        dataEntrega: grupo.dataEntrega,
        numeroRecibo,
        nomeEmpresa: 'PLENA EA SERVICOS COMERCIAIS LTDA',
        cnpjEmpresa: '00.378.476/0001-60',
      }
    },
    [numeroRecibo]
  )

  const dadosAbaAtiva = grupos[abaAtiva]
  const isEPI = dadosAbaAtiva ? detectarTipoEPI(dadosAbaAtiva.itens) : false
  const tipoLabel = isEPI ? 'EPI' : 'Uniforme/Crachá'

  const html = useMemo(() => {
    if (!dadosAbaAtiva) return ''
    const data = montarReciboData(dadosAbaAtiva)
    return isEPI
      ? modo === 'colorido'
        ? gerarReciboEPIColorido(data)
        : gerarReciboEPIPB(data)
      : modo === 'colorido'
        ? gerarReciboUniformeColorido(data)
        : gerarReciboUniformePB(data)
  }, [dadosAbaAtiva, isEPI, modo, montarReciboData])

  const baixar = useCallback(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recibo-${isEPI ? 'epi' : 'uniforme'}-${modo}-${numeroRecibo}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [isEPI, modo, html, numeroRecibo])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {isEPI ? <HardHat className="h-5 w-5 text-orange-500" /> : <Shirt className="h-5 w-5 text-emerald-600" />}
            Recibo de {tipoLabel}
            {grupos.length > 1 && <span className="text-sm font-normal text-gray-400 ml-2">({abaAtiva + 1}/{grupos.length})</span>}
            <span className="text-sm font-normal text-gray-400 ml-2">({numeroRecibo})</span>
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Visualize o recibo antes de imprimir ou baixar. Escolha entre versão colorida ou P&B.
          </p>
        </DialogHeader>

        {grupos.length > 1 && (
          <Tabs value={String(abaAtiva)} onValueChange={(v) => setAbaAtiva(Number(v))} className="mb-3">
            <TabsList className="bg-gray-100">
              {grupos.map((grupo, idx) => {
                const epi = detectarTipoEPI(grupo.itens)
                return (
                  <TabsTrigger key={idx} value={String(idx)} className="data-[state=active]:bg-white data-[state=active]:text-blue-600">
                    {epi ? <HardHat className="h-3.5 w-3.5 mr-1.5 text-orange-500" /> : <Shirt className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />}
                    {epi ? 'EPI' : 'Uniforme/Crachá'}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        )}

        <Tabs value={modo} onValueChange={(v) => setModo(v as Modo)} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <TabsList className="bg-gray-100">
              <TabsTrigger value="colorido" className="data-[state=active]:bg-white data-[state=active]:text-blue-600">
                Colorido (Digital)
              </TabsTrigger>
              <TabsTrigger value="pb" className="data-[state=active]:bg-white data-[state=active]:text-gray-900">
                P&B (Impressão)
              </TabsTrigger>
            </TabsList>
            <Button
              onClick={baixar}
              className={isEPI ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
            >
              <Download className="h-4 w-4 mr-2" /> Baixar {modo === 'colorido' ? 'Colorido' : 'P&B'}
            </Button>
          </div>
          <TabsContent value="colorido" className="flex-1 m-0">
            <div className="border rounded-lg bg-white h-[60vh] overflow-auto shadow-sm">
              <iframe title="Preview" srcDoc={html} className="w-full h-full" sandbox="allow-same-origin" />
            </div>
          </TabsContent>
          <TabsContent value="pb" className="flex-1 m-0">
            <div className="border rounded-lg bg-white h-[60vh] overflow-auto shadow-sm">
              <iframe title="Preview PB" srcDoc={html} className="w-full h-full" sandbox="allow-same-origin" />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
