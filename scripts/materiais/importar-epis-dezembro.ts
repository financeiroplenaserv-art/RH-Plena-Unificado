// Carga da planilha "EPIs Dezembro.26.xlsx" como pedidos do módulo Materiais, competência
// DEZEMBRO/2026. As linhas de EPI entram na fila CEU → Pedidos (da Beth) já identificadas e
// PENDENTES, a entregar (decisão da gestora).
//
// Uso:
//   npx tsx --tsconfig tsconfig.scripts.json scripts/materiais/importar-epis-dezembro.ts [opções]
//
//   (sem opções)  DRY-RUN: lê produção (SÓ SELECT), lê a planilha e grava em
//                 dados-locais/importacao_epis_dezembro_2026-11-26/ a revisão (revisao.xlsx), o
//                 resumo (resumo.md) e a PRÉVIA do SQL (aplicar.sql). NÃO escreve nada no banco.
//   --offline     reaproveita os JSONs de produção já baixados (pasta ref/).
//   --aplicar     (SÓ DEPOIS DE AUTORIZAÇÃO DA GESTORA) executa o aplicar.sql pela Management API
//                 (scripts/lib/executar-arquivo-sql-management-api.ps1, arquivo UTF-8). Cada contrato
//                 vira UMA chamada de mat_registrar_envio (mesma regra do link: se já existir pedido
//                 mensal de dezembro, o envio vira complemento), com
//                 p_user_agent = 'importado-planilha-epis-2026-12' (marca de origem). Recusa rodar
//                 com --offline e faz backup por SELECT dos pedidos de dezembro já existentes.
//
// Regra do projeto — "importação nunca grava palpite": só entra o que casa EXATO (contrato por nome,
// pessoa por nome completo na equipe, item pelo de-para confirmado pela gestora —
// docs/LANCAMENTO_MENSAL_EPIS.md e AGENTS.md §11). O resto vira pendência, com candidatos
// sugeridos DESMARCADOS. Uma pessoa com qualquer parte pendente fica INTEIRA pendente (tudo ou nada).
//
// NUNCA versionar dados-locais/ (dados pessoais). Sem CPF em nenhuma saída.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import * as XLSXns from '@e965/xlsx'
import type { DepartamentoFuzzy } from '../../src/lib/departamentos'
import { normalizarTexto } from '../../src/lib/materiais/normalizar'
import { lerPedidoEpi, limparNomePlanilha, type ParteEpi, type PecaEpi } from '../../src/lib/materiais/pedidoEpiTexto'
import {
  idsEquipeDoContrato,
  nomesCurtos,
  pecasDoContrato,
  type ConfigPecaContrato,
  type ItemCeuCadastro,
  type PecaPublica,
} from '../../src/lib/materiais/pecasCeu'
import { TERMOS_PEDIDO, validarEnvioPedido, type ContextoPedido } from '../../src/lib/materiais/pedidoLider'

const XLSX = ((XLSXns as unknown as { default?: typeof XLSXns }).default ?? XLSXns) as typeof XLSXns

const APLICAR = process.argv.includes('--aplicar')
const OFFLINE = process.argv.includes('--offline')
const PLANILHA = 'dados-locais/EPIs Dezembro.26.xlsx'
const DIR = 'dados-locais/importacao_epis_dezembro_2026-11-26'
const DIR_REF = `${DIR}/ref`
const ORIGEM = 'importado-planilha-epis-2026-12'
const COMPETENCIA = '2026-12-01'
const SEU_NOME = 'Importado da planilha de EPIs (dezembro/2026)'

/** De-para confirmado pela gestora (docs/LANCAMENTO_MENSAL_EPIS.md; AGENTS.md §11): peça → item base do CEU. */
const ITEM_BASE: Partial<Record<PecaEpi, { itemId: string; nome: string }>> = {
  luva_latex: { itemId: '32960193-784f-43a2-81aa-ce31a631edb2', nome: 'LUVA LÁTEX' },
  luva_nitrilica: { itemId: '5618dfe6-6943-4735-a5f0-ade2810cd1d1', nome: 'LUVA NITRÍLICA' },
  luva_pvc: { itemId: '18b0c768-9a78-48da-9f7b-5643967c2f78', nome: 'LUVA PVC' },
  bota: { itemId: '5bb15502-2866-4e3e-b60c-a7f441c0ec7d', nome: 'BOTA PVC CANO CURTO' },
  botina: { itemId: '72f4c14c-8785-401f-82ff-83d14a3a87e8', nome: 'BOTINA COM ELÁSTICO' },
  mascara: { itemId: '81b8a12a-dfce-4634-add1-9e656ca2e62e', nome: 'MÁSCARA RESPIRADOR COM VÁLVULA' },
  oculos: { itemId: '5541f746-ec82-4985-8254-1f48f78d1c37', nome: 'ÓCULOS LENTE INCOLOR' },
  // decisões da gestora em 26/11/2026
  avental: { itemId: '31959b47-1747-4b3f-b4ef-9b3ec1ec7980', nome: 'AVENTAL (686)' },
  luva_termica: { itemId: '706cb2b0-072a-41e0-bd76-e04bba12d11a', nome: 'LUVA TÉRMICA - Tam. 11' },
  manguito: { itemId: 'cca980ce-ffee-4ee1-a32c-c0563bb8045e', nome: 'MANGUITO' },
  luva_pigmentada: { itemId: '39cb632e-43ea-4320-ab60-8e741bfaad91', nome: 'LUVA DE MALHA PIGMENTADA (642)' },
}
/** Correções de nome por linha da planilha (gestora, 26/11/2026). */
const NOME_POR_LINHA: Record<number, string> = {
  232: 'PAULO HENRIQUE LIMA DE SOUZA',
  309: 'MARCOS VINICIUS STELLET MONTEIRO',
}
/** Contrato escolhido pela gestora quando a pessoa é equipe de vários contratos (nome normalizado → contrato). */
const CONTRATO_POR_PESSOA: Record<string, string> = {
  'ELIANA SILVINO DOS SANTOS': 'TELEX BAR, TIJ E IPA',
  'FABIANA LIMA DA SILVA': 'TELEX ICA, CENTRO NIT E CENTRO RJ',
  'MICHELLE MACHADO LIDUGERIO': 'TELEX ICA, CENTRO NIT E CENTRO RJ',
}
/** Candidatos para as peças SEM de-para (só sugestão, desmarcada). */
const CANDIDATOS_SEM_DEPARA: Partial<Record<PecaEpi, string>> = {
  avental: 'AVENTAL | AVENTAL TRANSPARENTE | AVENTAL PRETO PARA JARDINAGEM',
  luva_termica: 'LUVA TÉRMICA (Tam. 11)',
  luva_pigmentada: 'LUVA DE MALHA PIGMENTADA',
  manguito: 'MANGUITO',
}
const ROTULO_PECA: Record<PecaEpi, string> = {
  luva_latex: 'Luva látex', luva_nitrilica: 'Luva nitrílica', luva_pvc: 'Luva PVC', luva_termica: 'Luva térmica',
  luva_pigmentada: 'Luva pigmentada', bota: 'Bota', botina: 'Botina', mascara: 'Máscara', oculos: 'Óculos',
  avental: 'Avental', manguito: 'Manguito', desconhecida: 'Peça desconhecida',
}

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

interface Contrato { id: string; nome: string; departamento_id: string; recebe_limpeza: boolean; ativo: boolean; departamentos_equipe_extra: string[] | null }
interface ColabApoio { id: string; nome_completo: string; cargo: string | null; departamento_id: string | null; departamento: string | null }
interface ItemCeu { id: string; nome: string; tipo: string; situacao: string | null; compra_na_loja: boolean; codigo: string | null }

// ---------- saídas ----------
interface LinhaEntra { contrato: string; pessoa: string; peca: string; item: string; codigo: string; tamanho: string; quantidade: number; como: string; original: string; foraKit: boolean }
interface LinhaPend { contrato: string; pessoa: string; textoOriginal: string; categoria: string; motivo: string; candidatos: string; linha: number }
interface LinhaIgn { linha: number; contrato: string; pessoa: string; texto: string; motivo: string }
interface MapaContrato { contratoPlanilha: string; casamento: string; contratoBanco: string; pessoas: number; candidatos: string }
interface ResumoContrato { contrato: string; contratoBanco: string; linhasPlanilha: number; ignoradas: number; pessoasEntram: number; linhasEntram: number; unidades: number; pessoasPendentes: number }

function main() {
  console.log(`Modo: ${APLICAR ? 'APLICAR (grava no banco)' : 'DRY-RUN (nada é gravado)'}${OFFLINE ? ' [offline]' : ''}`)
  fs.mkdirSync(DIR, { recursive: true })
  if (APLICAR && OFFLINE) throw new Error('--aplicar não pode ser usado com --offline')

  const contratos = consultar<Contrato>('contratos', 'select id, nome, departamento_id, recebe_limpeza, ativo, departamentos_equipe_extra from public.mat_contratos order by nome')
  const deps = consultar<DepartamentoFuzzy>('departamentos', 'select id, nome, nome_curto, empresa_id, status from public.departamentos')
  const colabs = consultar<ColabApoio>('colaboradores', "select id, nome_completo, cargo, departamento_id, departamento from public.colaboradores where status = 'Ativo'")
  const itensCeu = consultar<ItemCeu>('itens_ceu', "select id, nome, tipo, situacao, compra_na_loja, codigo from public.itens where tipo in ('Uniforme','EPI')")
  const cfgCeu = consultar<ConfigPecaContrato & { contrato_id: string }>('cfg_ceu', 'select contrato_id, item_id, rotulo, funcoes, ordem, ativo from public.mat_contrato_ceu_itens')
  const pedidosDez = consultar<{ id: string; contrato: string; tipo: string; status_produtos: string; status_ceu: string; envios: number; ceu: number }>(
    'pedidos_dezembro',
    `select p.id, c.nome contrato, p.tipo, p.status_produtos, p.status_ceu, (select count(*) from public.mat_pedido_envios e where e.pedido_id=p.id) envios, (select count(*) from public.ceu_pedido_itens x where x.pedido_id=p.id) ceu from public.mat_pedidos p join public.mat_contratos c on c.id=p.contrato_id where p.competencia = date '${COMPETENCIA}' order by c.nome`
  )

  const depPorId = new Map(deps.map((d) => [d.id, d]))
  const itemCeuPorId = new Map(itensCeu.map((i) => [i.id, i]))
  const itensCeuCad: ItemCeuCadastro[] = itensCeu.map((i) => ({
    id: i.id, nome: i.nome, tipo: i.tipo === 'EPI' ? 'epi' : 'uniforme', ativo: !i.situacao || i.situacao.toUpperCase() === 'A', compra_na_loja: i.compra_na_loja === true,
  }))
  const pecasGlobais = pecasDoContrato([], itensCeuCad).pecas
  const rotuloDep = (c: ColabApoio) => {
    const d = c.departamento_id ? depPorId.get(c.departamento_id) : undefined
    return (d?.nome_curto?.trim() || d?.nome || c.departamento || '(sem departamento)').toString()
  }

  // ---- contratos ativos + equipes ----
  const contratosAtivos = contratos.filter((c) => c.ativo)
  const equipeIds = new Map<string, Set<string>>()
  for (const c of contratosAtivos) equipeIds.set(c.id, idsEquipeDoContrato(deps, colabs, [c.departamento_id, ...(c.departamentos_equipe_extra ?? [])]))
  const contratosDaPessoa = (colabId: string) => contratosAtivos.filter((c) => equipeIds.get(c.id)?.has(colabId)).map((c) => c.nome)
  const colabPorNome = new Map<string, ColabApoio[]>()
  for (const c of colabs) {
    const k = norm(c.nome_completo)
    colabPorNome.set(k, [...(colabPorNome.get(k) ?? []), c])
  }

  // ---- planilha ----
  if (!fs.existsSync(PLANILHA)) throw new Error(`Planilha não encontrada: ${PLANILHA}`)
  const wb = XLSX.read(fs.readFileSync(PLANILHA))
  const folha = wb.Sheets['Plan1'] ?? wb.Sheets[wb.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(folha, { header: 1, defval: null, raw: false }) as unknown[][]
  interface LinhaPlan { linha: number; contratoPlan: string; nomeBruto: string; texto: string }
  const dados: LinhaPlan[] = []
  let contratoAtual = ''
  linhas.forEach((r, i) => {
    const a = String(r[0] ?? '').trim()
    if (a) contratoAtual = a
    const nome = String(r[1] ?? '').trim()
    const texto = String(r[2] ?? '').trim()
    if (norm(nome) === 'funcionario' || (!nome && !texto && !a)) return
    dados.push({ linha: i + 1, contratoPlan: contratoAtual, nomeBruto: NOME_POR_LINHA[i + 1] ?? nome, texto })
  })

  // ---- casamento de contratos ----
  const mapa: MapaContrato[] = []
  const contratoDoGrupo = new Map<string, Contrato | null>()
  // Decisões da gestora: { "CHÁCARA ITAGUAÍ": "ITAGUAÍ" } (nome na planilha → nome do contrato de pedido); lido se existir.
  const decisoesArq = `${DIR}/decisoes_contratos.json`
  const decisoesContrato: Record<string, string> = fs.existsSync(decisoesArq) ? JSON.parse(fs.readFileSync(decisoesArq, 'utf-8')) : {}
  const nomesPlanilha = [...new Set(dados.map((d) => d.contratoPlan))]
  for (const nomePlan of nomesPlanilha) {
    const k = norm(nomePlan)
    const doGrupo = dados.filter((d) => d.contratoPlan === nomePlan)
    const pessoasGrupo = doGrupo.filter((d) => d.nomeBruto)
    // 1) nome do contrato de pedido; 2) nome_curto do departamento (só se único)
    const porNome = contratosAtivos.filter((c) => norm(c.nome) === k)
    const porCurto = contratosAtivos.filter((c) => {
      const d = depPorId.get(c.departamento_id)
      return !!d && (norm(d.nome_curto) === k || norm(d.nome) === k)
    })
    let achado: Contrato | null = null
    let casamento = ''
    const decidido = decisoesContrato[nomePlan] ? contratosAtivos.find((c) => norm(c.nome) === norm(decisoesContrato[nomePlan])) : undefined
    if (decidido) { achado = decidido; casamento = 'decisão da gestora (decisoes_contratos.json)' }
    else if (porNome.length === 1) { achado = porNome[0]; casamento = 'nome exato do contrato' }
    else if (porNome.length === 0 && porCurto.length === 1) { achado = porCurto[0]; casamento = 'nome_curto/nome do departamento do contrato' }
    else if (porNome.length + porCurto.length > 1) casamento = 'AMBÍGUO — mais de um contrato com esse nome'
    else casamento = 'SEM CASAMENTO'

    // candidatos (desmarcados): sobreposição de palavras no nome + equipe que contém as pessoas listadas
    const toks = k.split(' ').filter((t) => t.length >= 4)
    const porPalavra = contratosAtivos.filter((c) => {
      const d = depPorId.get(c.departamento_id)
      const alvo = `${norm(c.nome)} ${norm(d?.nome_curto)} ${norm(d?.nome)}`
      return toks.some((t) => alvo.includes(t)) || norm(c.nome).split(' ').some((t) => t.length >= 4 && k.includes(t))
    })
    const porEquipe = new Map<string, number>()
    for (const p of pessoasGrupo) {
      for (const c of colabPorNome.get(norm(limparNomePlanilha(p.nomeBruto))) ?? []) for (const cn of contratosDaPessoa(c.id)) porEquipe.set(cn, (porEquipe.get(cn) ?? 0) + 1)
    }
    const cand: string[] = []
    if (!achado) {
      for (const c of porPalavra.slice(0, 4)) cand.push(`${c.nome} (parte do nome)`)
      for (const [cn, n] of [...porEquipe.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) cand.push(`${cn} (${n} de ${pessoasGrupo.length} pessoas desta aba estão na equipe)`)
    }
    contratoDoGrupo.set(nomePlan, achado)
    mapa.push({ contratoPlanilha: nomePlan, casamento, contratoBanco: achado?.nome ?? '—', pessoas: pessoasGrupo.length, candidatos: [...new Set(cand)].join(' | ') })
  }

  // ---- processamento por linha ----
  const entra: LinhaEntra[] = []
  const pend: LinhaPend[] = []
  const ign: LinhaIgn[] = []
  const resumos = new Map<string, ResumoContrato>()
  const resumoDe = (nomePlan: string) => {
    let r = resumos.get(nomePlan)
    if (!r) { r = { contrato: nomePlan, contratoBanco: contratoDoGrupo.get(nomePlan)?.nome ?? '—', linhasPlanilha: 0, ignoradas: 0, pessoasEntram: 0, linhasEntram: 0, unidades: 0, pessoasPendentes: 0 }; resumos.set(nomePlan, r) }
    return r
  }
  const pessoasPendPorCategoria = new Map<string, number>()
  const partesPendPorCategoria = new Map<string, number>()

  // envios por contrato (entrada para validação / SQL)
  interface Envio { contrato: Contrato; entCeu: Record<string, unknown>[]; refParaColab: Map<string, string>; ctx: ContextoPedido; pessoas: number }
  const envios = new Map<string, Envio>()
  const contextoDoContrato = (contrato: Contrato) => {
    let e = envios.get(contrato.id)
    if (e) return e
    const equipe = colabs.filter((c) => equipeIds.get(contrato.id)?.has(c.id) && c.nome_completo).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'))
    const curtos = nomesCurtos(equipe.map((x) => x.nome_completo))
    const refParaColab = new Map<string, string>()
    const equipePublica = equipe.map((x, i) => { const ref = `ref${String(i).padStart(9, '0')}`; refParaColab.set(ref, x.id); return { ref, nome: curtos[i], funcao: null } })
    const cfg = cfgCeu.filter((c) => c.contrato_id === contrato.id)
    const doKit = pecasDoContrato(cfg, itensCeuCad)
    // Peças do contrato primeiro; as do catálogo fora do kit entram só para o item existir (marcadas "fora do kit").
    const idsKit = new Set(doKit.pecas.map((p) => p.id))
    const pecas: PecaPublica[] = [...doKit.pecas, ...pecasGlobais.filter((p) => !idsKit.has(p.id))]
    const itensCtx: ContextoPedido['itensCeu'] = []
    const vistos = new Set<string>()
    for (const p of pecas) for (const o of p.opcoes) if (!vistos.has(o.item_id)) { vistos.add(o.item_id); itensCtx.push({ id: o.item_id, nome: itemCeuPorId.get(o.item_id)?.nome ?? p.rotulo, tipo: p.tipo }) }
    const ctx: ContextoPedido = {
      hoje: COMPETENCIA, recebeLimpeza: contrato.recebe_limpeza, catalogo: [], kit: [], indisponiveis: [],
      itensCeu: itensCtx, pecas, equipe: equipePublica, ultimasEntregas: {}, precos: [], kitConfirmado: false,
    }
    ;(ctx as unknown as { _idsKit: Set<string> })._idsKit = idsKit
    e = { contrato, entCeu: [], refParaColab, ctx, pessoas: 0 }
    envios.set(contrato.id, e)
    return e
  }

  /** Resolve uma parte do texto em item/tamanho do catálogo (só de-para confirmado). */
  function resolverParte(parte: ParteEpi, ctx: ContextoPedido): { ok: true; itemId: string; itemNome: string; codigo: string; tamanho: string; peca: PecaPublica; como: string; foraKit: boolean } | { ok: false; motivo: string; candidatos: string } {
    if (parte.pendencia) return { ok: false, motivo: parte.pendencia, candidatos: CANDIDATOS_SEM_DEPARA[parte.peca] ?? '' }
    const base = ITEM_BASE[parte.peca]
    if (!base) return { ok: false, motivo: `peça "${parte.texto}" sem de-para`, candidatos: CANDIDATOS_SEM_DEPARA[parte.peca] ?? '' }
    const itemBase = itemCeuPorId.get(base.itemId)
    if (!itemBase) return { ok: false, motivo: `item base ${base.nome} não existe no catálogo`, candidatos: '' }
    const peca = ctx.pecas.find((p) => p.opcoes.some((o) => o.item_id === base.itemId))
    if (!peca) return { ok: false, motivo: `peça ${base.nome} não está ativa no catálogo`, candidatos: '' }
    const tam = parte.tamanho ?? ''
    const opcao = peca.opcoes.find((o) => o.tamanho.toUpperCase() === tam.toUpperCase()) ?? (!tam && peca.opcoes.length === 1 ? peca.opcoes[0] : undefined)
    if (!opcao) {
      return { ok: false, motivo: `tamanho ${tam || '(sem)'} não existe para ${peca.rotulo} (existentes: ${peca.opcoes.map((o) => o.tamanho || 'único').join(', ')})`, candidatos: '' }
    }
    const item = itemCeuPorId.get(opcao.item_id)!
    const idsKit = (ctx as unknown as { _idsKit: Set<string> })._idsKit
    return { ok: true, itemId: opcao.item_id, itemNome: item.nome, codigo: item.codigo ?? '', tamanho: opcao.tamanho, peca, como: [`peça ${peca.rotulo}`, parte.dePara].filter(Boolean).join('; '), foraKit: !idsKit.has(peca.id) }
  }

  /** Procura a pessoa por NOME COMPLETO exato; devolve diagnóstico. */
  function candidatosDeNome(nomeLimpo: string, universo: ColabApoio[]): string {
    const t = norm(nomeLimpo).split(' ').filter(Boolean)
    if (t.length === 0) return ''
    const out: string[] = []
    for (const c of universo) {
      const ct = norm(c.nome_completo).split(' ').filter(Boolean)
      const prefixo = norm(c.nome_completo).startsWith(norm(nomeLimpo)) || norm(nomeLimpo).startsWith(norm(c.nome_completo))
      const mesmaPonta = ct[0] === t[0] && ct[ct.length - 1] === t[t.length - 1]
      if (prefixo || mesmaPonta) out.push(`${c.nome_completo} [${rotuloDep(c)}]`)
      if (out.length >= 3) break
    }
    return out.join(' | ')
  }

  for (const d of dados) {
    const contrato = contratoDoGrupo.get(d.contratoPlan) ?? null
    const rs = resumoDe(d.contratoPlan)
    rs.linhasPlanilha++
    const lido = lerPedidoEpi(d.texto)
    if (lido.tipo === 'ignorar') {
      rs.ignoradas++
      ign.push({ linha: d.linha, contrato: d.contratoPlan, pessoa: d.nomeBruto, texto: d.texto, motivo: lido.motivo })
      continue
    }
    const nomeLimpo = limparNomePlanilha(d.nomeBruto)
    const pessoaTxt = d.nomeBruto || '(sem nome)'
    const falha = (categoria: string, motivo: string, candidatos = '') => {
      pend.push({ contrato: d.contratoPlan, pessoa: pessoaTxt, textoOriginal: d.texto, categoria, motivo, candidatos, linha: d.linha })
      pessoasPendPorCategoria.set(categoria, (pessoasPendPorCategoria.get(categoria) ?? 0) + 1)
      rs.pessoasPendentes++
    }

    // nome na planilha parece ser um pedido (célula do nome com o texto do pedido) ou vazio
    if (!nomeLimpo || lerPedidoEpi(nomeLimpo).tipo === 'pedido' && /^\d{1,2}\s/.test(nomeLimpo)) {
      falha('Nome inválido na planilha', `a coluna do nome traz "${d.nomeBruto}" (parece um pedido, não um nome) — conferir a linha ${d.linha}`)
      continue
    }
    // Decisão da gestora (26/11/2026): o posto do CORH está atualizado — vale o contrato
    // da equipe da pessoa no CORH, não a aba da planilha. Só com nome completo EXATO e único.
    const exatos = colabPorNome.get(norm(nomeLimpo)) ?? []
    if (exatos.length > 1) { falha('Nome ambíguo', `mais de um colaborador ativo com o nome "${nomeLimpo}"`, exatos.map((c) => `${c.nome_completo} [${rotuloDep(c)}]`).join(' | ')); continue }
    if (exatos.length === 0) {
      const universo = contrato ? colabs.filter((c) => equipeIds.get(contrato.id)?.has(c.id)) : colabs
      const sug = candidatosDeNome(nomeLimpo, universo) || candidatosDeNome(nomeLimpo, colabs)
      falha('Pessoa não encontrada', `"${nomeLimpo}" não é colaborador ativo com esse nome completo`, sug)
      continue
    }
    const colab = exatos[0]
    const contratosCorh = contratosAtivos.filter((c) => equipeIds.get(c.id)?.has(colab.id))
    let contratoUsado: Contrato
    let notaPosto = ''
    if (contrato && contratosCorh.some((c) => c.id === contrato.id)) contratoUsado = contrato
    else if (contratosCorh.length === 1) {
      contratoUsado = contratosCorh[0]
      notaPosto = `; posto pelo CORH (${rotuloDep(colab)}) — na planilha estava em ${d.contratoPlan}`
    } else if (contratosCorh.length === 0) {
      falha('Posto do CORH sem contrato de pedido', `"${colab.nome_completo}" está lotada em ${rotuloDep(colab)}, que não é equipe de nenhum contrato de pedido (planilha: ${d.contratoPlan})`)
      continue
    } else if (CONTRATO_POR_PESSOA[norm(colab.nome_completo).toUpperCase()] && contratosCorh.some((c) => norm(c.nome) === norm(CONTRATO_POR_PESSOA[norm(colab.nome_completo).toUpperCase()]))) {
      contratoUsado = contratosCorh.find((c) => norm(c.nome) === norm(CONTRATO_POR_PESSOA[norm(colab.nome_completo).toUpperCase()]))!
      notaPosto = '; contrato escolhido pela gestora (equipe de vários contratos Telex)'
    } else {
      falha('Posto do CORH em mais de um contrato', `"${colab.nome_completo}" (${rotuloDep(colab)}) é equipe de: ${contratosCorh.map((c) => c.nome).join(', ')} — escolher um (planilha: ${d.contratoPlan})`, contratosCorh.map((c) => c.nome).join(' | '))
      continue
    }
    const env = contextoDoContrato(contratoUsado)
    const ref = [...env.refParaColab.entries()].find(([, id]) => id === colab.id)?.[0] ?? null

    // itens
    const resolvidas = lido.partes.map((p) => ({ parte: p, r: resolverParte(p, env.ctx) }))
    const ruins = resolvidas.filter((x) => !x.r.ok)
    if (ruins.length > 0) {
      for (const x of ruins) {
        const r = x.r as { ok: false; motivo: string; candidatos: string }
        pend.push({ contrato: d.contratoPlan, pessoa: pessoaTxt, textoOriginal: d.texto, categoria: 'Peça/tamanho sem de-para', motivo: r.motivo, candidatos: r.candidatos, linha: d.linha })
        partesPendPorCategoria.set('Peça/tamanho sem de-para', (partesPendPorCategoria.get('Peça/tamanho sem de-para') ?? 0) + 1)
      }
      for (const x of resolvidas.filter((y) => y.r.ok)) {
        pend.push({ contrato: d.contratoPlan, pessoa: pessoaTxt, textoOriginal: d.texto, categoria: 'Parte pronta retida (outra parte da mesma pessoa pendente)', motivo: `"${x.parte.texto}" casaria, mas a pessoa fica inteira pendente (tudo ou nada)`, candidatos: '', linha: d.linha })
      }
      pessoasPendPorCategoria.set('Peça/tamanho sem de-para', (pessoasPendPorCategoria.get('Peça/tamanho sem de-para') ?? 0) + 1)
      rs.pessoasPendentes++
      continue
    }

    // tudo certo: junta linhas iguais (mesmo item+tamanho) da pessoa
    const juntas = new Map<string, { itemId: string; tamanho: string; quantidade: number; partes: typeof resolvidas }>()
    for (const x of resolvidas) {
      const r = x.r as Extract<ReturnType<typeof resolverParte>, { ok: true }>
      const k = `${r.itemId}|${r.tamanho}`
      const j = juntas.get(k) ?? { itemId: r.itemId, tamanho: r.tamanho, quantidade: 0, partes: [] }
      j.quantidade += x.parte.quantidade
      j.partes.push(x)
      juntas.set(k, j)
    }
    let entrouAlgo = false
    for (const j of juntas.values()) {
      const r = j.partes[0].r as Extract<ReturnType<typeof resolverParte>, { ok: true }>
      env.entCeu.push({ chave: `e${env.entCeu.length}`, tipo: 'epi', colaborador_ref: ref, item_id: j.itemId, tamanho: j.tamanho, quantidade: j.quantidade })
      entra.push({
        contrato: contratoUsado.nome, pessoa: colab.nome_completo, peca: ROTULO_PECA[j.partes[0].parte.peca], item: r.itemNome, codigo: r.codigo, tamanho: j.tamanho,
        quantidade: j.quantidade, como: r.como + notaPosto + (r.foraKit ? '; AVISO: peça fora do kit de uniforme/EPI deste contrato' : ''), original: d.texto, foraKit: r.foraKit,
      })
      rs.linhasEntram++
      rs.unidades += j.quantidade
      entrouAlgo = true
    }
    if (entrouAlgo) { rs.pessoasEntram++; env.pessoas++ }
  }

  // ---- validação com a MESMA regra do link ----
  const errosValidacao: string[] = []
  const entradas: { env: Envio; v: ReturnType<typeof validarEnvioPedido> }[] = []
  for (const env of envios.values()) {
    if (env.entCeu.length === 0) continue
    const entrada = { seu_nome: SEU_NOME, observacao: 'Carga da planilha de EPIs de dezembro/2026', termos: Object.fromEntries(TERMOS_PEDIDO.map((t) => [t.id, true])), produtos: [], ceu: env.entCeu }
    const v = validarEnvioPedido(entrada, env.ctx)
    if (!v.ok) for (const e of v.errosCampo) errosValidacao.push(`${env.contrato.nome}: ${e.campo} — ${e.mensagem}`)
    entradas.push({ env, v })
  }

  // ---- prévia do SQL ----
  const sql: string[] = ['-- PRÉVIA gerada pelo dry-run. NÃO foi executada.', `-- Origem das linhas: p_user_agent = '${ORIGEM}' | competência ${COMPETENCIA}`]
  let chamadas = 0
  for (const { env, v } of entradas.sort((a, b) => a.env.contrato.nome.localeCompare(b.env.contrato.nome, 'pt-BR'))) {
    if (!v.ok) { sql.push(`-- ${env.contrato.nome}: NÃO entra — falha na validação do link (ver resumo)`); continue }
    const ceu = v.ceu.map(({ colaborador_ref, ...l }) => ({ ...l, colaborador_id: colaborador_ref ? env.refParaColab.get(colaborador_ref) ?? null : null }))
    sql.push(`-- ${env.contrato.nome} — ${env.pessoas} pessoa(s), ${ceu.length} linha(s)`)
    sql.push(`select public.mat_registrar_envio(${q(env.contrato.id)}::uuid, date ${q(COMPETENCIA)}, ${q(v.seuNome)}, ${q(JSON.stringify(v.termos))}::jsonb, ${q(v.observacao)}, null, ${q(ORIGEM)}, ${q(JSON.stringify(v.produtos))}::jsonb, ${q(JSON.stringify(ceu))}::jsonb);`)
    chamadas++
  }
  fs.writeFileSync(`${DIR}/aplicar.sql`, sql.join('\n') + '\n', 'utf8')

  escreverSaidas({ entra, pend, ign, mapa, resumos: [...resumos.values()], pedidosDez, pessoasPendPorCategoria, partesPendPorCategoria, errosValidacao, chamadas, dados, contratosEnvolvidos: entradas.map((x) => x.env.contrato.nome) })

  if (APLICAR) {
    if (errosValidacao.length > 0) throw new Error('Há erros de validação — nada foi gravado.')
    fs.writeFileSync(`${DIR}/backup_pedidos_dezembro_antes.json`, JSON.stringify(pedidosDez, null, 1), 'utf8')
    console.log('\n--aplicar: executando o SQL...')
    execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-arquivo-sql-management-api.ps1', '-Arquivo', `${DIR}/aplicar.sql`], { stdio: 'inherit' })
  }
}

function escreverSaidas(d: {
  entra: LinhaEntra[]; pend: LinhaPend[]; ign: LinhaIgn[]; mapa: MapaContrato[]; resumos: ResumoContrato[]
  pedidosDez: { id: string; contrato: string; tipo: string; status_produtos: string; status_ceu: string; envios: number; ceu: number }[]
  pessoasPendPorCategoria: Map<string, number>; partesPendPorCategoria: Map<string, number>; errosValidacao: string[]; chamadas: number
  dados: { linha: number }[]; contratosEnvolvidos: string[]
}) {
  const wb = XLSX.utils.book_new()
  const add = (nome: string, cab: string[], linhas: (string | number | null)[][], larguras: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas])
    ws['!cols'] = larguras.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, nome)
  }
  const pessoasEntram = d.resumos.reduce((s, r) => s + r.pessoasEntram, 0)
  const unidades = d.entra.reduce((s, l) => s + l.quantidade, 0)
  const ignPorMotivo = new Map<string, number>()
  for (const i of d.ign) ignPorMotivo.set(i.motivo, (ignPorMotivo.get(i.motivo) ?? 0) + 1)

  const resumoLinhas: (string | number | null)[][] = [
    ['Linhas lidas da planilha (pessoas)', d.dados.length],
    ['Ignoradas (demitido, não precisa, sem pedido, etc.)', d.ign.length],
    ...[...ignPorMotivo.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => [`   ${m}`, n] as (string | number)[]),
    ['Pessoas que ENTRAM (prontas)', pessoasEntram],
    ['Linhas de pedido que entram (item × tamanho)', d.entra.length],
    ['Unidades de EPI que entram', unidades],
    ['Contratos com envio previsto', d.chamadas],
    ['Pessoas PENDENTES', [...d.pessoasPendPorCategoria.values()].reduce((s, n) => s + n, 0)],
    ...[...d.pessoasPendPorCategoria.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => [`   ${c}`, n] as (string | number)[]),
    ['Erros de validação do link', d.errosValidacao.length],
  ]
  add('Resumo', ['Item', 'Valor'], resumoLinhas, [60, 12])
  add('Resumo por contrato', ['Contrato (planilha)', 'Contrato (banco)', 'Linhas na planilha', 'Ignoradas', 'Pessoas que entram', 'Linhas que entram', 'Unidades', 'Pessoas pendentes'],
    d.resumos.map((r) => [r.contrato, r.contratoBanco, r.linhasPlanilha, r.ignoradas, r.pessoasEntram, r.linhasEntram, r.unidades, r.pessoasPendentes]), [32, 32, 12, 10, 12, 12, 10, 12])
  add('Vai entrar', ['Contrato', 'Pessoa', 'Peça', 'Item do catálogo', 'Código', 'Tamanho', 'Quantidade', 'Como casou', 'Texto original da planilha'],
    d.entra.map((l) => [l.contrato, l.pessoa, l.peca, l.item, l.codigo, l.tamanho, l.quantidade, l.como, l.original]), [28, 38, 16, 40, 8, 8, 10, 50, 50])
  add('Pendências', ['Linha da planilha', 'Contrato', 'Pessoa', 'Texto original', 'Tipo', 'Motivo', 'Candidatos (desmarcados)', 'Decisão'],
    d.pend.map((p) => [p.linha, p.contrato, p.pessoa, p.textoOriginal, p.categoria, p.motivo, p.candidatos, '']), [8, 28, 38, 44, 34, 70, 60, 24])
  add('Mapa de contratos', ['Contrato na planilha', 'Casamento', 'Contrato no banco', 'Pessoas listadas', 'Candidatos (desmarcados)', 'Decisão'],
    d.mapa.map((m) => [m.contratoPlanilha, m.casamento, m.contratoBanco, m.pessoas, m.candidatos, '']), [34, 42, 34, 10, 90, 24])
  add('Ignorados', ['Linha', 'Contrato', 'Pessoa', 'Texto', 'Motivo'], d.ign.map((i) => [i.linha, i.contrato, i.pessoa, i.texto, i.motivo]), [8, 28, 44, 34, 24])
  add('Pedidos de dezembro existentes', ['Pedido', 'Contrato', 'Tipo', 'Status produtos', 'Status CEU', 'Envios', 'Linhas CEU'],
    d.pedidosDez.map((p) => [p.id, p.contrato, p.tipo, p.status_produtos, p.status_ceu, p.envios, p.ceu]), [38, 30, 10, 16, 14, 8, 10])
  fs.writeFileSync(`${DIR}/revisao2.xlsx`, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

  const semCasar = d.mapa.filter((m) => m.contratoBanco === '—')
  const md = [
    '# Carga de EPIs — dezembro/2026 (DRY-RUN, nada foi gravado)',
    '',
    `- Pessoas que entram: ${pessoasEntram} (${d.entra.length} linhas, ${unidades} unidades) em ${d.chamadas} contrato(s)`,
    `- Pessoas pendentes: ${[...d.pessoasPendPorCategoria.values()].reduce((s, n) => s + n, 0)}`,
    ...[...d.pessoasPendPorCategoria.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `  - ${c}: ${n}`),
    `- Ignoradas: ${d.ign.length} (${[...ignPorMotivo.entries()].map(([m, n]) => `${m}: ${n}`).join('; ')})`,
    `- Contratos da planilha sem casamento: ${semCasar.length} — ${semCasar.map((m) => m.contratoPlanilha).join(', ')}`,
    `- Pedidos de dezembro/2026 já existentes: ${d.pedidosDez.length}${d.pedidosDez.length ? ' — ' + d.pedidosDez.map((p) => p.contrato).join(', ') : ''}`,
    `- Erros de validação do link: ${d.errosValidacao.length}${d.errosValidacao.length ? '\n' + d.errosValidacao.map((e) => '  - ' + e).join('\n') : ''}`,
    '',
    `Marca de origem: p_user_agent = '${ORIGEM}'. Detalhes em revisao.xlsx. Prévia do SQL em aplicar.sql.`,
  ]
  fs.writeFileSync(`${DIR}/resumo.md`, md.join('\n') + '\n', 'utf8')
  console.log(md.join('\n'))
}

main()
