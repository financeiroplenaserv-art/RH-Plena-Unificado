// Corrige as 1.913 entregas ligadas ao item errado pela importação do
// histórico de 13/07/2026 (incidente CEU — ver AGENTS.md §11 e
// dados-locais/investigacao_revisao_independente_2026-10-14/relatorio_revisao.md,
// seção 8). Cada correção é feita UMA VEZ POR ENTREGA via RPC auditada
// `corrigir_item_entrega(p_entrega_id, p_novo_item_id, p_motivo, p_snapshot_item)`
// (migration à parte — o script falha se a RPC não existir).
//
// A prova de cada alvo é o CÓDIGO do sistema antigo (PDF extraído), nunca
// palpite: LUVA LATEX G/M/P → 619/618/617; CAMISA MALHA AZUL - ASG → 312;
// CAMISA MALHA POLO BEGE → 314; PROTETOR FACIAL COM CONTRACHAPA → 645;
// CALÇA EM BRIM AZUL M → 673 Tam. M; JALECO MANGA LONGA → 675 (Hamires,
// já correto) e 677 Tam. GG (Ricardo, 10/01/2026). Casos pequenos
// identificados por ID explícito (pessoa+data no PDF antigo).
//
// CA das luvas látex POR DATA DA ENTREGA (nota w5_NOTA_CA_MARIA_IZABEL.md):
//   data_entrega <= 2026-05-31 → CA '10.695' (sistema antigo)
//   data_entrega 2026-06-02..30 → SEM CA (decisão da gestão: zona sem prova)
//   demais (01/06 e 01/07/2026)  → CA '45.629' (recibo REC-00002 e papéis de 01/07)
//
// Uso:
//   node scripts/corrigir-itens-historico-ceu.mjs            # dry-run (padrão):
//             só SELECTs; gera dados-locais/correcao_itens_ceu_2026-10-14/plano_correcao.json
//             e imprime o relatório linha a linha
//   node scripts/corrigir-itens-historico-ceu.mjs --aplicar
//             lê o plano_correcao.json gerado no dry-run (RECUSA aplicar sem
//             ele), reconfere cada entrega no banco e chama a RPC por entrega
//
// NUNCA toca em: numero_recibo, recibo_emitido, quantidade, data_entrega,
// colaborador_id (a RPC também não mexe nisso). As 2 luvas de corte
// verdadeiras (02/03/2026), as 5 CALÇA JEANS e os 5 JALECO MANGA CURTA
// ficam fora por prova fraca (decisão pendente da gestão).

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

function carregarEnv(caminho) {
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const APLICAR = process.argv.includes('--aplicar')

const PASTA = 'dados-locais/correcao_itens_ceu_2026-10-14'
const ARQUIVO_PLANO = `${PASTA}/plano_correcao.json`
const MOTIVO =
  'Correção do incidente de 13/07/2026 — item errado na importação do histórico (relatorio_revisao.md)'

// ---------- alvos (códigos do sistema antigo = códigos do catálogo CORH) ----------
const ID_LUVA_CORTE = '2cbb14ab-98e3-400e-b1df-5384e070fbe9' // 719 (item errado)
const ID_CAMISA_331 = '0e528c08-54ff-45f4-a1af-12fc54d4b106' // 331 (item errado)

// Casos pequenos: ID da entrega → código do item alvo (prova pessoa+data no
// PDF do sistema antigo; ver RELATORIO_DRYRUN.md)
const CASOS_PEQUENOS = {
  '904ce94b-7fef-498e-a080-31272e80b727': '673', // Hamires, 14/04/2025 — PDF: cod 673
  '59f2b630-8780-42b1-8677-c572a921568b': '673', // Hamires, 10/10/2025 — PDF: cod 673
  '2bf76190-5dc7-42b5-a154-5af2b2b993ba': '675', // Hamires, 14/04/2025 — PDF: cod 675 (já correto)
  '8c0cf7b8-c1aa-4c33-a3d3-3371185bf1f3': '677', // Ricardo, 10/01/2026 — PDF: cod 677 (Tam. GG)
  'a95f490a-d28b-4fa5-aff7-433637d4ea25': '645', // Marcos Antonio, 01/05/2025 — PDF: cod 645
  '355b53ea-e914-418f-a25c-007c0d0303ea': '645', // Ricardo, 01/06/2026 — descrição literal
  // (protetor "COM CONTRACHAPA INCOLOR" só existe como código 645; o PDF do
  // Ricardo termina em 04/2026 e não cobre esta data — ver relatório)
}

const CODIGOS_ALVO = ['617', '618', '619', '312', '314', '645', '673', '675', '677']

// CA histórico da luva látex por data da entrega (regra da gestão, w5):
// até 31/05/2026 → 10.695; 01/06 e 01/07/2026 → 45.629 (01/07 comprovado pelo
// recibo REC-00002 do sistema antigo, que diz "CA: 45.629"); as 3 entregas de
// 02–30/06/2026 ficam SEM CA (decisão da gestão em 14/10/2026: sem prova de
// papel da época, não inventar — corrigem o item, mas o CA fica vazio).
const CA_LUVA_ATE = '2026-05-31' // até aqui → 10.695
function caLuva(dataEntrega) {
  if (dataEntrega <= CA_LUVA_ATE) return '10.695'
  if (dataEntrega >= '2026-06-02' && dataEntrega <= '2026-06-30') return ''
  return '45.629'
}

async function buscarPaginado(montar) {
  const linhas = []
  const PASSO = 1000
  for (let i = 0; ; i += PASSO) {
    const { data, error } = await montar().range(i, i + PASSO - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    linhas.push(...data)
    if (data.length < PASSO) break
  }
  return linhas
}

const COLUNAS =
  'id, colaborador_id, item_id, data_entrega, quantidade, observacao, situacao, recibo_emitido, numero_recibo, matricula, snapshot_item'

// ---------- coleta das entregas alvo (somente SELECT) ----------
async function buscarEntregasAlvo() {
  const luvas = await buscarPaginado(() =>
    supabase.from('entregas').select(COLUNAS).eq('item_id', ID_LUVA_CORTE).ilike('observacao', '%LUVA LATEX%')
  )
  const camisasAzul = await buscarPaginado(() =>
    supabase.from('entregas').select(COLUNAS).eq('item_id', ID_CAMISA_331).ilike('observacao', '%CAMISA MALHA AZUL - ASG%')
  )
  const camisasBege = await buscarPaginado(() =>
    supabase.from('entregas').select(COLUNAS).eq('item_id', ID_CAMISA_331).ilike('observacao', '%CAMISA MALHA POLO BEGE%')
  )
  const pequenos = await buscarPaginado(() =>
    supabase.from('entregas').select(COLUNAS).in('id', Object.keys(CASOS_PEQUENOS))
  )
  return { luvas, camisasAzul, camisasBege, pequenos }
}

// ---------- montagem do plano ----------
function montarPlano(grupos, itensPorCodigo, colabPorId) {
  const plano = []
  const problemas = []

  function entrada(e, codigoAlvo, grupo, prova) {
    const alvo = itensPorCodigo.get(codigoAlvo)
    if (!alvo) {
      problemas.push(`ITEM ALVO ${codigoAlvo} não encontrado no catálogo (entrega ${e.id})`)
      return
    }
    const colab = colabPorId.get(e.colaborador_id)
    const ehLuva = ['617', '618', '619'].includes(codigoAlvo)
    const ca = ehLuva ? caLuva(e.data_entrega) : alvo.ca || ''
    plano.push({
      entrega_id: e.id,
      grupo,
      colaborador: colab ? colab.nome_completo : '(colaborador não encontrado)',
      matricula: e.matricula || colab?.matricula || null,
      data_entrega: e.data_entrega,
      quantidade: e.quantidade,
      recibo_emitido: e.recibo_emitido,
      numero_recibo: e.numero_recibo, // contexto — a RPC NÃO altera
      item_atual_id: e.item_id,
      item_atual_codigo: e.snapshot_item?.codigo || null,
      item_atual_nome: e.snapshot_item?.nome || null,
      novo_item_id: alvo.id,
      novo_item_codigo: alvo.codigo,
      novo_item_nome: alvo.nome,
      ca_snapshot: ca,
      snapshot_item: {
        nome: alvo.nome,
        codigo: alvo.codigo || '',
        tipo: alvo.tipo,
        ca,
        subgrupo: alvo.subgrupo || null,
        valor: alvo.valor ?? null,
        prazo_uso_dias: alvo.prazo_uso_dias ?? null,
      },
      prova,
      // entrega já aponta para o item certo (ex.: jaleco do Hamires, 675):
      // nada a escrever — validada e pulada
      status: e.item_id === alvo.id ? 'ja_correto' : 'para_corrigir',
    })
  }

  for (const e of grupos.luvas) {
    const m = (e.observacao || '').match(/LUVA LATEX ([GMP])\b/)
    if (!m) {
      problemas.push(`LUVA sem tamanho reconhecido: ${e.id} — "${e.observacao}"`)
      continue
    }
    const codigo = { G: '619', M: '618', P: '617' }[m[1]]
    entrada(e, codigo, `luva_${m[1]}`, `sistema antigo: LUVA LATEX ${m[1]} = código ${codigo} (PDF, sempre)`)
  }
  for (const e of grupos.camisasAzul) {
    entrada(e, '312', 'camisa_azul', 'sistema antigo: CAMISA MALHA AZUL - ASG = código 312 (651 pares pessoa+data)')
  }
  for (const e of grupos.camisasBege) {
    entrada(e, '314', 'camisa_bege', 'sistema antigo: CAMISA MALHA POLO BEGE = código 314 (101 pares pessoa+data)')
  }
  for (const e of grupos.pequenos) {
    const codigo = CASOS_PEQUENOS[e.id]
    const grupo =
      codigo === '673' ? 'calca_brim_m' : codigo === '645' ? 'protetor_facial' : 'jaleco_longa'
    entrada(e, codigo, grupo, 'sistema antigo: pessoa+data no PDF (ver comentário CASOS_PEQUENOS no script)')
  }
  return { plano, problemas }
}

// ---------- main ----------
const { data: itensAlvo, error: errItens } = await supabase
  .from('itens')
  .select('id, codigo, nome, tipo, ca, valor, prazo_uso_dias, subgrupo, situacao')
  .in('codigo', CODIGOS_ALVO)
if (errItens) throw new Error('itens: ' + errItens.message)
const itensPorCodigo = new Map(itensAlvo.map((i) => [i.codigo, i]))
for (const c of CODIGOS_ALVO) {
  if (!itensPorCodigo.has(c)) {
    console.error(`ERRO: item alvo código ${c} não existe no catálogo — plano abortado`)
    process.exit(1)
  }
}

const grupos = await buscarEntregasAlvo()
const totalBruto = grupos.luvas.length + grupos.camisasAzul.length + grupos.camisasBege.length + grupos.pequenos.length
console.log(
  `Entregas alvo: luvas ${grupos.luvas.length} | camisa azul ${grupos.camisasAzul.length} | camisa bege ${grupos.camisasBege.length} | casos pequenos ${grupos.pequenos.length} | total ${totalBruto}`
)
if (grupos.pequenos.length !== Object.keys(CASOS_PEQUENOS).length) {
  console.error(`ERRO: esperados ${Object.keys(CASOS_PEQUENOS).length} casos pequenos, vieram ${grupos.pequenos.length} — plano abortado`)
  process.exit(1)
}

const idsColab = [...new Set(Object.values(grupos).flat().map((e) => e.colaborador_id))]
const colaboradores = []
for (let i = 0; i < idsColab.length; i += 200) {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('id, nome_completo, matricula')
    .in('id', idsColab.slice(i, i + 200))
  if (error) throw new Error('colaboradores: ' + error.message)
  colaboradores.push(...(data || []))
}
const colabPorId = new Map(colaboradores.map((c) => [c.id, c]))

const { plano, problemas } = montarPlano(grupos, itensPorCodigo, colabPorId)
const paraCorrigir = plano.filter((p) => p.status === 'para_corrigir')
const jaCorretos = plano.filter((p) => p.status === 'ja_correto')

// ---------- relatório ----------
console.log(`\nPlano: ${paraCorrigir.length} a corrigir + ${jaCorretos.length} já correto(s) = ${plano.length} no escopo`)
const porGrupo = new Map()
for (const p of plano) porGrupo.set(p.grupo, (porGrupo.get(p.grupo) || 0) + 1)
console.log('\n--- Por grupo ---')
for (const [g, n] of [...porGrupo.entries()].sort()) console.log(`  ${g}: ${n}`)

const luvasPlano = plano.filter((p) => p.grupo.startsWith('luva_'))
const faixa10695 = luvasPlano.filter((p) => p.ca_snapshot === '10.695')
const faixa45629 = luvasPlano.filter((p) => p.ca_snapshot === '45.629')
console.log(`\n--- CA das luvas ---`)
console.log(`  CA 10.695 (entregas até ${CA_LUVA_ATE}): ${faixa10695.length}`)
console.log(`  CA 45.629 (01/06 e 01/07/2026 — 01/07 comprovado pelo REC-00002): ${faixa45629.length}`)
const semCa = luvasPlano.filter((p) => p.ca_snapshot === '')
console.log(`  SEM CA (02–30/06/2026, zona sem prova de papel — decisão da gestão): ${semCa.length}`)
const cinzenta = luvasPlano.filter((p) => p.ca_snapshot === '')
if (cinzenta.length) {
  console.log(`  ⚠ entregas sem CA por decisão da gestão (corrigem o item, CA fica vazio):`)
  for (const p of cinzenta) console.log(`    ${p.data_entrega} ${p.colaborador} [${p.matricula}] ${p.grupo}`)
}

console.log('\n--- Linha a linha (id | colaborador | data | atual → alvo | CA) ---')
for (const p of plano) {
  const marca = p.status === 'ja_correto' ? ' (já correto — sem escrita)' : ''
  console.log(
    `  ${p.entrega_id} | ${p.colaborador} [${p.matricula}] | ${p.data_entrega} | ${p.item_atual_codigo} ${p.item_atual_nome} → ${p.novo_item_codigo} ${p.novo_item_nome} | CA ${p.ca_snapshot || '—'}${marca}`
  )
}
if (problemas.length) {
  console.log('\n--- PROBLEMAS (fora do plano) ---')
  for (const p of problemas) console.log('  ' + p)
}

// ---------- dry-run: grava o plano; --aplicar: executa via RPC ----------
if (!APLICAR) {
  fs.mkdirSync(PASTA, { recursive: true })
  fs.writeFileSync(
    ARQUIVO_PLANO,
    JSON.stringify(
      {
        gerado_em: new Date().toISOString(),
        motivo: MOTIVO,
        totais: { escopo: plano.length, para_corrigir: paraCorrigir.length, ja_correto: jaCorretos.length },
        plano,
        problemas,
      },
      null,
      2
    )
  )
  console.log(`\nDry-run — nada foi gravado no banco. Plano salvo em ${ARQUIVO_PLANO}`)
  console.log('Revise o plano e o RELATORIO_DRYRUN.md; para executar (exige a RPC corrigir_item_entrega e aprovação da gestão):')
  console.log('  node scripts/corrigir-itens-historico-ceu.mjs --aplicar')
  process.exit(problemas.length ? 1 : 0)
}

// --- modo --aplicar ---
if (!fs.existsSync(ARQUIVO_PLANO)) {
  console.error(`✋ RECUSADO: ${ARQUIVO_PLANO} não existe. Rode o dry-run primeiro (sem --aplicar) e revise o plano.`)
  process.exit(1)
}
const planoArquivo = JSON.parse(fs.readFileSync(ARQUIVO_PLANO, 'utf-8'))
if (planoArquivo.motivo !== MOTIVO) {
  console.error('✋ RECUSADO: o motivo do plano não confere com o esperado — regere o plano com o dry-run deste script.')
  process.exit(1)
}
const aExecutar = planoArquivo.plano.filter((p) => p.status === 'para_corrigir')
console.log(`Aplicando ${aExecutar.length} correções via RPC corrigir_item_entrega (uma por entrega)...`)

let ok = 0
const puladas = []
const erros = []
for (const [idx, p] of aExecutar.entries()) {
  // reconfere a entrega no banco: só corrige se o item atual ainda é o esperado
  const { data: atual, error: errSel } = await supabase.from('entregas').select('id, item_id').eq('id', p.entrega_id).maybeSingle()
  if (errSel || !atual) {
    erros.push(`${p.entrega_id}: falha ao reler (${errSel?.message || 'não encontrada'})`)
    continue
  }
  if (atual.item_id !== p.item_atual_id) {
    puladas.push(`${p.entrega_id}: item atual mudou desde o dry-run (${p.item_atual_id} → ${atual.item_id}) — pulada`)
    continue
  }
  const { error } = await supabase.rpc('corrigir_item_entrega', {
    p_entrega_id: p.entrega_id,
    p_novo_item_id: p.novo_item_id,
    p_motivo: MOTIVO,
    p_snapshot_item: p.snapshot_item,
  })
  if (error) {
    erros.push(`${p.entrega_id} (${p.colaborador}, ${p.data_entrega}): ${error.message}`)
  } else {
    ok++
  }
  if ((idx + 1) % 100 === 0) console.log(`  ... ${idx + 1}/${aExecutar.length}`)
}

console.log(`\n=== Resultado ===`)
console.log(`  corrigidas: ${ok}`)
console.log(`  puladas (item mudou desde o dry-run): ${puladas.length}`)
console.log(`  erros: ${erros.length}`)
for (const p of puladas) console.log('  PULADA: ' + p)
for (const e of erros) console.log('  ERRO: ' + e)
process.exit(erros.length ? 1 : 0)
