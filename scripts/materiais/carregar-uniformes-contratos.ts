// Carga inicial do kit de uniforme/EPI por contrato (mat_contrato_ceu_itens,
// migration 129) — peças que o líder vê no link /pedido/:token.
//
// Fontes:
//  (a) os Google Forms atuais de cada contrato (links na aba 1 de
//      docs/Pedido de material/pedido_materiais_todas_abas.md; estrutura lida do
//      FB_PUBLIC_LOAD_DATA_ da página pública). As seções de uniforme listam as
//      peças POR FUNÇÃO ("CAMISA ...: UTILIZADA POR PORTEIRO / VIGIA").
//  (b) histórico de entregas do CEU dos últimos 12 meses para a equipe do
//      contrato (colaboradores ATIVOS do departamento, pela mesma regra de
//      idsColaboradoresDoDepartamento — sem ILIKE). Os 4 contratos do Telex
//      dividem o departamento e recebem o mesmo histórico (exceção aceita pela
//      gestão em 14/10/2026).
//
// Uso:
//   npx tsx --tsconfig tsconfig.scripts.json scripts/materiais/carregar-uniformes-contratos.ts [opções]
//   (sem opções)  DRY-RUN: lê produção (SÓ SELECT) e os forms, grava o relatório e o SQL em
//                 dados-locais/ e NÃO escreve nada no banco.
//   --aplicar     grava (exige a migration 129 aplicada; backup de mat_contrato_ceu_itens e do item
//                 antes). Ordem: (1) troca das linhas da camisa 331 pela 312 no kit (mescla funcoes se o
//                 contrato já tem a 312); (2) UPSERT por (contrato_id, item_id): insere o que falta e
//                 ATUALIZA funcoes/origem das linhas existentes (rotulo/ordem/ativo da tela ficam).
//                 Linhas que deixaram de ser propostas NÃO são apagadas (exceto as da 331) — o
//                 relatório as lista. O item 331 NÃO é inativado: segue ativo no CEU (exceção de
//                 limpeza pesada, entregue só pela Beth); só não entra no kit do líder.
//   --offline     reaproveita os JSONs de produção e os HTMLs dos forms já baixados.
//   --sem-ceu     só os forms (sem o complemento do histórico do CEU).
//
// NUNCA versionar dados-locais/ nem docs/Pedido de material/ (dados pessoais).

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import type { DepartamentoFuzzy } from '../../src/lib/departamentos'
import {
  agruparItensEmPecas,
  chavePeca,
  funcaoDoCargo,
  funcoesDoTexto,
  idsEquipeDoContrato,
  nomeAmigavelPeca,
  opcoesDoGrupo,
  rotuloFuncoes,
  separarTamanhoDoNome,
  type FuncaoPeca,
  type ItemCeuCadastro,
} from '../../src/lib/materiais/pecasCeu'
import { normalizarBusca } from '../../src/lib/materiais/buscaItens'
import { baixarForm, extrairLinksForms, pecasDoForm, perguntasDoHtml } from './lib/formsPedido'

const APLICAR = process.argv.includes('--aplicar')
const OFFLINE = process.argv.includes('--offline')
const SEM_CEU = process.argv.includes('--sem-ceu')
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const ARQ_MD = 'docs/Pedido de material/pedido_materiais_todas_abas.md'
const DIR_PROD = 'dados-locais/materiais_prod'
const DIR_FORMS = 'dados-locais/materiais_forms'
const SUFIXO = APLICAR ? '_APLICADO' : '_dryrun'
const RELATORIO = `dados-locais/relatorio_uniformes_contratos_${HOJE}${SUFIXO}.md`
const ARQ_SQL = `dados-locais/carga_uniformes_contratos_${HOJE}.sql`

// ---------- regras de correspondência form → peça do CEU ----------
// A peça é resolvida pelo ID de um item do grupo (itemId — qualquer tamanho serve), NÃO pelo
// nome: renomear o item no CEU não quebra a carga. `base` é só rótulo legível (e chave de
// EPI_SEM_FUNCAO). Decisões de 15/10/2026: camisa azul ASG = 312 (a 331 'azul clara' é modelo
// antigo, sem entregas); camisa bege = 314 (ex-'POLO - ENCARREGADO', renomeado pela gestão).
// Chave = texto da pergunta do form (sem acento, maiúsculas); valor = nome base
// da peça no CEU (itens). Decididas olhando o histórico de entregas de
// 12 meses por cargo (ex.: a "calça azul escura de elástico" das ASGs é a
// CALÇA EM OXFORD AZUL MARINHO — 167 entregas a ASGs) e as conversões já
// usadas na importação de entregas (máscara → respirador com válvula,
// óculos → lente incolor). Peça sem regra fica no relatório para a gestão.
const REGRAS_FORM: { padrao: RegExp; itemId: string; base: string; tipo: 'uniforme' | 'epi' }[] = [
  { padrao: /^CAMISA COR AZUL CLARA TIPO POLO/, itemId: 'febd2103-bab3-46cf-840c-99767229eeff', base: 'CAMISA MALHA POLO - AZUL - ASG', tipo: 'uniforme' },
  { padrao: /^CALCA COR AZUL ESCURA DE ELASTICO/, itemId: '11198149-cf96-4da6-a09e-a237c3065ea5', base: 'CALÇA EM OXFORD AZUL MARINHO', tipo: 'uniforme' },
  { padrao: /^CAMISA SOCIAL COR BRANCA/, itemId: '54a60236-6fe7-4711-b138-d326e5a92a82', base: 'CAMISA SOCIAL EM TECIDO BRANCA COM LOGO BORDADO', tipo: 'uniforme' },
  { padrao: /^CALCA SOCIAL/, itemId: 'b24e610f-bdda-4275-aefe-c2cb52cf1127', base: 'CALÇA SOCIAL', tipo: 'uniforme' },
  { padrao: /^BLAZER/, itemId: '4dee8098-4b41-48b5-a957-c505a89b9bcf', base: 'BLAZER', tipo: 'uniforme' },
  { padrao: /^GRAVATA/, itemId: 'b0ef1fcf-3357-4910-a6a1-82b06f1d789a', base: 'GRAVATA', tipo: 'uniforme' },
  { padrao: /^CAMISA COR BEGE TIPO POLO/, itemId: '6bf4696d-1fbd-41b9-b9b6-8294826df7ca', base: 'CAMISA MALHA POLO - BEGE', tipo: 'uniforme' },
  { padrao: /^CAMISA POLO COR AZUL COM LOGO PLENA/, itemId: 'dfda4f98-6765-4289-bc57-0f86a0b1feea', base: 'CAMISA POLO AZUL TECH', tipo: 'uniforme' },
  { padrao: /^JALECO MANGA LONGA AZUL COM LOGO PLENA TECH/, itemId: '5084c51a-1f2d-4c1b-bab2-93ced2028a49', base: 'JALECO AZUL TECH', tipo: 'epi' },
  { padrao: /^BLUSA BRANCA FEMININA/, itemId: '152ffed0-da33-4fe6-857d-d5f6f92a69f4', base: 'BLUSA RECEPÇÃO FEMININA', tipo: 'uniforme' },
  { padrao: /^LUVA LATEX AMARELA/, itemId: '32960193-784f-43a2-81aa-ce31a631edb2', base: 'LUVA LÁTEX', tipo: 'epi' },
  { padrao: /^LUVA NITRILICA/, itemId: '5618dfe6-6943-4735-a5f0-ade2810cd1d1', base: 'LUVA NITRÍLICA', tipo: 'epi' },
  { padrao: /^LUVA PVC/, itemId: '18b0c768-9a78-48da-9f7b-5643967c2f78', base: 'LUVA PVC', tipo: 'epi' },
  { padrao: /^MASCARA DESCARTAVEL/, itemId: '81b8a12a-dfce-4634-add1-9e656ca2e62e', base: 'MÁSCARA RESPIRADOR COM VÁLVULA', tipo: 'epi' },
  { padrao: /^OCULOS DE PROTECAO/, itemId: '5541f746-ec82-4985-8254-1f48f78d1c37', base: 'ÓCULOS LENTE INCOLOR', tipo: 'epi' },
  { padrao: /^AVENTAL DE PVC/, itemId: '31959b47-1747-4b3f-b4ef-9b3ec1ec7980', base: 'AVENTAL', tipo: 'epi' },
  { padrao: /^BOTA DE PVC CANO CURTO/, itemId: '5bb15502-2866-4e3e-b60c-a7f441c0ec7d', base: 'BOTA PVC CANO CURTO', tipo: 'epi' },
  { padrao: /^BOTINA/, itemId: '72f4c14c-8785-401f-82ff-83d14a3a87e8', base: 'BOTINA COM ELÁSTICO', tipo: 'epi' },
  { padrao: /^ABAFADOR/, itemId: '25bcce5b-45de-467d-851d-46189645a92f', base: 'ABAFADOR DE RUÍDOS', tipo: 'epi' },
  { padrao: /^CAPACETE/, itemId: 'c4418ba9-51c6-431a-8d0b-7620844d9ffb', base: 'CAPACETE', tipo: 'epi' },
  { padrao: /^LUVA PIGMENTADA/, itemId: '39cb632e-43ea-4320-ab60-8e741bfaad91', base: 'LUVA DE MALHA PIGMENTADA', tipo: 'epi' },
  { padrao: /^PROTETOR AURICULAR/, itemId: 'd5b3a455-fe8c-4cc0-8ff8-14d68a577d73', base: 'PROTETOR AURICULAR', tipo: 'epi' },
]

// EPI de limpeza no form não diz a função: regra padrão = equipe de limpeza
// e manutenção (porteiro não vê luva látex nem bota PVC). Conferir no relatório.
const FUNCOES_EPI_LIMPEZA: FuncaoPeca[] = ['asg', 'encarregado', 'manutencao', 'jardinagem']
const EPI_SEM_FUNCAO = new Set(['PROTETOR AURICULAR', 'ABAFADOR DE RUÍDOS', 'CAPACETE', 'JALECO AZUL TECH'])

// ---------- produção (SÓ SELECT) ----------
function consultar<T>(nome: string, sql: string): T[] {
  const arquivo = path.join(DIR_PROD, `${nome}.json`)
  if (!OFFLINE) {
    fs.mkdirSync(DIR_PROD, { recursive: true })
    execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-sql-arquivo.ps1', '-Saida', arquivo, '-Query', sql], { stdio: 'pipe' })
  }
  return JSON.parse(fs.readFileSync(arquivo, 'utf-8')) as T[]
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const q = (v: string | null) => (v === null ? 'null' : `'${v.replace(/'/g, "''")}'`)

interface Contrato {
  id: string
  nome: string
  departamento_id: string
  ativo: boolean
  departamentos_equipe_extra?: string[]
}

// Telex × DuoConnect (decisão da gestão, 14/10/2026): enquanto a migration
// 129 não for aplicada, a coluna departamentos_equipe_extra não existe — a
// carga usa o mesmo valor que a 129 grava nos 4 contratos TELEX.
const ITEM_331 = '0e528c08-54ff-45f4-a1af-12fc54d4b106' // CAMISA MALHA POLO AZUL CLARA - ASG (antiga)
const ITEM_312 = 'febd2103-bab3-46cf-840c-99767229eeff' // CAMISA MALHA POLO - AZUL - ASG (atual)
const ITEM_314 = '6bf4696d-1fbd-41b9-b9b6-8294826df7ca' // CAMISA MALHA POLO - BEGE (ex-"... - ENCARREGADO")
const DUOCONNECT = '3c68d824-54ad-46f5-be01-3e94b687974e'
const extrasDoContrato = (c: Contrato): string[] =>
  Array.isArray(c.departamentos_equipe_extra) ? c.departamentos_equipe_extra : /^TELEX /.test(c.nome) ? [DUOCONNECT] : []
interface Colab {
  id: string
  cargo: string | null
  departamento_id: string | null
  departamento: string | null
  empresa_id: string | null
}
interface Proposta {
  chave: string
  item_id: string
  nome: string
  tipo: 'uniforme' | 'epi'
  funcoes: FuncaoPeca[]
  origem: 'form' | 'ceu' | 'form_ceu'
  ordem: number
  detalhe: string
}

function main() {
  // ---------- produção ----------
  const contratos = consultar<Contrato>('uni_contratos', 'select * from public.mat_contratos order by nome')
  const deps = consultar<DepartamentoFuzzy>('uni_departamentos', 'select id, nome, nome_curto, empresa_id, status from public.departamentos')
  const colabs = consultar<Colab>(
    'uni_colaboradores',
    "select id, cargo, departamento_id, departamento, empresa_id from public.colaboradores where status = 'Ativo'"
  )
  const itensBrutos = consultar<{ id: string; nome: string; tipo: string; situacao: string | null }>(
    'uni_itens',
    "select id, nome, tipo, situacao from public.itens where tipo in ('Uniforme','EPI') order by nome"
  )
  const entregas = SEM_CEU
    ? []
    : consultar<{ colaborador_id: string; item_id: string; data_entrega: string; observacao: string | null }>(
        'uni_entregas_12m',
        "select e.colaborador_id, e.item_id, e.data_entrega, e.observacao from public.entregas e join public.itens i on i.id = e.item_id where i.tipo in ('Uniforme','EPI') and e.data_entrega >= (current_date - interval '12 months')"
      )

  const existentes = consultar<{ contrato_id: string; item_id: string; funcoes: string[]; origem: string }>(
    'uni_existentes',
    'select contrato_id, item_id, funcoes, origem from public.mat_contrato_ceu_itens'
  )

  const itens: ItemCeuCadastro[] = itensBrutos.map((i) => ({
    id: i.id,
    nome: i.nome,
    tipo: i.tipo === 'EPI' ? 'epi' : 'uniforme',
    ativo: !i.situacao || i.situacao.toUpperCase() === 'A',
  }))
  const grupos = agruparItensEmPecas(itens)
  const grupoDoItem = new Map<string, string>()
  for (const i of itens) grupoDoItem.set(i.id, chavePeca(separarTamanhoDoNome(i.nome).base, i.tipo))
  const grupoAtivo = (chave: string) => {
    const g = grupos.get(chave)
    return g && opcoesDoGrupo(g).length > 0 ? g : null
  }
  /** Peça do CEU pelo ID de um item do grupo (renomear item não quebra). */
  const grupoPorItem = (itemId: string) => {
    const chave = grupoDoItem.get(itemId)
    return chave ? grupoAtivo(chave) : null
  }
  const representante = (chave: string) => {
    const g = grupos.get(chave)!
    return (g.itens.find((i) => i.ativo) ?? g.itens[0]).id
  }

  // ---------- forms ----------
  const links = extrairLinksForms(ARQ_MD)
  const contratoPorNome = new Map(contratos.map((c) => [normalizarBusca(c.nome), c]))
  const acharContrato = (nome: string) => {
    const n = normalizarBusca(nome)
    return (
      contratoPorNome.get(n) ??
      contratos.find((c) => normalizarBusca(c.nome).startsWith(n) || n.startsWith(normalizarBusca(c.nome))) ??
      null
    )
  }
  const formsSemContrato: string[] = []
  const formsFalha: string[] = []
  const semRegra = new Map<string, Set<string>>()
  const propostas = new Map<string, Map<string, Proposta>>() // contrato → chave → proposta
  const formDoContrato = new Map<string, string>()

  for (const l of links) {
    const contrato = acharContrato(l.nomePlanilha)
    if (!contrato) {
      formsSemContrato.push(l.nomePlanilha)
      continue
    }
    const html = baixarForm(l.url, DIR_FORMS, OFFLINE)
    if (!html) {
      formsFalha.push(l.nomePlanilha)
      continue
    }
    formDoContrato.set(contrato.id, l.nomePlanilha)
    const mapa = propostas.get(contrato.id) ?? new Map<string, Proposta>()
    pecasDoForm(perguntasDoHtml(html).perguntas).forEach((p, ordem) => {
      const texto = semAcento(p.peca)
      const regra = REGRAS_FORM.find((r) => r.padrao.test(texto))
      const g = regra ? grupoPorItem(regra.itemId) : null
      if (!regra || !g) {
        const s = semRegra.get(p.titulo) ?? new Set<string>()
        s.add(contrato.nome)
        semRegra.set(p.titulo, s)
        return
      }
      let funcoes = funcoesDoTexto(p.usadaPor)
      if (funcoes.length === 0 && g.tipo === 'epi' && !EPI_SEM_FUNCAO.has(regra.base)) funcoes = FUNCOES_EPI_LIMPEZA
      const atual = mapa.get(g.chave)
      if (atual) {
        atual.funcoes = atual.funcoes.length === 0 || funcoes.length === 0 ? [] : [...new Set([...atual.funcoes, ...funcoes])]
        return
      }
      mapa.set(g.chave, {
        chave: g.chave,
        item_id: representante(g.chave),
        nome: nomeAmigavelPeca(g.base),
        tipo: g.tipo,
        funcoes,
        origem: 'form',
        ordem: (ordem + 1) * 10,
        detalhe: `form: "${p.peca}"${p.usadaPor ? ` — ${p.usadaPor}` : ''}`,
      })
    })
    propostas.set(contrato.id, mapa)
  }

  // ---------- histórico do CEU (12 meses) ----------
  const equipeDoContrato = new Map<string, Set<string>>()
  if (!SEM_CEU) {
    const cargoPor = new Map(colabs.map((c) => [c.id, c.cargo]))
    const entregasPor = new Map<string, { item_id: string; observacao?: string | null }[]>()
    for (const e of entregas) {
      const lista = entregasPor.get(e.colaborador_id) ?? []
      lista.push(e)
      entregasPor.set(e.colaborador_id, lista)
    }
    for (const c of contratos.filter((x) => x.ativo)) {
      const ids = idsEquipeDoContrato(deps, colabs, [c.departamento_id, ...extrasDoContrato(c)])
      equipeDoContrato.set(c.id, ids)
      const recebidas = new Map<string, Set<FuncaoPeca | null>>()
      for (const id of ids) {
        for (const e of entregasPor.get(id) ?? []) {
          const chave = grupoDoItem.get(e.item_id)
          if (!chave || !grupoAtivo(chave)) continue
          const s = recebidas.get(chave) ?? new Set<FuncaoPeca | null>()
          s.add(funcaoDoCargo(cargoPor.get(id)))
          recebidas.set(chave, s)
        }
      }
      const mapa = propostas.get(c.id) ?? new Map<string, Proposta>()
      for (const [chave, funcs] of recebidas) {
        const atual = mapa.get(chave)
        if (atual) {
          if (atual.origem === 'form') atual.origem = 'form_ceu'
          continue
        }
        const g = grupos.get(chave)!
        const funcoes = funcs.has(null) ? [] : ([...funcs] as FuncaoPeca[])
        mapa.set(chave, {
          chave,
          item_id: representante(chave),
          nome: nomeAmigavelPeca(g.base),
          tipo: g.tipo,
          funcoes,
          origem: 'ceu',
          ordem: 500 + mapa.size,
          detalhe: `CEU: entregue em 12 meses a ${funcoes.length ? rotuloFuncoes(funcoes) : 'função variada/indefinida'}`,
        })
      }
      propostas.set(c.id, mapa)
    }
  }

  // ---------- overrides POR CONTRATO (decisão da gestão, 15/10/2026) ----------
  // Explícitos e restritos a estes contratos — não são regra geral. Cada um UNE as
  // funções ao que a carga já propôs (ou cria a peça se faltar).
  //  - CALLE MAGGIORE e CBO MACAÉ: a manutenção recebe a camisa azul de ASG (312) E a bege (314).
  //  - LA ROCHELLE e PARQUE DOS PRÍNCIPES: também recebem a bege (314); se o form/histórico não
  //    trouxer a peça, entra com 'encarregado' (sem outro indício).
  const OVERRIDES: { contrato: string; itemId: string; funcoes: FuncaoPeca[] }[] = [
    { contrato: 'CALLE MAGGIORE', itemId: ITEM_312, funcoes: ['asg', 'manutencao'] },
    { contrato: 'CALLE MAGGIORE', itemId: ITEM_314, funcoes: ['encarregado', 'manutencao'] },
    { contrato: 'CBO MACAÉ', itemId: ITEM_312, funcoes: ['asg', 'manutencao'] },
    { contrato: 'CBO MACAÉ', itemId: ITEM_314, funcoes: ['encarregado', 'manutencao'] },
    { contrato: 'LA ROCHELLE', itemId: ITEM_314, funcoes: ['encarregado'] },
    { contrato: 'PARQUE DOS PRÍNCIPES', itemId: ITEM_314, funcoes: ['encarregado'] },
  ]
  const logOverrides: string[] = []
  for (const o of OVERRIDES) {
    const c = contratos.find((x) => x.nome === o.contrato)
    if (!c) {
      logOverrides.push(`- ${o.contrato}: contrato NÃO encontrado — override ignorado`)
      continue
    }
    const chave = grupoDoItem.get(o.itemId)
    const g = chave ? grupoAtivo(chave) : null
    if (!chave || !g) {
      logOverrides.push(`- ${o.contrato}: item ${o.itemId} sem peça ativa — override ignorado`)
      continue
    }
    const mapa = propostas.get(c.id) ?? new Map<string, Proposta>()
    const atual = mapa.get(chave)
    if (atual) {
      const antes = atual.funcoes.join(', ') || 'todas'
      if (atual.funcoes.length > 0) atual.funcoes = [...new Set([...atual.funcoes, ...o.funcoes])]
      logOverrides.push(`- ${c.nome} · ${atual.nome}: funcoes [${antes}] → [${atual.funcoes.join(', ') || 'todas'}] (peça já proposta)`)
    } else {
      mapa.set(chave, {
        chave,
        item_id: representante(chave),
        nome: nomeAmigavelPeca(g.base),
        tipo: g.tipo,
        funcoes: o.funcoes,
        origem: 'ceu',
        ordem: 900 + mapa.size,
        detalhe: 'override por contrato (gestão, 15/10/2026)',
      })
      logOverrides.push(`- ${c.nome} · ${nomeAmigavelPeca(g.base)}: peça ADICIONADA com [${o.funcoes.join(', ')}]`)
    }
    propostas.set(c.id, mapa)
  }

  // ---------- relatório ----------
  const ativos = contratos.filter((c) => c.ativo)
  let totalPecas = 0
  let nForm = 0
  let nCeu = 0
  let nAmbos = 0
  const semNada: string[] = []
  const linhasRel: string[] = []
  const linhasSql: string[] = []
  for (const c of ativos) {
    const lista = [...(propostas.get(c.id)?.values() ?? [])].sort((a, b) =>
      a.tipo !== b.tipo ? (a.tipo === 'uniforme' ? -1 : 1) : a.ordem - b.ordem
    )
    if (lista.length === 0) {
      semNada.push(c.nome)
      continue
    }
    totalPecas += lista.length
    linhasRel.push(
      `\n### ${c.nome}\n\nForm: ${formDoContrato.get(c.id) ?? '— (sem form)'} · equipe ativa no departamento: ${equipeDoContrato.get(c.id)?.size ?? '—'}\n`
    )
    linhasRel.push('| Peça | Tipo | Para quem | Origem | Detalhe |', '|---|---|---|---|---|')
    for (const p of lista) {
      if (p.origem === 'form') nForm++
      else if (p.origem === 'ceu') nCeu++
      else nAmbos++
      linhasRel.push(
        `| ${p.nome} | ${p.tipo === 'epi' ? 'EPI' : 'Uniforme'} | ${p.funcoes.length ? rotuloFuncoes(p.funcoes) : 'todas'} | ${p.origem} | ${p.detalhe.replace(/\|/g, '/')} |`
      )
      linhasSql.push(
        `(${q(c.id)}, ${q(p.item_id)}, null, array[${p.funcoes.map((f) => q(f)).join(', ')}]::text[], ${p.ordem}, true, ${q(p.origem)})`
      )
    }
  }

  const resumo = [
    `# Carga do kit de uniforme/EPI por contrato — ${HOJE}${APLICAR ? ' (APLICADA)' : ' (dry-run)'}`,
    '',
    'Fonte: Google Forms de cada contrato + histórico de entregas do CEU (12 meses, equipe ativa do departamento).',
    'Tabela-alvo: mat_contrato_ceu_itens (migration 129). Cada linha = uma PEÇA (todos os tamanhos ativos entram no link).',
    '',
    `- Contratos de pedido ativos: ${ativos.length}`,
    `- Forms lidos: ${links.length - formsSemContrato.length - formsFalha.length} de ${links.length}`,
    `- Contratos com peças: ${ativos.length - semNada.length}`,
    `- Peças propostas: ${totalPecas} (só form: ${nForm} · form + CEU: ${nAmbos} · só CEU: ${nCeu})`,
    `- Contratos sem nada: ${semNada.length}${semNada.length ? ` — ${semNada.join(', ')}` : ''}`,
    formsSemContrato.length ? `- Forms sem contrato correspondente: ${formsSemContrato.join(', ')}` : '- Forms sem contrato correspondente: nenhum',
    formsFalha.length ? `- Forms que não abriram: ${formsFalha.join(', ')}` : '- Forms que não abriram: nenhum',
    '',
    '## Perguntas do form sem peça correspondente no CEU (decisão da gestão)',
    '',
    ...(semRegra.size
      ? [...semRegra.entries()].map(([t, s]) => `- "${t}" — ${[...s].join(', ')}`)
      : ['- nenhuma']),
    '',
    '## Regras usadas',
    '',
    '- Função da peça de uniforme: o texto "UTILIZADA POR ..." do form.',
    `- EPI de limpeza do form (sem função no texto): ${rotuloFuncoes(FUNCOES_EPI_LIMPEZA)} (porteiro não vê). Exceções sem função: ${[...EPI_SEM_FUNCAO].join(', ')}.`,
    '- Peça só do CEU: funções de quem recebeu nos últimos 12 meses (algum cargo não reconhecido = todas).',
    '- Telex: os 4 contratos de pedido usam a equipe CENTRO AUDITIVO TELEX + DUOCONNECT (departamentos_equipe_extra, migration 129) — o complemento do CEU é o mesmo nos 4 (decisões de 14/10/2026).',
    '- EPI de limpeza atribuído a ASG/Encarregado/Manutenção/Jardinagem: CONFIRMADO pela gestão em 14/10/2026.',
    '',
    '## Contratos → peças',
    ...linhasRel,
  ].join('\n')
  fs.mkdirSync('dados-locais', { recursive: true })
  fs.writeFileSync(RELATORIO, resumo)

  // ---------- plano contra o que já está gravado ----------
  // 1) camisa 331 → 312 (move a linha, ou mescla funcoes se o contrato já tem a 312)
  const chaveLinha = (c: string, i: string) => `${c}|${i}`
  const estado = new Map<string, { funcoes: string[]; origem: string }>()
  let trocas331 = 0
  let mescladas331 = 0
  for (const e of existentes) {
    if (e.item_id !== ITEM_331) estado.set(chaveLinha(e.contrato_id, e.item_id), { funcoes: e.funcoes ?? [], origem: e.origem })
  }
  for (const e of existentes.filter((x) => x.item_id === ITEM_331)) {
    const k = chaveLinha(e.contrato_id, ITEM_312)
    const alvo = estado.get(k)
    if (alvo) {
      alvo.funcoes = alvo.funcoes.length === 0 || (e.funcoes ?? []).length === 0 ? [] : [...new Set([...alvo.funcoes, ...e.funcoes])]
      mescladas331++
    } else {
      estado.set(k, { funcoes: e.funcoes ?? [], origem: e.origem })
      trocas331++
    }
  }
  const mesmasFuncoes = (a: string[], b: string[]) => [...a].sort().join(',') === [...b].sort().join(',')
  let inserts = 0
  let updates = 0
  const propostasChaves = new Set<string>()
  const updatesDetalhe: string[] = []
  for (const c of ativos) {
    for (const p of propostas.get(c.id)?.values() ?? []) {
      const k = chaveLinha(c.id, p.item_id)
      propostasChaves.add(k)
      const atual = estado.get(k)
      if (!atual) inserts++
      else if (!mesmasFuncoes(atual.funcoes, p.funcoes) || atual.origem !== p.origem) {
        updates++
        updatesDetalhe.push(
          `- ${c.nome} · ${p.nome}: funcoes [${atual.funcoes.join(', ') || 'todas'}] → [${p.funcoes.join(', ') || 'todas'}]${atual.origem !== p.origem ? `; origem ${atual.origem} → ${p.origem}` : ''}`
        )
      }
    }
  }
  const nomeContrato = new Map(contratos.map((c) => [c.id, c.nome]))
  const nomeItem = new Map(itensBrutos.map((i) => [i.id, i.nome]))
  const sobras = [...estado.keys()]
    .filter((k) => !propostasChaves.has(k))
    .map((k) => {
      const [cid, iid] = k.split('|')
      return `- ${nomeContrato.get(cid) ?? cid} · ${nomeItem.get(iid) ?? iid}`
    })
  const secaoPlano = [
    '',
    '## Plano do --aplicar contra o que já está gravado',
    '',
    `- Linhas gravadas hoje: ${existentes.length} (camisa 331: ${existentes.filter((x) => x.item_id === ITEM_331).length})`,
    `- Troca 331 → 312 (linha movida): ${trocas331} · 331 removida por o contrato já ter a 312 (funcoes mescladas): ${mescladas331}`,
    `- Inserções novas: ${inserts}`,
    `- Updates de funcoes/origem em linhas existentes: ${updates}`,
    '- Item 331 em `itens`: NÃO é inativado (decisão da gestão, 15/10/2026) — segue ativo no CEU, fora do kit do líder.',
    `- Linhas gravadas que deixaram de ser propostas e NÃO serão apagadas: ${sobras.length}`,
    '',
    '### Overrides por contrato aplicados',
    '',
    ...logOverrides,
    '',
    '### Updates de funcoes/origem',
    '',
    ...(updatesDetalhe.length ? updatesDetalhe : ['- nenhum']),
    '',
    '### Linhas que sobram (não propostas, mantidas)',
    '',
    ...(sobras.length ? sobras : ['- nenhuma']),
  ].join('\n')
  fs.appendFileSync(RELATORIO, '\n' + secaoPlano + '\n')

  const sql = [
    '-- Carga do kit de uniforme/EPI por contrato (gerado por scripts/materiais/carregar-uniformes-contratos.ts)',
    'begin;',
    '-- 1) camisa 331 (modelo antigo) → 312: mescla funcoes se o contrato já tem a 312; senão move a linha',
    `update public.mat_contrato_ceu_itens a set funcoes = case when cardinality(a.funcoes) = 0 or cardinality(o.funcoes) = 0 then '{}'::text[] else (select coalesce(array_agg(distinct f), '{}'::text[]) from unnest(a.funcoes || o.funcoes) f) end`,
    `  from public.mat_contrato_ceu_itens o where o.contrato_id = a.contrato_id and o.item_id = ${q(ITEM_331)} and a.item_id = ${q(ITEM_312)};`,
    `delete from public.mat_contrato_ceu_itens o using public.mat_contrato_ceu_itens a where o.item_id = ${q(ITEM_331)} and a.contrato_id = o.contrato_id and a.item_id = ${q(ITEM_312)};`,
    `update public.mat_contrato_ceu_itens set item_id = ${q(ITEM_312)} where item_id = ${q(ITEM_331)};`,
    '-- 2) upsert: insere o que falta e atualiza funcoes/origem das existentes (rotulo/ordem/ativo preservados)',
    'insert into public.mat_contrato_ceu_itens (contrato_id, item_id, rotulo, funcoes, ordem, ativo, origem) values',
    linhasSql.join(',\n'),
    'on conflict (contrato_id, item_id) do update set funcoes = excluded.funcoes, origem = excluded.origem',
    '  where (public.mat_contrato_ceu_itens.funcoes, public.mat_contrato_ceu_itens.origem) is distinct from (excluded.funcoes, excluded.origem);',
    'commit;',
    '',
  ].join('\n')
  fs.writeFileSync(ARQ_SQL, sql)

  console.log(resumo.split('\n## Contratos')[0])
  console.log(`\nRelatório: ${RELATORIO}\nSQL: ${ARQ_SQL}`)

  if (!APLICAR) {
    console.log('\nDRY-RUN: nada foi gravado. Use --aplicar (depois da migration 129) para gravar.')
    return
  }
  if (linhasSql.length === 0) return
  const dirBk = `dados-locais/backup_mat_contrato_ceu_itens_${HOJE}.json`
  execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-sql-arquivo.ps1', '-Saida', dirBk, '-Query', 'select * from public.mat_contrato_ceu_itens'], {
    stdio: 'pipe',
  })
  const out = execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-arquivo-sql-management-api.ps1', '-Arquivo', ARQ_SQL], {
    encoding: 'utf-8',
  })
  console.log(out)
}

main()
