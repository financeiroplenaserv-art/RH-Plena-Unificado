// Importação dos pedidos de OUTUBRO/2026 (respostas dos Google Forms, uma aba por
// contrato em docs/PEDIDO DE MATERIAIS POR CLIENTE.xlsx) para o módulo Materiais.
//
// Uso:
//   npx tsx --tsconfig tsconfig.scripts.json scripts/materiais/importar-pedidos-outubro.ts [opções]
//
//   (sem opções)  DRY-RUN: lê produção (SÓ SELECT), lê a planilha e grava em
//                 dados-locais/importacao_pedidos_outubro_2026-10-17/ a planilha de revisão
//                 (revisao.xlsx), o resumo em texto (resumo.txt) e a PRÉVIA do SQL (aplicar.sql).
//                 NÃO escreve nada no banco.
//   --offline     reaproveita os JSONs de produção já baixados (pasta ref/).
//   --aceitar-qtd-com-unidade
//                 trata "6 unidades", "2 bombonas", "1 pacote" como número limpo (só vale depois de a
//                 gestora aprovar esta regra; sem a opção, vira pendência com a quantidade sugerida).
//   Decisões da gestora: arquivo dados-locais/importacao_pedidos_outubro_2026-10-17/decisoes_colunas.json
//                 { "<pergunta (1ª linha)>": { "item_id": "...", "variacao_id": null } } — preenchido a
//                 partir da aba "Mapa de colunas" da revisão; é lido automaticamente se existir.
//   --aplicar     (SÓ DEPOIS DE AUTORIZAÇÃO DA GESTORA) executa o aplicar.sql pela Management API
//                 (scripts/lib/executar-arquivo-sql-management-api.ps1, arquivo UTF-8, uma transação):
//                   1. backup JSON dos 6 pedidos de teste de outubro e de tudo que pende deles;
//                   2. apaga os pedidos de teste (comentários, linhas, ceu_pedido_itens, envios, pedidos);
//                   3. para cada resposta de outubro, na ordem do carimbo, chama mat_registrar_envio
//                      (a MESMA regra do link: kit × extra, aprovação automática do kit da 135,
//                      mescla de complementos) com p_user_agent = 'importado-planilha-2026-10-17'
//                      (marca de origem sem mudar o esquema) e depois acerta enviado_em para o carimbo
//                      original da planilha.
//                 Decisões da gestora (17/10/2026): os pedidos de MATERIAIS entram AGUARDANDO VALIDAÇÃO
//                 (fluxo normal: kit aprovado automático pela regra da 135; extras vão para o
//                 inspetor e depois o gestor) e uniforme/EPI/crachá ENTRAM na fila da Beth
//                 (CEU → Pedidos) normalmente.
//                 Só entram linhas AUTOMÁTICAS; tudo que está pendente na revisão fica de fora até a
//                 gestora decidir (e o script ser rodado de novo com as decisões).
//
// Regra do projeto — "importação nunca grava palpite": só casamento EXATO (nome idêntico ao
// catálogo/alias, número limpo, pessoa única e inequívoca, tamanho da lista da peça) é automático;
// qualquer inferência vira pendência com a sugestão ao lado.
//
// NUNCA versionar dados-locais/ (dados pessoais).

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import * as XLSXns from '@e965/xlsx'
import type { DepartamentoFuzzy } from '../../src/lib/departamentos'
import { normalizarTexto } from '../../src/lib/materiais/normalizar'
import { buscarItens } from '../../src/lib/materiais/buscaItens'
import {
  idsEquipeDoContrato,
  nomesCurtos,
  pecasDoContrato,
  type ConfigPecaContrato,
  type ItemCeuCadastro,
  type PecaPublica,
} from '../../src/lib/materiais/pecasCeu'
import {
  MOTIVOS_CRACHA,
  TERMOS_PEDIDO,
  validarEnvioPedido,
  visaoDoLider,
  type ContextoPedido,
  type ItemCatalogoServidor,
  type KitPublico,
} from '../../src/lib/materiais/pedidoLider'

const XLSX = ((XLSXns as unknown as { default?: typeof XLSXns }).default ?? XLSXns) as typeof XLSXns

const APLICAR = process.argv.includes('--aplicar')
const OFFLINE = process.argv.includes('--offline')
const ACEITAR_QTD_COM_UNIDADE = process.argv.includes('--aceitar-qtd-com-unidade')
const PLANILHA = 'docs/PEDIDO DE MATERIAIS POR CLIENTE.xlsx'
const DIR = 'dados-locais/importacao_pedidos_outubro_2026-10-17'
const DIR_REF = `${DIR}/ref`
const ORIGEM = 'importado-planilha-2026-10-17'
const MES = '2026-10'

// ---------- tabelas explícitas (conferidas) ----------
/** Abas cujo nome não bate letra a letra com o contrato (nome truncado/abreviado pelo Excel). */
const ABA_PARA_CONTRATO: Record<string, string> = {
  CARTÓRIO: 'CARTÓRIO 3o. OFÍCIO',
  FOREVER: 'FOREVER RESIDENCE',
  QUINTAS: 'QUINTAS DE ICARAÍ',
  'TELEX LOJAS BAR-TIJ-IPA': 'TELEX BAR, TIJ E IPA',
  'TELEX LOJAS COPA, MADU, BOTA E': 'TELEX COPA, MAD, BOTA E MÉIER',
  'TELEX LOJAS ICA, CENTRO NIT E R': 'TELEX ICA, CENTRO NIT E CENTRO RJ',
}
const ABAS_APOIO = new Set(['Não mexer', 'Kit Mensal e Link por cliente', 'FORM P- USO DA ÁREA OPER', 'MODELO FORMULÁRIO KIT MENSAL', 'MODELO SUSO COMPLETO'])

/** Pergunta do form de uniforme/EPI → item do CEU (mesmas regras de carregar-uniformes-contratos.ts). */
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

// ---------- utilitários ----------
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const norm = (s: unknown) => normalizarTexto(String(s ?? ''))
const q = (v: string | null) => (v === null ? 'null' : `'${v.replace(/'/g, "''")}'`)

function consultar<T>(nome: string, sql: string): T[] {
  const arquivo = path.join(DIR_REF, `${nome}.json`)
  if (!OFFLINE) {
    fs.mkdirSync(DIR_REF, { recursive: true })
    execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-sql-arquivo.ps1', '-Saida', arquivo, '-Query', sql], { stdio: 'pipe' })
  }
  return JSON.parse(fs.readFileSync(arquivo, 'utf-8')) as T[]
}

interface Contrato {
  id: string
  nome: string
  departamento_id: string
  recebe_limpeza: boolean
  ativo: boolean
  departamentos_equipe_extra: string[] | null
}
interface ItemMat {
  id: string
  nome: string
  nome_lider: string | null
  categoria: string
  unidade_pedido: string
  ativo: boolean
  contratos_exclusivos: string[] | null
  contratos_ocultos: string[] | null
}
interface VariacaoMat { id: string; item_id: string; rotulo: string; ativo: boolean; oculta_lider: boolean }
interface AliasMat { nome_legado: string; item_id: string; variacao_id: string | null }
interface ColabApoio { id: string; nome_completo: string; cargo: string | null; departamento_id: string | null; departamento: string | null }
interface ItemCeu { id: string; nome: string; tipo: string; situacao: string | null; compra_na_loja: boolean }
interface KitLinha { contrato_id: string; item_id: string; variacao_id: string | null; quantidade: number; periodicidade_meses: number }

// ---------- classificação das colunas ----------
type Tipo =
  | 'ignorar' | 'responsavel' | 'observacao' | 'gate_uniforme' | 'gate_epi' | 'gate_cracha' | 'portaria'
  | 'cracha_nome' | 'cracha_motivo' | 'cracha_cordao' | 'livre_produto' | 'livre_epi' | 'livre_uniforme'
  | 'uniforme' | 'epi' | 'produto'
interface Coluna { idx: number; tipo: Tipo; titulo: string; regra?: (typeof REGRAS_FORM)[number] }

function classificar(titulo: string): Omit<Coluna, 'idx'> {
  const primeira = titulo.split('\n')[0].trim()
  const n = semAcento(primeira).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const t = (tipo: Tipo) => ({ tipo, titulo: primeira })
  if (/^(CARIMBO|PONTUACAO|DATA$|CLIENTE|NOME DO CONTRATO)/.test(n) || n.startsWith('DECLARO')) return t('ignorar')
  if (n.startsWith('RESPONSAVEL')) return t('responsavel')
  if (n.startsWith('VOCE PRECISA FAZER PEDIDO DE ALGUMA PECA')) return t('gate_uniforme')
  if (n.startsWith('SERA PRECISO FAZER PEDIDO DE EPI')) return t('gate_epi')
  if (n.startsWith('E NECESSARIO FAZER PEDIDO DE CRACHA')) return t('gate_cracha')
  if (n.startsWith('ESCREVA ABAIXO O NOME QUE CONSTARA')) return t('cracha_nome')
  if (n.startsWith('QUAL MOTIVO DA SOLICITACAO')) return t('cracha_motivo')
  if (n.startsWith('PRECISA DE NOVO CORDAO')) return t('cracha_cordao')
  if (n.startsWith('PRECISA PEDIR PARA OUTRA PESSOA')) return t('ignorar')
  if (n.startsWith('GOSTARIA DE DEIXAR')) return t('observacao')
  if (/^(O KIT PORTARIA|QUAL DOS MATERIAIS ABAIXO|CITE ABAIXO A QUANTIDADE|O ITEM DE PORTARIA|A PLENA OFERECE)/.test(n)) return t('portaria')
  if (n.startsWith('OUTROS MATERIAIS')) return t('livre_produto')
  if (n.startsWith('OUTROS EPI')) return t('livre_epi')
  if (n.startsWith('UNIFORMES DE OUTRAS')) return t('livre_uniforme')
  const regra = REGRAS_FORM.find((r) => r.padrao.test(semAcento(primeira)))
  if (regra) return { tipo: regra.tipo, titulo: primeira, regra }
  return t('produto')
}

// ---------- respostas ----------
const NAO_PRECISA = /^(nao[ -]?precisa|nao|nada|nenhum|nenhuma|0|00|-|n\/?a)\.?$/
const ehNaoPrecisa = (v: string) => NAO_PRECISA.test(norm(v).replace(/ +/g, ' ').replace(/nao precisa/, 'nao precisa'))
const numeroLimpo = (v: string): number | null => (/^\d{1,3}$/.test(v.trim()) ? Number(v.trim()) : null)

/** Candidatas de nome normalizado para casar a pergunta do form com item/alias do catálogo (só igualdade exata). */
function formasDoTitulo(titulo: string): string[] {
  const primeira = titulo.split('\n')[0].trim()
  const m = primeira.match(/^(.*?)\s*[-–]?\s*\(([^)]*)\)\s*$/)
  const base = m ? m[1] : primeira
  const paren = m ? m[2] : ''
  const formas = new Set<string>([norm(base), norm(primeira), norm(`${base} ${paren}`)])
  const medida = paren.match(/(\d+[.,]?\d*\s*(?:ml|l|lt|lts|litros?|kg|g|mm|cm))\b/i)
  if (medida) formas.add(norm(`${base} ${medida[1]}`))
  // "ÁLCOOL À 70%" → "alcool a 70": remove o "a" solto
  for (const f of [...formas]) formas.add(f.replace(/\b[a-z]\b /g, '').trim())
  formas.delete('')
  return [...formas]
}

interface AlvoItem { item: ItemMat; variacao: VariacaoMat | null }

// ---------- principal ----------
function main() {
  console.log(`Modo: ${APLICAR ? 'APLICAR (grava no banco)' : 'DRY-RUN (nada é gravado)'}${OFFLINE ? ' [offline]' : ''}`)
  fs.mkdirSync(DIR, { recursive: true })

  const contratos = consultar<Contrato>('contratos', 'select id, nome, departamento_id, recebe_limpeza, ativo, departamentos_equipe_extra from public.mat_contratos order by nome')
  const itensMat = consultar<ItemMat>('mat_itens', 'select id, nome, nome_lider, categoria, unidade_pedido, ativo, contratos_exclusivos, contratos_ocultos from public.mat_itens order by nome')
  const variacoes = consultar<VariacaoMat>('variacoes', 'select id, item_id, rotulo, ativo, oculta_lider from public.mat_item_variacoes')
  const aliases = consultar<AliasMat>('aliases', 'select nome_legado, item_id, variacao_id from public.mat_aliases')
  const kits = consultar<KitLinha>('kits', 'select contrato_id, item_id, variacao_id, quantidade, periodicidade_meses from public.mat_kit_itens')
  const itensCeu = consultar<ItemCeu>('itens_ceu', "select id, nome, tipo, situacao, compra_na_loja from public.itens where tipo in ('Uniforme','EPI')")
  const cfgCeu = consultar<ConfigPecaContrato & { contrato_id: string }>('cfg_ceu', 'select contrato_id, item_id, rotulo, funcoes, ordem, ativo from public.mat_contrato_ceu_itens')
  const deps = consultar<DepartamentoFuzzy>('departamentos', 'select id, nome, nome_curto, empresa_id, status from public.departamentos')
  const colabs = consultar<ColabApoio>('colaboradores', "select id, nome_completo, cargo, departamento_id, departamento from public.colaboradores where status = 'Ativo'")
  const testes = consultar<{ id: string; contrato: string; tipo: string; status_produtos: string; status_ceu: string; envios: number; linhas: number; ceu: number; ceu_atendidas: number; coment: number }>(
    'pedidos_out',
    "select p.id, c.nome contrato, p.tipo, p.status_produtos, p.status_ceu, (select count(*) from public.mat_pedido_envios e where e.pedido_id=p.id) envios, (select count(*) from public.mat_pedido_itens i where i.pedido_id=p.id) linhas, (select count(*) from public.ceu_pedido_itens x where x.pedido_id=p.id) ceu, (select count(*) from public.ceu_pedido_itens x where x.pedido_id=p.id and (x.status in ('atendido','ajustado') or x.atendido_em is not null)) ceu_atendidas, (select count(*) from public.mat_comentarios m where m.pedido_id=p.id) coment from public.mat_pedidos p join public.mat_contratos c on c.id=p.contrato_id where p.competencia = date '2026-10-01' order by c.nome"
  )

  // ---- índices do catálogo (só casamento exato) ----
  const itemPorId = new Map(itensMat.map((i) => [i.id, i]))
  const variacaoPorId = new Map(variacoes.map((v) => [v.id, v]))
  const variacoesAtivas = (itemId: string) => variacoes.filter((v) => v.item_id === itemId && v.ativo)
  const indice = new Map<string, Map<string, AlvoItem>>() // forma normalizada → alvos distintos
  const guardar = (forma: string, alvo: AlvoItem) => {
    if (!forma) return
    const m = indice.get(forma) ?? new Map<string, AlvoItem>()
    m.set(`${alvo.item.id}|${alvo.variacao?.id ?? ''}`, alvo)
    indice.set(forma, m)
  }
  for (const it of itensMat.filter((i) => i.ativo)) {
    const semUnidade = it.nome.replace(/\s+(UN|PCT|CX)$/i, '')
    for (const f of [norm(it.nome), norm(semUnidade), it.nome_lider ? norm(it.nome_lider) : '']) guardar(f, { item: it, variacao: null })
  }
  for (const a of aliases) {
    const it = itemPorId.get(a.item_id)
    if (!it?.ativo) continue
    guardar(norm(a.nome_legado), { item: it, variacao: a.variacao_id ? variacaoPorId.get(a.variacao_id) ?? null : null })
  }
  const decisoesArq = `${DIR}/decisoes_colunas.json`
  const decisoes: Record<string, { item_id: string; variacao_id?: string | null }> = fs.existsSync(decisoesArq) ? JSON.parse(fs.readFileSync(decisoesArq, 'utf-8')) : {}
  const casarTitulo = (titulo: string): { alvo: AlvoItem | null; motivo: string; sugestao: string; decidido?: boolean } => {
    const dec = decisoes[titulo.split('\n')[0].trim()]
    if (dec && itemPorId.get(dec.item_id)) {
      return { alvo: { item: itemPorId.get(dec.item_id)!, variacao: dec.variacao_id ? variacaoPorId.get(dec.variacao_id) ?? null : null }, motivo: '', sugestao: '', decidido: true }
    }
    const achados = new Map<string, AlvoItem>()
    for (const f of formasDoTitulo(titulo)) for (const [k, a] of indice.get(f) ?? []) achados.set(k, a)
    if (achados.size === 1) return { alvo: [...achados.values()][0], motivo: '', sugestao: '' }
    const buscaveis = itensMat.filter((i) => i.ativo).map((i) => ({
      id: i.id, nome: i.nome, nome_lider: i.nome_lider,
      variacoes: variacoesAtivas(i.id).map((v) => ({ id: v.id, rotulo: v.rotulo })),
    }))
    const base = titulo.split('\n')[0].replace(/\s*[-–]?\s*\([^)]*\)\s*$/, '')
    const sug = buscarItens(base, buscaveis, 3).map((r) => `${r.nome} [${r.item.id}${r.variacao ? ' / ' + r.variacao.id : ''}]`).join(' | ')
    return { alvo: null, motivo: achados.size > 1 ? 'nome casa com mais de um item' : 'nenhum item/alias com este nome', sugestao: sug }
  }

  // ---- planilha ----
  if (!fs.existsSync(PLANILHA)) throw new Error(`Planilha não encontrada: ${PLANILHA}`)
  const wb = XLSX.read(fs.readFileSync(PLANILHA))

  const itensCeuCad: ItemCeuCadastro[] = itensCeu.map((i) => ({
    id: i.id, nome: i.nome, tipo: i.tipo === 'EPI' ? 'epi' : 'uniforme', ativo: !i.situacao || i.situacao.toUpperCase() === 'A', compra_na_loja: i.compra_na_loja === true,
  }))
  const contratoPorNome = new Map(contratos.map((c) => [norm(c.nome), c]))

  interface LinhaProduto { contrato: string; aba: string; envio: number; carimbo: string; coluna: string; valor: string; item: string; variacao: string; qtd: number | null; casamento: 'exato' | 'pendente'; obs: string }
  interface LinhaUnif { contrato: string; aba: string; envio: number; carimbo: string; tipo: string; coluna: string; valor: string; pessoa: string; colaborador: string; peca: string; tamanho: string; qtd: number | null; status: 'exato' | 'pendente'; obs: string }
  interface Pend { contrato: string; aba: string; envio: number; categoria: string; coluna: string; valor: string; sugestao: string; motivo: string }
  interface Resumo { aba: string; contrato: string; casamento: string; respostas: number; prodAuto: number; prodPend: number; uniAuto: number; uniPend: number; crachaAuto: number; crachaPend: number; kit: number; extra: number; zeradas: number; obs: string }
  const produtos: LinhaProduto[] = []
  const unifs: LinhaUnif[] = []
  const pends: Pend[] = []
  const resumos: Resumo[] = []
  const mapaColunas = new Map<string, { n: number; contratos: Set<string>; sugestao: string; motivo: string }>()
  let qtdComUnidadeResolvivel = 0
  const envios: { contrato: Contrato; aba: string; n: number; carimbo: string; carimboIso: string; responsavel: string; observacao: string | null; entrada: Record<string, unknown>; refParaColab: Map<string, string>; ctx: ContextoPedido }[] = []

  for (const nomeAba of wb.SheetNames) {
    if (ABAS_APOIO.has(nomeAba) || nomeAba.startsWith('Pedido Geral')) continue
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: null, raw: false }) as unknown[][]
    if (linhas.length < 2) continue
    const cab = linhas[0].map((c) => String(c ?? ''))
    const respostas = linhas.slice(1).filter((r) => {
      const m = String(r[0] ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})/)
      return !!m && `${m[3]}-${m[2]}` === MES
    })
    const nomeContrato = ABA_PARA_CONTRATO[nomeAba.trim()] ?? nomeAba.trim()
    const contrato = contratoPorNome.get(norm(nomeContrato)) ?? null
    const casamento = ABA_PARA_CONTRATO[nomeAba.trim()] ? `tabela explícita → ${nomeContrato}` : contrato ? 'nome igual' : 'SEM CONTRATO'
    const resumo: Resumo = { aba: nomeAba.trim(), contrato: contrato?.nome ?? '—', casamento, respostas: respostas.length, prodAuto: 0, prodPend: 0, uniAuto: 0, uniPend: 0, crachaAuto: 0, crachaPend: 0, kit: 0, extra: 0, zeradas: 0, obs: '' }
    resumos.push(resumo)
    if (respostas.length === 0) { resumo.obs = 'sem resposta em outubro — não gera nada'; continue }
    if (!contrato) {
      resumo.obs = 'aba sem contrato de pedido no banco — pendente'
      pends.push({ contrato: nomeAba, aba: nomeAba, envio: 0, categoria: 'Contrato', coluna: '—', valor: `${respostas.length} resposta(s)`, sugestao: '', motivo: 'aba não casa com nenhum contrato (mat_contratos)' })
      continue
    }
    const colunas: Coluna[] = cab.map((t, idx) => ({ idx, ...classificar(t) }))

    // equipe (mesma regra do link)
    const idsEquipe = idsEquipeDoContrato(deps, colabs, [contrato.departamento_id, ...(contrato.departamentos_equipe_extra ?? [])])
    const equipe = colabs.filter((c) => idsEquipe.has(c.id) && c.nome_completo).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'))
    const curtos = nomesCurtos(equipe.map((e) => e.nome_completo))
    const refParaColab = new Map<string, string>()
    const equipePublica = equipe.map((e, i) => { const ref = `ref${String(i).padStart(9, '0')}`; refParaColab.set(ref, e.id); return { ref, nome: curtos[i], funcao: null } })
    const tokensNome = equipe.map((e) => norm(e.nome_completo).split(' ').filter(Boolean))

    // peças do contrato + contexto de validação (idêntico ao do servidor)
    const cfg = cfgCeu.filter((c) => c.contrato_id === contrato.id)
    const pecasInfo = pecasDoContrato(cfg, itensCeuCad)
    const pecaDoItem = (itemId: string): PecaPublica | undefined => pecasInfo.pecas.find((p) => p.opcoes.some((o) => o.item_id === itemId))
    const catalogoServ: ItemCatalogoServidor[] = itensMat.filter((i) => i.ativo).map((i) => ({
      id: i.id, nome: i.nome, nome_lider: i.nome_lider, categoria: i.categoria as ItemCatalogoServidor['categoria'], unidade: i.unidade_pedido, validade_meses: null,
      variacoes: variacoesAtivas(i.id).map((v) => ({ id: v.id, rotulo: v.rotulo, oculta_lider: v.oculta_lider })),
      contratos_exclusivos: i.contratos_exclusivos, contratos_ocultos: i.contratos_ocultos,
    }))
    const kitContrato: KitPublico[] = kits.filter((k) => k.contrato_id === contrato.id).map((k) => ({ item_id: k.item_id, variacao_id: k.variacao_id, quantidade: Number(k.quantidade), periodicidade_meses: Number(k.periodicidade_meses ?? 1) }))
    const visao = visaoDoLider(catalogoServ, kitContrato, contrato.id)
    const itensCeuCtx: ContextoPedido['itensCeu'] = []
    const vistos = new Set<string>()
    for (const p of pecasInfo.pecas) for (const o of p.opcoes) if (!vistos.has(o.item_id)) { vistos.add(o.item_id); itensCeuCtx.push({ id: o.item_id, nome: itensCeu.find((i) => i.id === o.item_id)?.nome ?? p.rotulo, tipo: p.tipo }) }

    const chaveCarimbo = (x: unknown[]) => { const m = String(x[0]).match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : String(x[0]) }
    respostas.sort((a, b) => chaveCarimbo(a).localeCompare(chaveCarimbo(b)))
    respostas.forEach((r, ordem) => {
      const nEnvio = ordem + 1
      const carimbo = String(r[0]).slice(0, 19)
      const [dd, mm, aaaa, hh = '00', mi = '00', ss = '00'] = carimbo.split(/[/ :]/)
      const carimboIso = `${aaaa}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`
      const valorDe = (c: Coluna) => { const v = r[c.idx]; return v == null ? '' : String(v).trim() }
      const respondente = valorDe(colunas.find((c) => c.tipo === 'responsavel') ?? colunas[0]) || ''
      const gate = (t: Tipo) => { const c = colunas.find((x) => x.tipo === t); return c ? norm(valorDe(c)) : null }
      const gateUnif = gate('gate_uniforme'); const gateEpi = gate('gate_epi'); const gateCracha = gate('gate_cracha')
      const obsCol = colunas.find((c) => c.tipo === 'observacao')
      const obsTexto = obsCol ? valorDe(obsCol) : ''
      const observacao = obsTexto && !ehNaoPrecisa(obsTexto) ? obsTexto.slice(0, 500) : null

      const addPend = (categoria: string, coluna: string, valor: string, motivo: string, sugestao = '') =>
        pends.push({ contrato: contrato.nome, aba: nomeAba.trim(), envio: nEnvio, categoria, coluna, valor, sugestao, motivo })

      const entProd: { item_id: string; variacao_id: string | null; quantidade: number; parte: 'kit' | 'extra'; coluna: string }[] = []
      const entCeu: Record<string, unknown>[] = []
      const noKit = (itemId: string, varId: string | null) => kitContrato.some((k) => k.item_id === itemId && (k.variacao_id == null || k.variacao_id === varId))

      // ---- produtos ----
      for (const c of colunas.filter((x) => x.tipo === 'produto')) {
        const v = valorDe(c)
        if (!v) continue
        const casou = casarTitulo(cab[c.idx])
        if (ehNaoPrecisa(v)) {
          // Item do kit com "Não precisa" = linha zerada (o líder tirou do mês), como no link.
          if (casou.alvo && kitContrato.some((k) => k.item_id === casou.alvo!.item.id)) {
            const alvoV = kitContrato.find((k) => k.item_id === casou.alvo!.item.id)!.variacao_id
            entProd.push({ item_id: casou.alvo.item.id, variacao_id: alvoV, quantidade: 0, parte: 'kit', coluna: c.titulo })
            resumo.zeradas++
          }
          continue
        }
        let qtd = numeroLimpo(v)
        const comUnidade = norm(v).match(/^(\d{1,3}) ?(unidades?|unid|un|und|bombonas?|pacotes?|caixas?|litros?|galoes|galao|frascos?|fardos?|rolos?|latas?)$/)
        if (qtd == null && comUnidade) {
          if (ACEITAR_QTD_COM_UNIDADE) qtd = Number(comUnidade[1])
          else qtdComUnidadeResolvivel++
        }
        const linha: LinhaProduto = { contrato: contrato.nome, aba: nomeAba.trim(), envio: nEnvio, carimbo, coluna: c.titulo, valor: v, item: casou.alvo?.item.nome ?? '', variacao: casou.alvo?.variacao?.rotulo ?? '', qtd, casamento: 'pendente', obs: '' }
        produtos.push(linha)
        if (!casou.alvo) {
          linha.obs = casou.motivo; resumo.prodPend++; addPend('Produto: coluna sem item', c.titulo, v, casou.motivo, casou.sugestao)
          const m = mapaColunas.get(c.titulo) ?? { n: 0, contratos: new Set<string>(), sugestao: casou.sugestao, motivo: casou.motivo }
          m.n++; m.contratos.add(contrato.nome); mapaColunas.set(c.titulo, m)
          continue
        }
        if (casou.decidido) linha.obs = 'item definido pela gestora (decisoes_colunas.json)'
        let variacaoId = casou.alvo.variacao?.id ?? null
        const ativas = variacoesAtivas(casou.alvo.item.id)
        if (!variacaoId && ativas.length > 0) {
          const doKit = kitContrato.filter((k) => k.item_id === casou.alvo!.item.id && k.variacao_id)
          const uniao = new Set(doKit.map((k) => k.variacao_id))
          if (ativas.length === 1) variacaoId = ativas[0].id
          else if (uniao.size === 1) { variacaoId = [...uniao][0]; linha.obs = 'variação do kit do contrato' }
        }
        if (qtd == null) { linha.obs = `quantidade em texto (${v}); item ${casou.alvo.item.nome}`; resumo.prodPend++; addPend('Produto: quantidade em texto', c.titulo, v, comUnidade ? `quantidade com unidade (sugestão: ${comUnidade[1]}) — depende da regra "número + unidade"` : 'quantidade não é número limpo', `${casou.alvo.item.nome}${casou.alvo.variacao ? ' — ' + casou.alvo.variacao.rotulo : ''}`); continue }
        if (!variacaoId && ativas.length > 0) { linha.obs = 'item tem variações: escolher'; resumo.prodPend++; addPend('Produto: escolher variação', c.titulo, v, `item ${casou.alvo.item.nome} tem ${ativas.length} variações`, ativas.map((x) => x.rotulo).join(' | ')); continue }
        if (qtd === 0) continue
        linha.casamento = 'exato'; linha.variacao = variacaoId ? variacaoPorId.get(variacaoId)?.rotulo ?? '' : ''
        resumo.prodAuto++
        entProd.push({ item_id: casou.alvo.item.id, variacao_id: variacaoId, quantidade: qtd, parte: noKit(casou.alvo.item.id, variacaoId) ? 'kit' : 'extra', coluna: c.titulo })
      }
      for (const c of colunas.filter((x) => x.tipo === 'livre_produto' || x.tipo === 'livre_epi' || x.tipo === 'livre_uniforme' || x.tipo === 'portaria')) {
        const v = valorDe(c)
        if (!v || ehNaoPrecisa(v)) continue
        const lixo = c.tipo === 'portaria' && /^(nao|sim)\.?$/.test(norm(v))
        if (lixo) continue
        addPend(c.tipo === 'portaria' ? 'Kit portaria (texto livre)' : 'Texto livre (outros)', c.titulo, v, 'texto livre: a gestora decide item e quantidade')
        resumo.prodPend++
      }

      // ---- uniforme / EPI ----
      const gateNao = (g: string | null) => g != null && /^nao/.test(g)
      for (const c of colunas.filter((x) => (x.tipo === 'uniforme' && !gateNao(gateUnif)) || (x.tipo === 'epi' && !gateNao(gateEpi)))) {
        const v = valorDe(c)
        if (!v || ehNaoPrecisa(v)) continue
        const regra = c.regra!
        const peca = pecaDoItem(regra.itemId)
        const lojaPeca = peca?.compra_na_loja === true
        const linhaBase = { contrato: contrato.nome, aba: nomeAba.trim(), envio: nEnvio, carimbo, tipo: regra.tipo, coluna: c.titulo, valor: v, peca: peca?.rotulo ?? regra.base }
        if (!peca) {
          unifs.push({ ...linhaBase, pessoa: '', colaborador: '', tamanho: '', qtd: null, status: 'pendente', obs: 'peça fora do kit de uniforme/EPI deste contrato' })
          resumo.uniPend++; addPend('Uniforme/EPI: peça fora do kit', c.titulo, v, `peça ${regra.base} não está no kit deste contrato`)
          continue
        }
        const tamanhosValidos = new Set(peca.opcoes.map((o) => o.tamanho.toUpperCase()).filter(Boolean))
        const segs = segmentarPessoas(norm(v), equipe, tokensNome)
        if (segs.erro) {
          unifs.push({ ...linhaBase, pessoa: '', colaborador: '', tamanho: '', qtd: null, status: 'pendente', obs: segs.erro })
          resumo.uniPend++; addPend('Uniforme/EPI: pessoa', c.titulo, v, segs.erro)
          continue
        }
        // Tudo ou nada: se QUALQUER pessoa do texto não fecha, a resposta inteira fica pendente
        // (evita importar só parte do que o líder escreveu).
        const analises = segs.itens.map((s) => ({ s, p: parseSegmento(s.resto, tamanhosValidos, lojaPeca) }))
        const todasOk = analises.every((a) => a.p.ok)
        for (const { s, p } of analises) {
          const colab = equipe[s.indice]
          const base = { ...linhaBase, pessoa: s.mencao, colaborador: colab.nome_completo, tamanho: p.tamanho ?? (lojaPeca ? '(compra na loja)' : ''), qtd: p.qtd }
          if (!todasOk) {
            const motivo = p.ok ? 'outra pessoa deste mesmo texto não fechou — a resposta inteira fica pendente' : p.motivo
            unifs.push({ ...base, status: 'pendente', obs: motivo })
            resumo.uniPend++; addPend('Uniforme/EPI: tamanho/quantidade', c.titulo, `${s.mencao} ${s.resto}`.trim(), motivo, colab.nome_completo)
            continue
          }
          unifs.push({ ...base, status: 'exato', obs: lojaPeca && p.tamanho ? `tamanho "${p.tamanho}" informado, mas a peça é compra na loja (não vai no pedido)` : '' })
          resumo.uniAuto++
          // O link grava o item do CEU do TAMANHO escolhido (um item por tamanho): usa a opção da peça com esse tamanho.
          const opc = lojaPeca || !p.tamanho ? peca.opcoes[0] : peca.opcoes.find((o) => o.tamanho.toUpperCase() === p.tamanho!.toUpperCase()) ?? peca.opcoes[0]
          entCeu.push({ chave: `u${entCeu.length}`, tipo: regra.tipo, colaborador_ref: equipePublica[s.indice].ref, item_id: opc.item_id, tamanho: lojaPeca ? '' : p.tamanho ?? '', quantidade: p.qtd })
        }
      }
      // gate marcado "Sim" mas nada preenchido não gera nada.

      // ---- crachá ----
      if (!gateNao(gateCracha)) {
        let atual: { nome?: string; motivo?: string; cordao?: string; colNome?: string } | null = null
        const crachasVistos = new Set<string>()
        const fechar = () => {
          if (!atual || !atual.nome) { atual = null; return }
          const a = atual
          const seg = segmentarPessoas(norm(a.nome ?? ''), equipe, tokensNome)
          const motivoOk = MOTIVOS_CRACHA.find((m) => norm(m) === norm(a.motivo ?? ''))
          const cordao = /^sim/.test(norm(a.cordao ?? '')) ? true : /^nao/.test(norm(a.cordao ?? '')) ? false : null
          const linha: LinhaUnif = { contrato: contrato.nome, aba: nomeAba.trim(), envio: nEnvio, carimbo, tipo: 'cracha', coluna: 'Crachá', valor: `${a.nome} | ${a.motivo ?? ''} | cordão: ${a.cordao ?? ''}`, pessoa: a.nome ?? '', colaborador: '', peca: 'Crachá', tamanho: '', qtd: 1, status: 'pendente', obs: '' }
          unifs.push(linha)
          const motivos: string[] = []
          if (seg.erro || seg.itens.length !== 1) motivos.push(seg.erro ?? 'nome do crachá cita mais de uma pessoa')
          else linha.colaborador = equipe[seg.itens[0].indice].nome_completo
          if (!motivoOk) motivos.push(`motivo "${a.motivo ?? ''}" não é um dos motivos da lista`)
          if (cordao == null) motivos.push('cordão: resposta não é Sim/Não')
          if (motivos.length) { linha.obs = motivos.join('; '); resumo.crachaPend++; addPend('Crachá', 'Crachá', linha.valor, linha.obs, linha.colaborador); atual = null; return }
          const chaveCracha = `${seg.itens[0].indice}`
          if (crachasVistos.has(chaveCracha)) { linha.obs = 'crachá repetido da mesma pessoa na mesma resposta'; resumo.crachaPend++; addPend('Crachá', 'Crachá', linha.valor, linha.obs, linha.colaborador); atual = null; return }
          crachasVistos.add(chaveCracha)
          linha.status = 'exato'; resumo.crachaAuto++
          entCeu.push({ chave: `c${entCeu.length}`, tipo: 'cracha', colaborador_ref: equipePublica[seg.itens[0].indice].ref, nome_digitado: equipePublica[seg.itens[0].indice].nome, cracha_nome: '', cracha_motivo: motivoOk, cracha_cordao: cordao, quantidade: 1 })
          atual = null
        }
        for (const c of colunas) {
          if (c.tipo === 'cracha_nome') { fechar(); const v = valorDe(c); atual = v && !ehNaoPrecisa(v) ? { nome: v } : null }
          else if (c.tipo === 'cracha_motivo' && atual) atual.motivo = valorDe(c)
          else if (c.tipo === 'cracha_cordao' && atual) atual.cordao = valorDe(c)
        }
        fechar()
      }

      // ---- validação com a MESMA regra do link ----
      const ctx: ContextoPedido = {
        hoje: `${aaaa}-${mm}-${dd}`, recebeLimpeza: contrato.recebe_limpeza, catalogo: visao.catalogo, kit: visao.kit, indisponiveis: visao.indisponiveis,
        itensCeu: itensCeuCtx, pecas: pecasInfo.pecas, equipe: equipePublica, ultimasEntregas: {}, precos: [], kitConfirmado: nEnvio > 1,
      }
      const entrada = {
        seu_nome: respondente || 'Importado da planilha',
        observacao,
        termos: Object.fromEntries(TERMOS_PEDIDO.map((t) => [t.id, true])),
        produtos: entProd.map((p) => ({ item_id: p.item_id, variacao_id: p.variacao_id, quantidade: p.quantidade, parte: p.parte })),
        ceu: entCeu,
      }
      const val = validarEnvioPedido(entrada, ctx)
      if (!val.ok) {
        for (const e of val.errosCampo) addPend('Validação do link', e.campo, '', e.mensagem)
      }
      for (const p of val.produtos) { if (p.parte === 'kit') resumo.kit++; else resumo.extra++ }
      envios.push({ contrato, aba: nomeAba.trim(), n: nEnvio, carimbo, carimboIso, responsavel: respondente, observacao, entrada, refParaColab, ctx })
      if (respostas.length > 1 && nEnvio === 1) {
        addPend('Duas respostas no mês', 'Carimbo', respostas.map((x) => String(x[0]).slice(0, 19)).join(' e '), 'duas respostas em outubro: parecem o mesmo pedido refeito? somar as duas (complemento) ou usar só a última?')
      }
    })
  }

  // ---- o que seria apagado (6 pedidos de teste) ----
  const apagar = testes
  const algumAtendido = apagar.some((p) => p.ceu_atendidas > 0)

  escreverSaidas({ resumos, produtos, unifs, pends, envios, apagar, algumAtendido, mapaColunas, qtdComUnidadeResolvivel })
}

// ---------- pessoas e tamanhos (texto livre) ----------
const FILLERS = new Set(['tam', 'tm', 'tamanho', 'n', 'no', 'num', 'numero', 'unidade', 'unidades', 'unid', 'und', 'un', 'par', 'pares', 'de', 'da', 'do', 'para', 'camisa', 'camisas', 'calca', 'calcas', 'blusa', 'blusas', 'bota', 'botas', 'botina', 'luva', 'luvas', 'e', 'com', 'x', 'peca', 'pecas', 'gravata', 'blazer', 'social'])
const NUMEROS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 }
const TAMANHOS_LETRA = new Set(['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'XXG', 'XXGG', 'EG', 'EGG', 'EXG'])

function segmentarPessoas(texto: string, equipe: ColabApoio[], tokens: string[][]): { erro?: string; itens: { indice: number; mencao: string; resto: string }[] } {
  const palavras = texto.split(' ').filter(Boolean)
  if (palavras.length === 0) return { erro: 'texto vazio', itens: [] }
  // primeiros nomes (únicos na equipe) e nomes completos
  const achados: { indice: number; pos: number; len: number; mencao: string }[] = []
  equipe.forEach((_, i) => {
    const t = tokens[i]
    if (t.length === 0) return
    const primeiro = t[0]
    const mesmos = tokens.filter((x) => x[0] === primeiro)
    palavras.forEach((w, pos) => {
      if (w !== primeiro) return
      // desambigua com o 2º nome citado logo depois
      const segundo = palavras[pos + 1]
      if (mesmos.length > 1) {
        if (!t[1] || segundo !== t[1]) return
        let len = 2
        while (pos + len < palavras.length && t.slice(2).includes(palavras[pos + len])) len++
        achados.push({ indice: i, pos, len, mencao: palavras.slice(pos, pos + len).join(' ') })
      } else {
        let len = 1
        while (pos + len < palavras.length && t.slice(1).includes(palavras[pos + len])) len++
        achados.push({ indice: i, pos, len, mencao: palavras.slice(pos, pos + len).join(' ') })
      }
    })
  })
  // primeiro nome compartilhado e sem 2º nome na frase = ambíguo
  const compartilhado = palavras.some((w) => equipe.length > 0 && tokens.filter((x) => x[0] === w).length > 1 && !achados.some((a) => palavras[a.pos] === w))
  if (achados.length === 0) return { erro: compartilhado ? 'nome ambíguo na equipe (mais de uma pessoa com esse primeiro nome)' : 'pessoa não encontrada na equipe do contrato', itens: [] }
  if (compartilhado) return { erro: 'nome ambíguo na equipe', itens: [] }
  achados.sort((a, b) => a.pos - b.pos)
  // Uma pessoa só: o resto do texto (antes e depois do nome) é dela. Várias: cada trecho vai do
  // nome até o próximo nome (o que vem antes do 1º nome entra no 1º trecho).
  const itens = achados.map((a, k) => {
    if (achados.length === 1) return { indice: a.indice, mencao: a.mencao, resto: [...palavras.slice(0, a.pos), ...palavras.slice(a.pos + a.len)].join(' ') }
    const fim = k + 1 < achados.length ? achados[k + 1].pos : palavras.length
    const inicio = k === 0 ? 0 : a.pos + a.len
    const trecho = k === 0 ? [...palavras.slice(0, a.pos), ...palavras.slice(a.pos + a.len, fim)] : palavras.slice(inicio, fim)
    return { indice: a.indice, mencao: a.mencao, resto: trecho.join(' ') }
  })
  return { itens }
}

function parseSegmento(resto: string, tamanhosValidos: Set<string>, lojaPeca: boolean): { ok: boolean; tamanho: string | null; qtd: number; motivo: string } {
  let tamanho: string | null = null
  let qtd: number | null = null
  const sobra: string[] = []
  for (const t of resto.split(' ').filter(Boolean)) {
    if (FILLERS.has(t)) continue
    if (t in NUMEROS) { if (qtd != null) return { ok: false, tamanho, qtd: qtd ?? 1, motivo: 'duas quantidades no texto' }; qtd = NUMEROS[t]; continue }
    if (/^\d+$/.test(t)) {
      const n = Number(t)
      if (n >= 30) { if (tamanho != null) return { ok: false, tamanho, qtd: qtd ?? 1, motivo: 'dois tamanhos no texto' }; tamanho = t; continue }
      if (qtd != null) return { ok: false, tamanho, qtd, motivo: 'duas quantidades no texto' }
      qtd = n; continue
    }
    if (TAMANHOS_LETRA.has(t.toUpperCase())) { if (tamanho != null) return { ok: false, tamanho, qtd: qtd ?? 1, motivo: 'dois tamanhos no texto' }; tamanho = t.toUpperCase(); continue }
    sobra.push(t)
  }
  if (sobra.length) return { ok: false, tamanho, qtd: qtd ?? 1, motivo: `texto não reconhecido: "${sobra.join(' ')}"` }
  if (!lojaPeca) {
    if (tamanhosValidos.size > 0 && !tamanho) return { ok: false, tamanho, qtd: qtd ?? 1, motivo: 'tamanho não informado' }
    if (tamanho && tamanhosValidos.size > 0 && !tamanhosValidos.has(tamanho.toUpperCase())) return { ok: false, tamanho, qtd: qtd ?? 1, motivo: `tamanho ${tamanho} fora da lista da peça (${[...tamanhosValidos].join(', ')})` }
  }
  return { ok: true, tamanho, qtd: qtd ?? 1, motivo: '' }
}

// ---------- saídas ----------
function escreverSaidas(d: {
  resumos: { aba: string; contrato: string; casamento: string; respostas: number; prodAuto: number; prodPend: number; uniAuto: number; uniPend: number; crachaAuto: number; crachaPend: number; kit: number; extra: number; zeradas: number; obs: string }[]
  produtos: { contrato: string; aba: string; envio: number; carimbo: string; coluna: string; valor: string; item: string; variacao: string; qtd: number | null; casamento: string; obs: string }[]
  unifs: { contrato: string; aba: string; envio: number; carimbo: string; tipo: string; coluna: string; valor: string; pessoa: string; colaborador: string; peca: string; tamanho: string; qtd: number | null; status: string; obs: string }[]
  pends: { contrato: string; aba: string; envio: number; categoria: string; coluna: string; valor: string; sugestao: string; motivo: string }[]
  envios: { contrato: Contrato; aba: string; n: number; carimbo: string; carimboIso: string; responsavel: string; observacao: string | null; entrada: Record<string, unknown>; refParaColab: Map<string, string>; ctx: ContextoPedido }[]
  apagar: { id: string; contrato: string; tipo: string; status_produtos: string; status_ceu: string; envios: number; linhas: number; ceu: number; ceu_atendidas: number; coment: number }[]
  algumAtendido: boolean
  mapaColunas: Map<string, { n: number; contratos: Set<string>; sugestao: string; motivo: string }>
  qtdComUnidadeResolvivel: number
}) {
  const wb = XLSX.utils.book_new()
  const add = (nome: string, cab: string[], linhas: (string | number | null)[][]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ...linhas]), nome)
  add('Resumo por contrato', ['Aba', 'Contrato (banco)', 'Casamento da aba', 'Respostas em outubro', 'Produtos automáticos', 'Produtos pendentes', 'Uniforme/EPI automáticos', 'Uniforme/EPI pendentes', 'Crachás automáticos', 'Crachás pendentes', 'Linhas kit (previstas)', 'Linhas extra (previstas)', 'Kit zerado ("não precisa")', 'Observação'],
    d.resumos.map((r) => [r.aba, r.contrato, r.casamento, r.respostas, r.prodAuto, r.prodPend, r.uniAuto, r.uniPend, r.crachaAuto, r.crachaPend, r.kit, r.extra, r.zeradas, r.obs]))
  add('Produtos', ['Contrato', 'Envio', 'Carimbo', 'Coluna original', 'Valor original', 'Item casado', 'Variação', 'Qtd', 'Casamento', 'Observação'],
    d.produtos.map((p) => [p.contrato, p.envio, p.carimbo, p.coluna, p.valor, p.item, p.variacao, p.qtd, p.casamento, p.obs]))
  add('Mapa de colunas', ['Pergunta do form (coluna)', 'Ocorrências em outubro', 'Contratos', 'Motivo', 'Sugestões (nome [item / variação])', 'Decisão: item_id', 'Decisão: variacao_id'],
    [...d.mapaColunas.entries()].sort((a, b) => b[1].n - a[1].n).map(([t, m]) => [t, m.n, [...m.contratos].slice(0, 6).join(', ') + (m.contratos.size > 6 ? ` (+${m.contratos.size - 6})` : ''), m.motivo, m.sugestao, '', '']))
  add('Uniformes', ['Contrato', 'Envio', 'Carimbo', 'Tipo', 'Coluna original', 'Valor original', 'Pessoa (texto)', 'Colaborador casado', 'Peça', 'Tamanho', 'Qtd', 'Status', 'Observação'],
    d.unifs.map((u) => [u.contrato, u.envio, u.carimbo, u.tipo, u.coluna, u.valor, u.pessoa, u.colaborador, u.peca, u.tamanho, u.qtd, u.status, u.obs]))
  add('Pendências', ['Contrato', 'Envio', 'Categoria', 'Coluna', 'Valor original', 'Sugestão', 'Motivo', 'Decisão'],
    d.pends.map((p) => [p.contrato, p.envio, p.categoria, p.coluna, p.valor, p.sugestao, p.motivo, '']))
  add('Pedidos de teste a apagar', ['Pedido', 'Contrato', 'Tipo', 'Status produtos', 'Status CEU', 'Envios', 'Linhas de produto', 'Linhas CEU', 'Linhas CEU atendidas', 'Comentários'],
    d.apagar.map((p) => [p.id, p.contrato, p.tipo, p.status_produtos, p.status_ceu, p.envios, p.linhas, p.ceu, p.ceu_atendidas, p.coment]))
  fs.writeFileSync(`${DIR}/revisao.xlsx`, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

  // prévia do SQL (a ser executado só com --aplicar)
  const sql: string[] = ['-- PRÉVIA gerada pelo dry-run. NÃO foi executada.', `-- Origem das linhas: p_user_agent = '${ORIGEM}'`]
  sql.push('-- 1) apagar os pedidos de teste de outubro (faça o backup JSON antes — o script --aplicar faz)')
  const ids = d.apagar.map((p) => q(p.id)).join(', ')
  if (ids) {
    sql.push(`delete from public.mat_comentarios where pedido_id in (${ids});`)
    sql.push(`delete from public.ceu_pedido_itens where pedido_id in (${ids});`)
    sql.push(`delete from public.mat_pedido_itens where pedido_id in (${ids});`)
    sql.push(`delete from public.mat_pedido_envios where pedido_id in (${ids});`)
    sql.push(`delete from public.mat_pedidos where id in (${ids});`)
  }
  sql.push('-- 2) respostas de outubro, na ordem do carimbo (só linhas automáticas)')
  const ordenados = [...d.envios].sort((a, b) => a.carimboIso.localeCompare(b.carimboIso))
  let chamadas = 0
  for (const e of ordenados) {
    const v = validarEnvioPedido(e.entrada, e.ctx)
    if (!v.ok) { sql.push(`-- ${e.contrato.nome} (envio ${e.n}): NÃO entra — falha na validação do link (ver Pendências)`); continue }
    const pendDoEnvio = d.pends.filter((p) => p.contrato === e.contrato.nome && p.envio === e.n && p.categoria !== 'Duas respostas no mês').length
    if (v.produtos.length === 0 && v.ceu.length === 0) {
      if (pendDoEnvio > 0) { sql.push(`-- ${e.contrato.nome} (envio ${e.n}): NÃO entra agora — só tem linhas pendentes (não pode virar "sem necessidade")`); continue }
      sql.push(`-- ${e.contrato.nome} (envio ${e.n}): resposta sem nada a pedir — entra como "sem necessidade este mês"`)
    }
    const ceu = v.ceu.map(({ colaborador_ref, ...l }) => ({ ...l, colaborador_id: colaborador_ref ? e.refParaColab.get(colaborador_ref) ?? null : null }))
    sql.push(`-- ${e.contrato.nome} — envio ${e.n} — ${e.carimbo}`)
    sql.push(
      `select public.mat_registrar_envio(${q(e.contrato.id)}::uuid, date ${q(e.carimboIso.slice(0, 10))}, ${q(v.seuNome)}, ${q(JSON.stringify(v.termos))}::jsonb, ${q(v.observacao)}, null, ${q(ORIGEM)}, ${q(JSON.stringify(v.produtos))}::jsonb, ${q(JSON.stringify(ceu))}::jsonb);`
    )
    // Acerta enviado_em para o carimbo original da planilha (a RPC grava now()).
    sql.push(`update public.mat_pedido_envios set enviado_em = ${q(e.carimboIso)}::timestamptz where id = (select e2.id from public.mat_pedido_envios e2 join public.mat_pedidos p2 on p2.id = e2.pedido_id where p2.contrato_id = ${q(e.contrato.id)}::uuid and p2.competencia = date '2026-10-01' order by e2.enviado_em desc limit 1);`)
    sql.push(`update public.mat_pedidos p set enviado_em = (select min(e3.enviado_em) from public.mat_pedido_envios e3 where e3.pedido_id = p.id) where p.contrato_id = ${q(e.contrato.id)}::uuid and p.competencia = date '2026-10-01';`)
    chamadas++
  }
  fs.writeFileSync(`${DIR}/aplicar.sql`, sql.join('\n') + '\n', 'utf8')

  // resumo em texto
  const t = (f: (r: (typeof d.resumos)[number]) => number) => d.resumos.reduce((s, r) => s + f(r), 0)
  const porCat = new Map<string, number>()
  for (const p of d.pends) porCat.set(p.categoria, (porCat.get(p.categoria) ?? 0) + 1)
  const linhasTxt = [
    'IMPORTAÇÃO DE OUTUBRO/2026 — DRY-RUN (nada foi gravado)',
    '',
    `Abas de contrato lidas: ${d.resumos.length}`,
    `Contratos com resposta em outubro: ${d.resumos.filter((r) => r.respostas > 0).length}  (respostas: ${t((r) => r.respostas)})`,
    `Contratos SEM resposta em outubro (não geram nada): ${d.resumos.filter((r) => r.respostas === 0).map((r) => r.aba).join(', ')}`,
    '',
    `Produtos — automáticos: ${t((r) => r.prodAuto)} | pendentes: ${t((r) => r.prodPend)}`,
    `Uniforme/EPI — automáticos: ${t((r) => r.uniAuto)} | pendentes: ${t((r) => r.uniPend)}`,
    `Crachás — automáticos: ${t((r) => r.crachaAuto)} | pendentes: ${t((r) => r.crachaPend)}`,
    `Colunas de produto SEM item no catálogo: ${d.mapaColunas.size} perguntas distintas (aba "Mapa de colunas": uma decisão por pergunta resolve todos os contratos)`,
    `Quantidades "número + unidade" (ex.: "6 unidades"): ${d.qtdComUnidadeResolvivel} passariam a automáticas se a gestora aprovar essa regra (opção --aceitar-qtd-com-unidade)`,
    `Previsto pela regra do link: ${t((r) => r.kit)} linhas de kit e ${t((r) => r.extra)} linhas extra (${t((r) => r.zeradas)} linhas de kit zeradas por "não precisa")`,
    `Chamadas a mat_registrar_envio previstas: ${chamadas}`,
    '',
    'Pendências por tipo:',
    ...[...porCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `  ${n}  ${c}`),
    '',
    `Pedidos de teste de outubro a apagar: ${d.apagar.length} (${d.apagar.map((p) => p.contrato + ' ' + p.tipo).join('; ')})`,
    `  linhas de produto: ${d.apagar.reduce((s, p) => s + p.linhas, 0)} | linhas CEU: ${d.apagar.reduce((s, p) => s + p.ceu, 0)} | envios: ${d.apagar.reduce((s, p) => s + p.envios, 0)} | comentários: ${d.apagar.reduce((s, p) => s + p.coment, 0)}`,
    `  linhas CEU já atendidas (virariam entrega): ${d.apagar.reduce((s, p) => s + p.ceu_atendidas, 0)} ${d.algumAtendido ? '— ATENÇÃO: PARAR e reportar' : '(nenhuma — seguro apagar)'}`,
    '',
    'Comportamento do --aplicar (decisões da gestora, 17/10/2026): materiais entram AGUARDANDO VALIDAÇÃO (kit aprovado',
    'automático pela regra da 135, extras para o inspetor e depois o gestor); uniforme/EPI/crachá entram na fila da Beth.',
    `Marca de origem: p_user_agent = '${ORIGEM}'.`,
  ]
  fs.writeFileSync(`${DIR}/resumo.txt`, linhasTxt.join('\n') + '\n', 'utf8')
  console.log(linhasTxt.join('\n'))

  if (APLICAR) {
    if (d.algumAtendido) throw new Error('Há linhas CEU dos pedidos de teste já atendidas — nada foi apagado. Reporte à gestão.')
    console.log('\n--aplicar: executando o SQL (backup antes)...')
    // backup JSON dos pedidos de teste e de tudo que pende deles
    const ids2 = d.apagar.map((p) => q(p.id)).join(', ')
    for (const [tab, col] of [['mat_pedidos', 'id'], ['mat_pedido_envios', 'pedido_id'], ['mat_pedido_itens', 'pedido_id'], ['ceu_pedido_itens', 'pedido_id'], ['mat_comentarios', 'pedido_id']] as const) {
      execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-sql-arquivo.ps1', '-Saida', `${DIR}/backup_${tab}.json`, '-Query', `select * from public.${tab} where ${col} in (${ids2})`], { stdio: 'pipe' })
    }
    execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-arquivo-sql-management-api.ps1', '-Arquivo', `${DIR}/aplicar.sql`], { stdio: 'inherit' })
    console.log('Concluído. Depois: conferir enviado_em/ordem dos envios e a fila de validação.')
  }
}

main()
