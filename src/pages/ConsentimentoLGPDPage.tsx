import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { TermoLGPD } from '@/types/database'

const COLUNAS_TERMO_LGPD = 'id, versao, titulo, conteudo, finalidades, ativo, created_at'

interface ConsentimentoLGPDPageProps {
  onConsentimentoAceito: () => void
}

export function ConsentimentoLGPDPage({ onConsentimentoAceito }: ConsentimentoLGPDPageProps) {
  const [termo, setTermo] = useState<TermoLGPD | null>(null)
  const [aceito, setAceito] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregarTermo() {
      const { data, error } = await supabase
        .from('termos_lgpd')
        .select(COLUNAS_TERMO_LGPD)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        toast.error('Erro ao carregar termos de privacidade: ' + error.message)
      } else {
        setTermo(data as TermoLGPD)
      }
      setLoading(false)
    }
    carregarTermo()
  }, [])

  const handleAceitar = async () => {
    if (!termo || !aceito) return

    setSalvando(true)
    // RPC server-side: valida a versão do termo ativo, grava o consentimento
    // e registra a prova imutável (consentimentos_lgpd) na mesma transação.
    const { error } = await supabase.rpc('registrar_consentimento_lgpd', {
      p_versao: termo.versao,
      p_finalidades: termo.finalidades,
    })

    if (error) {
      toast.error('Erro ao registrar consentimento: ' + error.message)
    } else {
      toast.success('Consentimento registrado com sucesso')
      onConsentimentoAceito()
    }
    setSalvando(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
      </div>
    )
  }

  if (!termo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Termos de privacidade indisponíveis</CardTitle>
            <CardDescription>
              Não foi possível carregar os termos de consentimento. Entre em contato com o administrador.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <div>
              <CardTitle>{termo.titulo}</CardTitle>
              <CardDescription>Versão {termo.versao}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto py-6">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700">
            {termo.conteudo}
          </div>

          <div className="mt-6 p-4 bg-slate-100 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Finalidades do tratamento:</h4>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
              {termo.finalidades.map((finalidade) => (
                <li key={finalidade}>{finalidade}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex items-start gap-3">
            <Checkbox
              id="aceite"
              checked={aceito}
              onCheckedChange={(checked) => setAceito(checked === true)}
            />
            <label htmlFor="aceite" className="text-sm text-slate-700 leading-relaxed cursor-pointer">
              Li e concordo com o Termo de Consentimento para Tratamento de Dados Pessoais acima.
            </label>
          </div>

          <Button
            className="w-full mt-6"
            disabled={!aceito || salvando}
            onClick={handleAceitar}
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              'Aceito e quero continuar'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
