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
//   --aplicar     grava (exige a migration 129 aplicada; backup de mat_contrato_ceu_itens antes;
//                 INSERT ... ON CONFLICT (contrato_id, item_id) DO NOTHING — nunca sobrescreve
//                 o que a gestão já editou na tela).
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
// Chave = texto da pergunta do form (sem acento, maiúsculas); valor = nome base
// da peça no CEU (itens). Decididas olhando o histórico de entregas de
// 12 meses por cargo (ex.: a "calça azul escura de elástico" das ASGs é a
// CALÇA EM OXFORD AZUL MARINHO — 167 entregas a ASGs) e as conversões já
// usadas na importação de entregas (máscara → respirador com válvula,
// óculos → lente incolor). Peça sem regra fica no relatório para a gestão.
const REGRAS_FORM: { padrao: RegExp; base: string; tipo: 'uniforme' | 'epi' }[] = [
  { padrao: /^CAMISA COR AZUL CLARA TIPO POLO/, base: 'CAMISA MALHA POLO AZUL CLARA - ASG', tipo: 'uniforme' },
  { padrao: /^CALCA COR AZUL ESCURA DE ELASTICO/, base: 'CALÇA EM OXFORD AZUL MARINHO', tipo: 'uniforme' },
  { padrao: /^CAMISA SOCIAL COR BRANCA/, base: 'CAMISA SOCIAL EM TECIDO BRANCA COM LOGO BORDADO', tipo: 'uniforme' },
  { padrao: /^CALCA SOCIAL/, base: 'CALÇA SOCIAL', tipo: 'uniforme' },
  { padrao: /^BLAZER/, base: 'BLAZER', tipo: 'uniforme' },
  { padrao: /^GRAVATA/, base: 'GRAVATA', tipo: 'uniforme' },
  { padrao: /^CAMISA COR BEGE TIPO POLO/, base: 'CAMISA MALHA POLO - ENCARREGADO', tipo: 'uniforme' },
  { padrao: /^CAMISA POLO COR AZUL COM LOGO PLENA/, base: 'CAMISA POLO AZUL TECH', tipo: 'uniforme' },
  { padrao: /^JALECO MANGA LONGA AZUL COM LOGO PLENA TECH/, base: 'JALECO AZUL TECH', tipo: 'epi' },
  { padrao: /^BLUSA BRANCA FEMININA/, base: 'BLUSA RECEPÇÃO FEMININA', tipo: 'uniforme' },
  { padrao: /^LUVA LATEX AMARELA/, base: 'LUVA LÁTEX', tipo: 'epi' },
  { padrao: /^LUVA NITRILICA/, base: 'LUVA NITRÍLICA', tipo: 'epi' },
  { padrao: /^LUVA PVC/, base: 'LUVA PVC', tipo: 'epi' },
  { padrao: /^MASCARA DESCARTAVEL/, base: 'MÁSCARA RESPIRADOR COM VÁLVULA', tipo: 'epi' },
  { padrao: /^OCULOS DE PROTECAO/, base: 'ÓCULOS LENTE INCOLOR', tipo: 'epi' },
  { padrao: /^AVENTAL DE PVC/, base: 'AVENTAL', tipo: 'epi' },
  { padrao: /^BOTA DE PVC CANO CURTO/, base: 'BOTA PVC CANO CURTO', tipo: 'epi' },
  { padrao: /^BOTINA/, base: 'BOTINA COM ELÁSTICO', tipo: 'epi' },
  { padrao: /^ABAFADOR/, base: 'ABAFADOR DE RUÍDOS', tipo: 'epi' },
  { padrao: /^CAPACETE/, base: 'CAPACETE', tipo: 'epi' },
  { padrao: /^LUVA PIGMENTADA/, base: 'LUVA DE MALHA PIGMENTADA', tipo: 'epi' },
  { padrao: /^PROTETOR AURICULAR/, base: 'PROTETOR AURICULAR', tipo: 'epi' },
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
  /** Peça do CEU pelo nome base da regra (sem acento, chave ordenada). */
  const grupoPorBase = (base: string, tipo: 'uniforme' | 'epi') => {
    for (const t of [tipo, tipo === 'epi' ? 'uniforme' : 'epi'] as const) {
      const g = grupoAtivo(chavePeca(base, t))
      if (g) return g
    }
    return null
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
      const g = regra ? grupoPorBase(regra.base, regra.tipo) : null
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
  // "LUVA DE CORTE" no histórico: boa parte é luva látex importada com o item
  // errado (observacao "Item: LUVA LATEX ..."). Para a carga, essas entregas
  // contam como LUVA LÁTEX — o histórico do CEU NÃO é alterado (correção à parte).
  const chaveLuvaCorte = chavePeca('LUVA DE CORTE', 'epi')
  const chaveLuvaLatex = chavePeca('LUVA LÁTEX', 'epi')
  let luvaCorteReatribuidas = 0
  const chaveDaEntrega = (e: { item_id: string; observacao?: string | null }) => {
    const chave = grupoDoItem.get(e.item_id)
    if (chave === chaveLuvaCorte && /ITEM: ?LUVA LATEX/.test(semAcento(e.observacao ?? ''))) {
      luvaCorteReatribuidas++
      return chaveLuvaLatex
    }
    return chave
  }
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
          const chave = chaveDaEntrega(e)
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
    `- Entregas "LUVA DE CORTE" com observação "Item: LUVA LATEX" contadas como Luva látex (só na carga): ${luvaCorteReatribuidas}`,
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

  const sql = [
    '-- Carga do kit de uniforme/EPI por contrato (gerado por scripts/materiais/carregar-uniformes-contratos.ts)',
    'begin;',
    'insert into public.mat_contrato_ceu_itens (contrato_id, item_id, rotulo, funcoes, ordem, ativo, origem) values',
    linhasSql.join(',\n'),
    'on conflict (contrato_id, item_id) do nothing;',
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
