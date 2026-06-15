import { useState, useCallback, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { gerarReciboEPIColorido, gerarReciboEPIPB, gerarReciboUniformeColorido, gerarReciboUniformePB, gerarNumeroRecibo } from '@/lib/ceuRecibos'
import { Download, HardHat, Shirt } from 'lucide-react'

export interface DadosEntrega { colaborador: { nome: string; matricula: string; cargo: string; departamento: string; cpf: string }; itens: Array<{ nome: string; grupo: string; subgrupo: string; quantidade: number }>; dataEntrega: string }
interface Props { isOpen: boolean; onClose: () => void; dadosEntrega: DadosEntrega | null }
type Modo = 'colorido' | 'pb'

function detectarTipoEPI(itens: DadosEntrega['itens']): boolean {
  return itens.some((i) => { const g = (i.grupo || '').toUpperCase(); const n = (i.nome || '').toUpperCase(); return g === 'EPI' || g.includes('EPI') || n.includes('LUVA') || n.includes('CAPACETE') || n.includes('BOTA') || n.includes('MASCARA') || n.includes('OCULOS') || n.includes('PROTETOR') || n.includes('CINTO') || n.includes('RESPIRADOR') })
}

export function CeuReciboModal({ isOpen, onClose, dadosEntrega }: Props) {
  const [modo, setModo] = useState<Modo>('colorido')
  const [numeroRecibo] = useState(() => gerarNumeroRecibo())
  const isEPI = useMemo(() => dadosEntrega ? detectarTipoEPI(dadosEntrega.itens) : false, [dadosEntrega])
  const tipoLabel = isEPI ? 'EPI' : 'Uniforme/Crachá'

  const montarReciboData = useCallback(() => { if (!dadosEntrega) return null; return { colaborador: { nome: dadosEntrega.colaborador.nome, matricula: dadosEntrega.colaborador.matricula, funcao: dadosEntrega.colaborador.cargo, departamento: dadosEntrega.colaborador.departamento, cpf: dadosEntrega.colaborador.cpf.replace(/\D/g, ''), data_admissao: null }, entregas: dadosEntrega.itens.map((i) => ({ item: { descricao: i.nome, numero_ca: null, grupo_macro: i.grupo, subgrupo: i.subgrupo || '—' }, quantidade: i.quantidade, situacao: 'Novo' })), dataEntrega: dadosEntrega.dataEntrega, numeroRecibo, nomeEmpresa: 'PLENA EA SERVICOS COMERCIAIS LTDA', cnpjEmpresa: '00.378.476/0001-60' } }, [dadosEntrega, numeroRecibo])

  const html = useMemo(() => { const data = montarReciboData(); if (!data) return ''; return isEPI ? (modo === 'colorido' ? gerarReciboEPIColorido(data) : gerarReciboEPIPB(data)) : (modo === 'colorido' ? gerarReciboUniformeColorido(data) : gerarReciboUniformePB(data)) }, [isEPI, modo, montarReciboData])

  const baixar = useCallback(() => { const blob = new Blob([html], { type: 'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `recibo-${isEPI ? 'epi' : 'uniforme'}-${modo}-${numeroRecibo}.html`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000) }, [isEPI, modo, html, numeroRecibo])

  useEffect(() => { if (isOpen) setModo('colorido') }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">{isEPI ? <HardHat className="h-5 w-5 text-orange-500" /> : <Shirt className="h-5 w-5 text-emerald-600" />} Recibo de {tipoLabel} <span className="text-sm font-normal text-gray-400 ml-2">({numeroRecibo})</span></DialogTitle>
          <p className="text-sm text-gray-500">Visualize o recibo antes de imprimir ou baixar. Escolha entre versão colorida ou P&B.</p>
        </DialogHeader>
        <Tabs value={modo} onValueChange={(v) => setModo(v as Modo)} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <TabsList className="bg-gray-100"><TabsTrigger value="colorido" className="data-[state=active]:bg-white data-[state=active]:text-blue-600">Colorido (Digital)</TabsTrigger><TabsTrigger value="pb" className="data-[state=active]:bg-white data-[state=active]:text-gray-900">P&B (Impressão)</TabsTrigger></TabsList>
            <Button onClick={baixar} className={isEPI ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}><Download className="h-4 w-4 mr-2" /> Baixar {modo === 'colorido' ? 'Colorido' : 'P&B'}</Button>
          </div>
          <TabsContent value="colorido" className="flex-1 m-0"><div className="border rounded-lg bg-white h-[60vh] overflow-auto shadow-sm"><iframe title="Preview" srcDoc={html} className="w-full h-full" sandbox="allow-same-origin" /></div></TabsContent>
          <TabsContent value="pb" className="flex-1 m-0"><div className="border rounded-lg bg-white h-[60vh] overflow-auto shadow-sm"><iframe title="Preview PB" srcDoc={html} className="w-full h-full" sandbox="allow-same-origin" /></div></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
