import { useEffect, useRef, useState } from 'react'
import { ImagePlus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { CrachaPreview } from '@/components/ceu/CrachaPreview'
import { reduzirImagem } from '@/lib/ceu/crachasImagem'
import { salvarConfigCracha } from '@/lib/ceu/crachasDados'
import {
  FUNDO_CRACHA_PADRAO,
  normalizarFundoCracha,
  type ConfigCracha,
  type FundoCracha,
  type ModoCracha,
  type TipoFundoCracha,
} from '@/lib/ceu/crachas'

interface CrachaAparenciaCardProps {
  empresas: { id: string; nome: string }[]
  config: ConfigCracha
  onChange: (config: ConfigCracha) => void
  modo?: ModoCracha
}

const ROTULO_TIPO: Record<TipoFundoCracha, string> = {
  degrade: 'Degradê (padrão)',
  solido: 'Cor sólida',
  imagem: 'Imagem de fundo',
}

/**
 * Aparência dos crachás por empresa (configuracoes.cracha_config): logo e
 * fundo (degradê, cor sólida ou imagem) + cor do texto, com pré-visualização
 * ao vivo. Sem configuração → degradê azul padrão. Só editores devem ver este cartão.
 */
export function CrachaAparenciaCard({ empresas, config, onChange, modo = 'normal' }: CrachaAparenciaCardProps) {
  const inputLogoRef = useRef<HTMLInputElement>(null)
  const inputFundoRef = useRef<HTMLInputElement>(null)
  const [empresaId, setEmpresaId] = useState<string>(empresas[0]?.id ?? '')
  const [rascunho, setRascunho] = useState<FundoCracha>(FUNDO_CRACHA_PADRAO)
  const [salvando, setSalvando] = useState(false)

  // Seleciona a primeira empresa quando a lista chega
  useEffect(() => {
    if (!empresaId && empresas.length > 0) setEmpresaId(empresas[0].id)
  }, [empresas, empresaId])

  // Carrega o fundo salvo ao trocar de empresa
  useEffect(() => {
    setRascunho(normalizarFundoCracha(config.fundos[empresaId] ?? FUNDO_CRACHA_PADRAO))
    // só ao trocar de empresa: não sobrescrever a edição em andamento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  const logo = empresaId ? config.logos[empresaId] : undefined
  const alterar = (parcial: Partial<FundoCracha>) => setRascunho((r) => ({ ...r, ...parcial }))

  const gravar = async (proxima: ConfigCracha, mensagem: string) => {
    setSalvando(true)
    try {
      await salvarConfigCracha(proxima)
      onChange(proxima)
      toast.success(mensagem)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const escolherLogo = async (arquivo: File | undefined) => {
    if (!arquivo || !empresaId) return
    try {
      const png = await reduzirImagem(arquivo, true)
      await gravar({ ...config, logos: { ...config.logos, [empresaId]: png } }, 'Logo salvo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui processar o logo')
    }
  }

  const removerLogo = () => {
    const logos = { ...config.logos }
    delete logos[empresaId]
    void gravar({ ...config, logos }, 'Logo removido — volta ao desenho padrão')
  }

  const escolherImagemFundo = async (arquivo: File | undefined) => {
    if (!arquivo) return
    try {
      const jpg = await reduzirImagem(arquivo, false)
      alterar({ tipo: 'imagem', imagem: jpg })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui processar a imagem')
    }
  }

  const salvarFundo = () =>
    gravar(
      { ...config, fundos: { ...config.fundos, [empresaId]: normalizarFundoCracha(rascunho) } },
      'Aparência salva para esta empresa'
    )

  const restaurarPadrao = () => {
    setRascunho(FUNDO_CRACHA_PADRAO)
    const fundos = { ...config.fundos }
    delete fundos[empresaId]
    void gravar({ ...config, fundos }, 'Voltou ao fundo padrão')
  }

  const fundoPrevia = normalizarFundoCracha(rascunho)

  return (
    <ModuleCard
      title="Aparência dos crachás por empresa"
      description="Logo, fundo e cor do texto. Sem configuração, o crachá usa o degradê azul e o desenho padrão. O modo teste sem cor ignora o fundo."
    >
      {empresas.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhuma empresa cadastrada.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div className="space-y-5">
            <div className="max-w-sm space-y-1.5">
              <Label className="text-[12px]">Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <section className="space-y-2">
              <h3 className="text-[13px] font-semibold">Logo</h3>
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void escolherLogo(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded border border-dashed border-border bg-muted/40">
                  {logo ? (
                    <img src={logo} alt="Logo da empresa" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">padrão</span>
                  )}
                </div>
                <ModuleButton variant="outline" size="sm" disabled={salvando} onClick={() => inputLogoRef.current?.click()}>
                  <ImagePlus className="size-4" />
                  {logo ? 'Trocar logo' : 'Enviar logo'}
                </ModuleButton>
                {logo && (
                  <ModuleButton variant="ghost" size="sm" disabled={salvando} onClick={removerLogo}>
                    <Trash2 className="size-4" />
                    Remover
                  </ModuleButton>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">PNG com fundo transparente funciona melhor (até ~30 × 26 mm no cartão).</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold">Fundo</h3>
              <div className="max-w-xs space-y-1.5">
                <Label className="text-[12px]">Tipo de fundo</Label>
                <Select value={rascunho.tipo} onValueChange={(v) => alterar({ tipo: v as TipoFundoCracha })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROTULO_TIPO) as TipoFundoCracha[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {ROTULO_TIPO[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {rascunho.tipo === 'degrade' && (
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Cor do topo</Label>
                    <input
                      type="color"
                      aria-label="Cor do topo do degradê"
                      value={fundoPrevia.corTopo}
                      onChange={(e) => alterar({ corTopo: e.target.value })}
                      className="h-9 w-14 cursor-pointer rounded border border-input bg-white p-1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Chega ao branco em (% da altura)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={rascunho.ponto}
                      onChange={(e) => alterar({ ponto: Number(e.target.value) })}
                      className="w-24"
                    />
                  </div>
                </div>
              )}

              {rascunho.tipo === 'solido' && (
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Cor do fundo</Label>
                  <input
                    type="color"
                    aria-label="Cor sólida do fundo"
                    value={fundoPrevia.cor}
                    onChange={(e) => alterar({ cor: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded border border-input bg-white p-1"
                  />
                </div>
              )}

              {rascunho.tipo === 'imagem' && (
                <div className="space-y-1.5">
                  <input
                    ref={inputFundoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void escolherImagemFundo(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  <ModuleButton variant="outline" size="sm" onClick={() => inputFundoRef.current?.click()}>
                    <ImagePlus className="size-4" />
                    {rascunho.imagem ? 'Trocar imagem' : 'Enviar imagem'}
                  </ModuleButton>
                  <p className="text-[11px] text-muted-foreground">
                    A arte cobre todo o cartão (54 × 85,6 mm) e é recortada nas bordas, sem deformar. Use proporção parecida.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[12px]">Cor do texto (nome e função)</Label>
                <input
                  type="color"
                  aria-label="Cor do texto do nome e da função"
                  value={fundoPrevia.corTexto}
                  onChange={(e) => alterar({ corTexto: e.target.value })}
                  className="h-9 w-14 cursor-pointer rounded border border-input bg-white p-1"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <ModuleButton size="sm" disabled={salvando} onClick={() => void salvarFundo()}>
                  <Save className="size-4" />
                  Salvar aparência
                </ModuleButton>
                <ModuleButton variant="outline" size="sm" disabled={salvando} onClick={restaurarPadrao}>
                  <RotateCcw className="size-4" />
                  Restaurar padrão
                </ModuleButton>
              </div>
            </section>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">Pré-visualização</p>
            <CrachaPreview
              modo={modo}
              zoom={0.9}
              dados={{
                nome: 'Maria Silva',
                cargo: 'Porteira',
                logoDataUrl: logo,
                fundo: fundoPrevia,
              }}
            />
          </div>
        </div>
      )}
    </ModuleCard>
  )
}
