import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRightLeft, Loader2, Save } from 'lucide-react'
import { MACRO_GRUPOS } from '@/lib/ocorrencias/tiposOcorrencia'
import { RhShell } from './RhShell'
import { useOcorrenciaForm } from './useOcorrenciaForm'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { FormHeader } from '@/components/ocorrencias/ocorrencia-form/FormHeader'
import { ColaboradorSection } from '@/components/ocorrencias/ocorrencia-form/ColaboradorSection'
import { MacroGrupoSection } from '@/components/ocorrencias/ocorrencia-form/MacroGrupoSection'
import { TituloSection } from '@/components/ocorrencias/ocorrencia-form/TituloSection'
import { TipoOcorrenciaSection } from '@/components/ocorrencias/ocorrencia-form/TipoOcorrenciaSection'
import { DadosOcorridoSection } from '@/components/ocorrencias/ocorrencia-form/DadosOcorridoSection'
import { DescricaoSection } from '@/components/ocorrencias/ocorrencia-form/DescricaoSection'
import { DefesaMedidasSection } from '@/components/ocorrencias/ocorrencia-form/DefesaMedidasSection'
import { TestemunhasSection } from '@/components/ocorrencias/ocorrencia-form/TestemunhasSection'

export function OcorrenciaFormPage() {
  const navigate = useNavigate()
  const {
    isEdicao,
    form,
    colabSelecionado,
    empresaSelecionada,
    loading,
    loadingOcorrencia,
    tiposFiltrados,
    postoAtualTexto,
    nomeCurtoDestino,
    postoDestinoId,
    confirmacaoTransferencia,
    setPostoDestinoId,
    setConfirmacaoTransferencia,
    handleColaboradorChange,
    handleMacroGrupoChange,
    handleTipoPenalidadeChange,
    handleGravidadeChange,
    handleChange,
    handleSubmit,
    confirmarTransferencia,
    salvarSemAtualizarCadastro,
  } = useOcorrenciaForm()

  return (
    <RhShell>
      <FormHeader isEdicao={isEdicao} />

      {loadingOcorrencia ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <ColaboradorSection
            colaborador={colabSelecionado}
            onColaboradorChange={handleColaboradorChange}
            empresa={empresaSelecionada}
            colaboradorId={form.colaborador_id}
          />
          <MacroGrupoSection
            value={form.macro_grupo}
            onChange={handleMacroGrupoChange}
            macroGrupos={MACRO_GRUPOS}
          />
          <TipoOcorrenciaSection
            form={form}
            tiposFiltrados={tiposFiltrados}
            onTipoChange={handleTipoPenalidadeChange}
            isEdicao={isEdicao}
            onGravidadeChange={handleGravidadeChange}
            postoAtualTexto={postoAtualTexto}
            postoDestinoId={postoDestinoId}
            onPostoDestinoChange={setPostoDestinoId}
          />
          <TituloSection value={form.titulo} onChange={handleChange} />
          <DadosOcorridoSection
            form={form}
            onChange={handleChange}
          />
          <DescricaoSection
            form={form}
            onChange={handleChange}
            empresa={empresaSelecionada}
          />
          <DefesaMedidasSection
            form={form}
            onChange={handleChange}
          />
          <TestemunhasSection form={form} onChange={handleChange} />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/rh/ocorrencias')}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="gap-1.5 text-xs h-8 bg-amber-600 hover:bg-amber-700"
            >
              <Save className="h-3.5 w-3.5" /> {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmacaoTransferencia}
        onOpenChange={setConfirmacaoTransferencia}
        icon={<ArrowRightLeft className="h-5 w-5" />}
        title="Confirmar transferência"
        description={
          <span className="block space-y-2">
            <span className="block">O cadastro de</span>
            <strong className="block break-words text-slate-800">
              {colabSelecionado?.nome_completo}
            </strong>
            <span className="block">
              passará a apontar para o posto{' '}
              <strong className="break-words text-slate-800">{nomeCurtoDestino}</strong>.
            </span>
            <span className="block">
              Avise o DP para atualizar a Alterdata no mesmo dia — caso contrário, o sync diário
              pode voltar o posto antigo até a Alterdata ser atualizada.
            </span>
          </span>
        }
        confirmLabel="Salvar e atualizar cadastro"
        secondaryLabel="Salvar sem atualizar"
        onConfirm={confirmarTransferencia}
        onSecondary={salvarSemAtualizarCadastro}
      />
    </RhShell>
  )
}
