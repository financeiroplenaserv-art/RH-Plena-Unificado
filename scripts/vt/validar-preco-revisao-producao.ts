import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import type { Database } from '../../src/types/database'
import type { FatosCartaoVT, ItinerarioVT } from '../../src/lib/vt/contratosTarifarios'
import type { VtTrajetoDecisao } from '../../src/types/vt'

const DECISAO_ID = 'c4b4370e-42de-4a17-8657-f6cf3bd7058e'
const APLICAR = process.argv.includes('--aplicar')
const SAIDA = 'dados-locais/validacao_preco_revisao_173'

function carregarEnv(caminho: string) {
  for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')

const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!,
  { auth: { persistSession: false } },
)

async function main() {
  Object.assign(import.meta, {
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    },
  })
  const [
    { cotarCatraca },
    { REGRAS_OFICIAIS_VT },
    { RepositorioItinerarioSupabase },
    { resolverCustoDiarioNaData },
    { decisaoDeLinha },
    { hojeBrasil },
  ] = await Promise.all([
    import('../../src/lib/vt/cotarCatraca'),
    import('../../src/lib/vt/regrasOficiais'),
    import('../../src/lib/vt/repositorioItinerarioSupabase'),
    import('../../src/lib/vt/temporalidade'),
    import('../../src/lib/vt/adaptadoresSql'),
    import('../../src/lib/utils'),
  ])

  const { data: decisao, error: erroDecisao } = await supabase
    .from('vt_trajeto_decisoes').select('*').eq('id', DECISAO_ID).single()
  if (erroDecisao) throw erroDecisao
  const { data: itinerario, error: erroItinerario } = await supabase
    .from('vt_itinerarios').select('*').eq('id', decisao.itinerario_id).single()
  if (erroItinerario) throw erroItinerario
  const { data: colaborador, error: erroColaborador } = await supabase
    .from('colaboradores')
    .select('id, nome_completo, vt_bu_ativado, vt_bu_situacao, vt_bu_consultado_em')
    .eq('id', decisao.colaborador_id)
    .single()
  if (erroColaborador) throw erroColaborador

  const ativado = colaborador.vt_bu_ativado === true
  const suspenso = colaborador.vt_bu_ativado === false
  const cartao: FatosCartaoVT = {
    personalizacao: 'desconhecida',
    vinculadoCpf: colaborador.vt_bu_ativado == null ? null : true,
    bui: ativado ? 'ativo' : suspenso ? 'suspenso' : 'nao_consultado',
    bun: ativado ? 'ativo' : 'nao_consultado',
    jae: 'nao_informado',
    situacaoConsultadaEm: colaborador.vt_bu_consultado_em,
  }
  const cotacao = cotarCatraca(itinerario.itinerario as ItinerarioVT, cartao, REGRAS_OFICIAIS_VT, hojeBrasil())
  const custoDiarioCentavos = cotacao.totalEstimadoCentavos == null ? null : cotacao.totalEstimadoCentavos * 2
  console.log(JSON.stringify({
    simulacao: !APLICAR,
    colaborador: colaborador.nome_completo,
    decisaoId: decisao.id,
    statusAntes: decisao.status,
    precoAntes: decisao.custo_diario_centavos,
    conducoes: (itinerario.itinerario as ItinerarioVT).pernas.map((perna) => perna.linha),
    cotacaoStatus: cotacao.status,
    custoDiarioCentavos,
    pendencias: cotacao.pendencias,
  }, null, 2))

  if (!APLICAR) {
    console.log('DRY-RUN — nada foi gravado. Use --aplicar para confirmar esta única revisão.')
    return
  }
  if (cotacao.status !== 'confirmavel' || custoDiarioCentavos == null) {
    throw new Error('A cotação não é confirmável; nenhuma escrita foi feita.')
  }
  if (!itinerario.created_by) throw new Error('A evidência não tem o operador que fez a revisão.')

  fs.mkdirSync(SAIDA, { recursive: true })
  const backup = `${SAIDA}/backup_${Date.now()}.json`
  fs.writeFileSync(backup, JSON.stringify({ decisao, itinerario, colaborador }, null, 2))

  const repositorio = new RepositorioItinerarioSupabase(supabase)
  const salvo = await repositorio.salvarEscolha({
    decisaoId: decisao.id,
    colaboradorId: decisao.colaborador_id,
    departamentoId: decisao.departamento_id,
    usuarioId: itinerario.created_by,
    alternativa: {
      id: itinerario.alternativa_id,
      numero: Number(itinerario.alternativa_id.replace(/\D/g, '')) || 1,
      distanciaMetros: itinerario.distancia_metros,
      duracaoSegundos: itinerario.duracao_segundos,
      itinerario: itinerario.itinerario as ItinerarioVT,
      avisos: [],
    },
    cotacaoId: cotacao.alternativaEscolhidaId,
    cotacaoStatus: cotacao.status,
    custoDiarioCentavos,
  })
  await repositorio.confirmarDecisaoAberta(decisao.id, itinerario.created_by, new Date().toISOString())

  const { data: final, error: erroFinal } = await supabase
    .from('vt_trajeto_decisoes').select('*').eq('id', decisao.id).single()
  if (erroFinal) throw erroFinal
  const resolucao = resolverCustoDiarioNaData({
    colaboradorId: final.colaborador_id,
    departamentoId: final.departamento_id,
    dataServico: hojeBrasil(),
    decisoes: [decisaoDeLinha(final as VtTrajetoDecisao)],
    componentes: [],
    versoesPreco: [],
  })
  const resultado = {
    backup,
    repetido: salvo.repetido,
    statusDepois: final.status,
    precoGravado: final.custo_diario_centavos,
    precoResolvidoNaCarga: resolucao.totalCentavos,
    componentesUsadosPelaCarga: resolucao.componentes.length,
    pendenciasDaCarga: resolucao.pendencias,
  }
  console.log(JSON.stringify(resultado, null, 2))
  if (final.status !== 'confirmada' || final.custo_diario_centavos !== custoDiarioCentavos || resolucao.totalCentavos !== custoDiarioCentavos) {
    throw new Error('A confirmação não produziu o mesmo preço na carga.')
  }
}

main().catch((erro) => {
  console.error('FALHOU:', erro?.message ?? erro)
  process.exit(1)
})
