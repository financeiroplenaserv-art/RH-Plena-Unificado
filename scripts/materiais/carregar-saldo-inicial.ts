// Carga do SALDO INICIAL do estoque central de materiais (Fase 2 — migration 146).
// A gestora vai mandar a lista do estoque atual do escritório antes do dia 20/10/2026.
//
// Uso (PowerShell, na raiz do projeto):
//   npx tsx --tsconfig tsconfig.scripts.json scripts/materiais/carregar-saldo-inicial.ts --arquivo=<lista.csv|lista.xlsx> [opções]
//
//   --arquivo=...    CSV (separador ; ou ,) ou Excel (1ª aba) com as colunas item; variacao; quantidade
//                    (cabeçalho na 1ª linha; aceita também "produto", "opção"/"cor", "qtd"/"saldo").
//                    Linha sem variação = item sem variação no catálogo.
//   --data=AAAA-MM-DD  dia da contagem (padrão: hoje em Brasília)
//   --competencia=AAAA-MM  competência da contagem (padrão: o mês da data)
//   --perfil=<uuid>  quem fica registrado como autor da contagem (perfil gestor/mesa/admin).
//                    Padrão: 6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4 (perfil gestor). Confira antes de aplicar.
//   (sem --aplicar)  DRY-RUN: lê o catálogo (só SELECT), casa a lista, grava o relatório e roda a carga
//                    INTEIRA numa transação DESFEITA (rollback) — mostra quantos ajustes seriam gravados.
//                    NADA fica no banco.
//   --aplicar        só depois de conferir o relatório: backup por SELECT e a mesma carga com COMMIT.
//                    Recusa se houver pendências (use --ignorar-pendencias para gravar só as linhas casadas,
//                    depois de a gestora decidir que as pendentes ficam de fora).
//
// COMO GRAVA (decisão técnica, 19/10/2026): pelo fluxo oficial da CONTAGEM (RPCs da 146), não por
// movimento avulso — o saldo inicial é exatamente "a primeira contagem do estoque":
//   1. mat_abrir_contagem(competência, data) — abre a folha com todos os itens ativos de estoque
//      (fora os preparados no escritório);
//   2. mat_salvar_contagem — item da lista = quantidade da lista; item fora da lista = 0 (não há no
//      escritório); motivo "saldo inicial (contagem de outubro)" em todas as linhas;
//   3. mat_fechar_contagem — grava um movimento 'ajuste_contagem' por diferença (contado − saldo do
//      sistema no fechamento) com o motivo acima, e fecha a contagem da competência.
//   Por isso o tipo do movimento é 'ajuste_contagem' (os tipos 'entrada_*' da 146 são compra, sobra
//   e devolução — não descrevem um saldo inicial). Efeito colateral esperado: a contagem de outubro
//   fica FECHADA (a próxima é a de novembro, 16 a 19/11). Se já houver contagem aberta ou a de
//   outubro já estiver fechada, a RPC recusa e nada é gravado.
//
// Regra do projeto — "importação nunca grava palpite": só casamento EXATO (src/lib/materiais/saldoInicial.ts).
// NUNCA versionar dados-locais/.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import * as XLSXns from '@e965/xlsx'
import {
  casarSaldoInicial,
  indicesCabecalho,
  MOTIVO_SALDO_INICIAL,
  type AliasSaldo,
  type ItemCatalogoSaldo,
  type LinhaEntradaSaldo,
  type VariacaoCatalogoSaldo,
} from '../../src/lib/materiais/saldoInicial'

const XLSX = ((XLSXns as unknown as { default?: typeof XLSXns }).default ?? XLSXns) as typeof XLSXns

const arg = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? null
const APLICAR = process.argv.includes('--aplicar')
const IGNORAR_PENDENCIAS = process.argv.includes('--ignorar-pendencias')
const ARQUIVO = arg('arquivo')
const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const DATA = arg('data') ?? hojeBrasil()
const COMPETENCIA = `${arg('competencia') ?? DATA.slice(0, 7)}-01`
const PERFIL = arg('perfil') ?? '6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4'
const DIR = `dados-locais/saldo_inicial_${DATA}`

function falhar(msg: string): never {
  console.error(`ERRO: ${msg}`)
  process.exit(1)
}

if (!ARQUIVO) falhar('informe --arquivo=<lista.csv|lista.xlsx>')
if (!fs.existsSync(ARQUIVO)) falhar(`arquivo não encontrado: ${ARQUIVO}`)
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATA)) falhar('--data deve ser AAAA-MM-DD')
if (!/^\d{4}-\d{2}-01$/.test(COMPETENCIA)) falhar('--competencia deve ser AAAA-MM')
if (!/^[0-9a-f-]{36}$/.test(PERFIL)) falhar('--perfil deve ser um uuid')
fs.mkdirSync(path.join(DIR, 'ref'), { recursive: true })

// ---------------------------------------------------------------- leitura da lista
function lerLinhas(arquivo: string): string[][] {
  if (/\.xlsx?$/i.test(arquivo)) {
    const wb = XLSX.read(fs.readFileSync(arquivo), { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return (XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][]).map((l) => l.map((c) => String(c ?? '')))
  }
  const texto = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '')
  const primeira = texto.split(/\r?\n/)[0] ?? ''
  const sep = primeira.includes(';') ? ';' : ','
  return texto
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1')))
}

const linhas = lerLinhas(ARQUIVO)
const idx = indicesCabecalho(linhas[0] ?? [])
if (!idx) falhar('cabeçalho não reconhecido — a 1ª linha deve ter "item" e "quantidade" (e, se houver, "variacao")')
const entrada: LinhaEntradaSaldo[] = linhas.slice(1).map((l, i) => ({
  linha: i + 2,
  item: l[idx.item] ?? '',
  variacao: idx.variacao >= 0 ? (l[idx.variacao] ?? '') : '',
  quantidade: l[idx.quantidade] ?? '',
}))

// ---------------------------------------------------------------- catálogo (só SELECT)
function consultar<T>(nome: string, sql: string): T[] {
  const saida = path.join(DIR, 'ref', `${nome}.json`)
  execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-sql-arquivo.ps1', '-Saida', saida, '-Query', sql], { stdio: 'pipe' })
  return JSON.parse(fs.readFileSync(saida, 'utf8')) as T[]
}
const itens = consultar<ItemCatalogoSaldo>('itens', 'select id, nome, nome_lider, ativo, preparo_escritorio from public.mat_itens')
const variacoes = consultar<VariacaoCatalogoSaldo>('variacoes', 'select id, item_id, rotulo, ativo from public.mat_item_variacoes')
const aliases = consultar<AliasSaldo>('aliases', 'select nome_legado, item_id, variacao_id, fator from public.mat_aliases')

const { casadas, pendencias } = casarSaldoInicial(entrada, itens, variacoes, aliases)

// ---------------------------------------------------------------- relatório
const rel: string[] = [
  `Saldo inicial do estoque — ${ARQUIVO}`,
  `Contagem: competência ${COMPETENCIA.slice(0, 7)}, data ${DATA}, autor ${PERFIL}`,
  `Linhas lidas: ${entrada.length} · casadas (exato): ${casadas.length} · pendências: ${pendencias.length}`,
  '',
  'CASADAS',
  ...casadas.map((c) => `  linha ${c.linha}: ${c.itemNome}${c.variacaoRotulo ? ` — ${c.variacaoRotulo}` : ''} = ${c.quantidade}${c.via !== 'nome' ? ` (via ${c.via})` : ''}`),
  '',
  'PENDÊNCIAS (não serão gravadas)',
  ...(pendencias.length ? pendencias.map((p) => `  linha ${p.linha}: "${p.item}" / "${p.variacao}" / "${p.quantidade}" — ${p.motivo}`) : ['  nenhuma']),
  '',
  'Itens de estoque FORA da lista entram com 0 na contagem (não há no escritório).',
]
fs.writeFileSync(path.join(DIR, 'relatorio.txt'), rel.join('\n'), 'utf8')
fs.writeFileSync(
  path.join(DIR, 'pendencias.csv'),
  ['linha;item;variacao;quantidade;motivo', ...pendencias.map((p) => [p.linha, p.item, p.variacao, p.quantidade, p.motivo].join(';'))].join('\n'),
  'utf8'
)
console.log(rel.slice(0, 3).join('\n'))
console.log(`Relatório: ${DIR}/relatorio.txt`)
if (pendencias.length) console.log(`ATENÇÃO: ${pendencias.length} pendência(s) — veja ${DIR}/pendencias.csv`)
if (casadas.length === 0) falhar('nenhuma linha casada — nada a carregar')
if (APLICAR && pendencias.length && !IGNORAR_PENDENCIAS)
  falhar('há pendências: resolva na planilha (ou rode com --ignorar-pendencias, se a gestora decidiu que ficam de fora)')

// ---------------------------------------------------------------- SQL (uma transação)
const lista = JSON.stringify(casadas.map((c) => ({ item_id: c.itemId, variacao_id: c.variacaoId, quantidade: c.quantidade })))
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const sql = `begin;
create temp table t_saldo_lista (item_id uuid, variacao_id uuid, quantidade numeric) on commit drop;
insert into t_saldo_lista select (x->>'item_id')::uuid, nullif(x->>'variacao_id','')::uuid, (x->>'quantidade')::numeric
  from jsonb_array_elements(${q(lista)}::jsonb) x;
create temp table t_saldo_res (k text, v jsonb) on commit drop;
grant all on t_saldo_lista, t_saldo_res to authenticated;
select set_config('request.jwt.claims', ${q(JSON.stringify({ sub: PERFIL, role: 'authenticated' }))}, true);
set local role authenticated;
DO $carga$
DECLARE r jsonb; v_cont uuid; n_fora int;
BEGIN
  r := public.mat_abrir_contagem(${q(COMPETENCIA)}::date, ${q(DATA)}::date);
  v_cont := (r->>'id')::uuid;
  -- Item da lista que não entrou na folha (ex.: variação/linha fora do padrão): aborta.
  SELECT count(*) INTO n_fora FROM t_saldo_lista t
   WHERE NOT EXISTS (SELECT 1 FROM public.mat_estoque_contagem_itens ci
                      WHERE ci.contagem_id = v_cont AND ci.item_id = t.item_id AND ci.variacao_id IS NOT DISTINCT FROM t.variacao_id);
  IF n_fora > 0 THEN RAISE EXCEPTION 'saldo inicial: % linha(s) da lista não estão na folha da contagem', n_fora; END IF;
  PERFORM public.mat_salvar_contagem(v_cont, (
    SELECT jsonb_agg(jsonb_build_object('id', ci.id, 'quantidade_contada', coalesce(t.quantidade, 0), 'motivo', ${q(MOTIVO_SALDO_INICIAL)}))
      FROM public.mat_estoque_contagem_itens ci
      LEFT JOIN t_saldo_lista t ON t.item_id = ci.item_id AND t.variacao_id IS NOT DISTINCT FROM ci.variacao_id
     WHERE ci.contagem_id = v_cont));
  r := public.mat_fechar_contagem(v_cont);
  INSERT INTO t_saldo_res VALUES ('contagem', jsonb_build_object('id', v_cont) || r);
END $carga$;
reset role;
select jsonb_build_object(
  'resultado', (select v from t_saldo_res where k = 'contagem'),
  'linhas_da_lista', (select count(*) from t_saldo_lista),
  'movimentos_ajuste', (select count(*) from public.mat_estoque_movimentos m join public.mat_estoque_contagens c on c.id = m.contagem_id
                         where c.competencia = ${q(COMPETENCIA)}::date and c.status = 'fechada'),
  'unidades_em_estoque', (select coalesce(sum(saldo), 0) from public.mat_estoque_saldos),
  'gravado', ${APLICAR ? 'true' : 'false'}) as resumo;
${APLICAR ? 'commit;' : 'rollback;'}
`
const arqSql = path.join(DIR, APLICAR ? 'aplicar.sql' : 'previa_dry_run.sql')
fs.writeFileSync(arqSql, sql, 'utf8')

if (APLICAR) {
  // Backup por SELECT antes de gravar.
  const dirBk = path.join(DIR, 'backup_antes')
  fs.mkdirSync(dirBk, { recursive: true })
  for (const [nome, s] of [
    ['saldos', 'select * from public.mat_estoque_saldos'],
    ['contagens', 'select * from public.mat_estoque_contagens'],
    ['movimentos', 'select * from public.mat_estoque_movimentos'],
  ] as const)
    execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-sql-arquivo.ps1', '-Saida', path.join(dirBk, `${nome}.json`), '-Query', s], { stdio: 'pipe' })
  console.log(`Backup em ${dirBk}`)
}

const out = execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-arquivo-sql-management-api.ps1', '-Arquivo', arqSql], {
  encoding: 'utf-8',
  maxBuffer: 16 * 1024 * 1024,
})
fs.writeFileSync(path.join(DIR, APLICAR ? 'resultado_aplicar.txt' : 'resultado_dry_run.txt'), out, 'utf8')
console.log(out.trim().slice(0, 1500))
console.log(APLICAR ? 'APLICADO (commit).' : 'DRY-RUN: transação desfeita — nada foi gravado. Para gravar: --aplicar')
