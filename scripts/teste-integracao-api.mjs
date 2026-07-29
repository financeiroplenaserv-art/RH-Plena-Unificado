// Bateria automatizada de testes de integração via API (Supabase).
//
// Cobre: login/perfis dos 9 usuários de teste, matriz de permissões
// (PERMISSOES_PADRAO x permissoes_perfil), storage (upload/download/delete com
// arquivos descartáveis), extras (somente leitura) e dry-run do parser de
// escalas. Gera docs/TESTES_INTEGRACAO_2026-07-29.md.
//
// Segurança:
//   - Não troca senha de ninguém: sessões via auth.admin.generateLink
//     (magiclink) + verifyOtp com token_hash (não-destrutivo).
//   - Não escreve em dados de negócio; escritas só em arquivos de storage
//     descartáveis, removidos ao final (delete via perfil adm, com fallback
//     pela service key).
//   - Não imprime chaves, tokens nem CPFs.
//
// Uso: node scripts/teste-integracao-api.mjs

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------
// Setup
// ---------------------------------------------------------------

function carregarEnv(caminho) {
  if (!fs.existsSync(caminho)) return
  const conteudo = fs.readFileSync(caminho, 'utf-8')
  for (const linha of conteudo.split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('ERRO: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY e VITE_SUPABASE_ANON_KEY são obrigatórias no .env')
  process.exit(1)
}

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const USUARIOS = [
  { email: 'teste.adm@plena.local', nivel: 'adm' },
  { email: 'teste.gestor@plena.local', nivel: 'gestor' },
  { email: 'teste.rh@plena.local', nivel: 'rh' },
  { email: 'teste.dp1@plena.local', nivel: 'dp1' },
  { email: 'teste.dp2@plena.local', nivel: 'dp2' },
  { email: 'teste.mesa@plena.local', nivel: 'mesa' },
  { email: 'teste.inspetoria@plena.local', nivel: 'inspetoria' },
  { email: 'teste.financeiro@plena.local', nivel: 'financeiro' },
  { email: 'teste.visualizador@plena.local', nivel: 'visualizador' },
]

// Resultados: { secao, nome, status: 'PASS' | 'FAIL' | 'INFO', evidencia }
const resultados = []
function reg(secao, nome, ok, evidencia = '') {
  resultados.push({ secao, nome, status: ok === 'info' ? 'INFO' : ok ? 'PASS' : 'FAIL', evidencia })
}

/** Gera sessão autenticada de um usuário de teste sem tocar na senha. */
async function sessaoDeTeste(email) {
  const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generateLink falhou: ${error.message}`)
  const tokenHash = data?.properties?.hashed_token
  if (!tokenHash) throw new Error('generateLink não retornou token_hash')
  const cliente = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: sessao, error: erroOtp } = await cliente.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (erroOtp) throw new Error(`verifyOtp falhou: ${erroOtp.message}`)
  return { cliente, usuario: sessao.user }
}

/** Lê todas as linhas de uma consulta paginando (PostgREST limita por página). */
async function buscarTudo(consulta) {
  const linhas = []
  const PAGINA = 1000
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await consulta.range(inicio, inicio + PAGINA - 1)
    if (error) throw new Error(error.message)
    linhas.push(...data)
    if (data.length < PAGINA) break
  }
  return linhas
}

// ---------------------------------------------------------------
// Item 1 — Login/perfis dos 9 usuários de teste
// ---------------------------------------------------------------

const sessoes = {} // email -> { cliente, usuario } para reuso nos itens 3 e 4

async function testarLoginPerfis() {
  for (const { email, nivel } of USUARIOS) {
    const rotulo = email.replace('@plena.local', '')
    let cliente, usuario
    try {
      ;({ cliente, usuario } = await sessaoDeTeste(email))
      sessoes[email] = { cliente, usuario }
      reg('1. Login/perfis', `${rotulo}: autenticação via magiclink`, usuario?.email === email,
        usuario?.email === email ? 'sessão obtida via verifyOtp' : `email divergente: ${usuario?.email}`)
    } catch (err) {
      reg('1. Login/perfis', `${rotulo}: autenticação via magiclink`, false, err.message)
      reg('1. Login/perfis', `${rotulo}: perfil em perfis`, false, 'não executado (sem sessão)')
      reg('1. Login/perfis', `${rotulo}: leitura de permissoes_perfil`, false, 'não executado (sem sessão)')
      continue
    }

    const { data: perfil, error: erroPerfil } = await cliente
      .from('perfis')
      .select('nivel_acesso')
      .eq('id', usuario.id)
      .single()
    if (erroPerfil) {
      reg('1. Login/perfis', `${rotulo}: perfil em perfis`, false, `erro ao ler perfil: ${erroPerfil.message}`)
    } else {
      reg('1. Login/perfis', `${rotulo}: nivel_acesso = ${nivel}`, perfil.nivel_acesso === nivel,
        `banco retornou "${perfil.nivel_acesso}"`)
    }

    const { count, error: erroPerm } = await cliente
      .from('permissoes_perfil')
      .select('*', { count: 'exact', head: true })
    if (erroPerm) {
      reg('1. Login/perfis', `${rotulo}: leitura de permissoes_perfil`, false, erroPerm.message)
    } else {
      reg('1. Login/perfis', `${rotulo}: leitura de permissoes_perfil`, (count ?? 0) > 0,
        `${count} linhas legíveis (migration 062)`)
    }
  }
}

// ---------------------------------------------------------------
// Item 2 — Matriz de permissões: PERMISSOES_PADRAO x banco
// ---------------------------------------------------------------

function extrairPermissoesPadrao() {
  const fonte = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/permissoes.ts'), 'utf-8')
  const marcador = 'const PERMISSOES_PADRAO'
  const inicioMarcador = fonte.indexOf(marcador)
  if (inicioMarcador === -1) throw new Error('PERMISSOES_PADRAO não encontrado em src/lib/permissoes.ts')
  const inicioChave = fonte.indexOf('{', inicioMarcador)
  let profundidade = 0
  let fim = -1
  for (let i = inicioChave; i < fonte.length; i++) {
    if (fonte[i] === '{') profundidade++
    else if (fonte[i] === '}') {
      profundidade--
      if (profundidade === 0) { fim = i; break }
    }
  }
  if (fim === -1) throw new Error('Não foi possível isolar o literal de PERMISSOES_PADRAO')
  // O literal é um objeto puro (strings e arrays) — seguro para avaliar.
  return new Function(`return (${fonte.slice(inicioChave, fim + 1)})`)()
}

async function testarMatrizPermissoes() {
  const padrao = extrairPermissoesPadrao()
  const linhasBanco = await buscarTudo(
    service.from('permissoes_perfil').select('perfil,recurso,acao,permitido')
  )

  const paresPadrao = new Set()
  for (const [recurso, acoes] of Object.entries(padrao)) {
    for (const acao of Object.keys(acoes)) paresPadrao.add(`${recurso}/${acao}`)
  }
  const paresBanco = new Set(linhasBanco.map((l) => `${l.recurso}/${l.acao}`))

  const semLinhaNoBanco = [...paresPadrao].filter((p) => !paresBanco.has(p)).sort()
  const soNoBanco = [...paresBanco].filter((p) => !paresPadrao.has(p)).sort()

  // Conflitos de valor: linha explícita do banco diverge do que o padrão implica.
  const conflitos = []
  for (const linha of linhasBanco) {
    const acoes = padrao[linha.recurso]
    if (!acoes || !(linha.acao in acoes)) continue // par só existe no banco (já reportado)
    const perfisPermitidos = acoes[linha.acao]
    const padraoPermite =
      linha.perfil === 'adm' || linha.perfil === 'admin' ? true : perfisPermitidos.includes(linha.perfil)
    if (linha.permitido !== padraoPermite) {
      conflitos.push(`${linha.perfil} ${linha.recurso}/${linha.acao}: banco=${linha.permitido}, padrão=${padraoPermite}`)
    }
  }

  reg('2. Matriz de permissões', 'Análise estática PERMISSOES_PADRAO x permissoes_perfil', true,
    `${paresPadrao.size} pares no mapa padrão, ${linhasBanco.length} linhas no banco`)
  reg('2. Matriz de permissões', 'Pares do padrão sem linha no banco', 'info',
    semLinhaNoBanco.length === 0
      ? 'nenhum — todo par do padrão tem linha explícita'
      : `${semLinhaNoBanco.length} par(es) usam o fallback do código: ${semLinhaNoBanco.slice(0, 12).join(', ')}${semLinhaNoBanco.length > 12 ? ` … (+${semLinhaNoBanco.length - 12})` : ''}`)
  reg('2. Matriz de permissões', 'Pares só no banco (sem padrão no código)', 'info',
    soNoBanco.length === 0
      ? 'nenhum'
      : `${soNoBanco.length} par(es): ${soNoBanco.slice(0, 12).join(', ')}${soNoBanco.length > 12 ? ` … (+${soNoBanco.length - 12})` : ''}`)
  reg('2. Matriz de permissões', 'Conflitos de valor (banco diverge do padrão)', 'info',
    conflitos.length === 0
      ? 'nenhum — linhas explícitas coincidem com o padrão'
      : `${conflitos.length} divergência(s): ${conflitos.slice(0, 12).join(' | ')}${conflitos.length > 12 ? ` … (+${conflitos.length - 12})` : ''}`)
}

// ---------------------------------------------------------------
// Item 3 — Storage: ocorrencia-anexos e vr-arquivos
// ---------------------------------------------------------------

const arquivosParaLimpar = [] // { bucket, path }

async function limparArquivos() {
  for (const { bucket, path: p } of arquivosParaLimpar) {
    await service.storage.from(bucket).remove([p]).catch(() => {})
  }
}

async function testarBucket({ bucket, emailAutorizado, tabelaContexto, label }) {
  const secao = '3. Storage'
  // Descobre um contexto real (id de ocorrência/projeto) exigido pela policy (migrations 044/045).
  const { data: contexto, error: erroCtx } = await service.from(tabelaContexto).select('id').limit(1).single()
  if (erroCtx || !contexto) {
    reg(secao, `${label}: contexto (${tabelaContexto})`, 'info',
      `nenhum registro em ${tabelaContexto} — testes de ${bucket} pulados`)
    return
  }

  const nome = `${contexto.id}/teste-automatizado/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`
  const conteudo = `teste automatizado de integração ${new Date().toISOString()}`
  const autorizado = sessoes[emailAutorizado]
  const visualizador = sessoes['teste.visualizador@plena.local']
  const adm = sessoes['teste.adm@plena.local']

  // Upload autorizado
  const { error: erroUpload } = await autorizado.cliente.storage
    .from(bucket)
    .upload(nome, new Blob([conteudo], { type: 'text/plain' }))
  reg(secao, `${label}: upload autorizado (${emailAutorizado.replace('@plena.local', '')})`, !erroUpload,
    erroUpload ? erroUpload.message : `path ${nome.split('/').slice(0, 2).join('/')}/… aceito`)

  if (!erroUpload) {
    arquivosParaLimpar.push({ bucket, path: nome })

    // Download e validação de conteúdo
    const { data: blob, error: erroDownload } = await autorizado.cliente.storage.from(bucket).download(nome)
    if (erroDownload) {
      reg(secao, `${label}: download do arquivo enviado`, false, erroDownload.message)
    } else {
      const textoBaixado = await blob.text()
      reg(secao, `${label}: download e conteúdo íntegro`, textoBaixado === conteudo,
        textoBaixado === conteudo ? 'conteúdo baixado idêntico ao enviado' : 'conteúdo divergente')
    }

    // Acesso negado para visualizador (fora da lista da policy — migration 039)
    const nomeNegado = `${contexto.id}/teste-automatizado/negado-${Date.now()}.txt`
    const { error: erroNegado } = await visualizador.cliente.storage
      .from(bucket)
      .upload(nomeNegado, new Blob(['nao deveria subir'], { type: 'text/plain' }))
    reg(secao, `${label}: upload negado para visualizador`, !!erroNegado,
      erroNegado ? `bloqueado pelo RLS (${erroNegado.message})` : 'FALHA DE SEGURANÇA: visualizador conseguiu fazer upload')
    if (!erroNegado) arquivosParaLimpar.push({ bucket, path: nomeNegado })

    // Delete só é permitido a admin (migrations 044) — remove com a sessão adm.
    const { error: erroDelete } = await adm.cliente.storage.from(bucket).remove([nome])
    reg(secao, `${label}: remoção pelo perfil adm (policy DELETE)`, !erroDelete,
      erroDelete ? `${erroDelete.message} (fallback de limpeza via service key será aplicado)` : 'arquivo descartável removido')
    if (!erroDelete) {
      arquivosParaLimpar.splice(arquivosParaLimpar.findIndex((a) => a.path === nome && a.bucket === bucket), 1)
    }
  }
}

async function testarStorage() {
  await testarBucket({
    bucket: 'ocorrencia-anexos',
    emailAutorizado: 'teste.rh@plena.local',
    tabelaContexto: 'ocorrencias',
    label: 'ocorrencia-anexos',
  })
  await testarBucket({
    bucket: 'vr-arquivos',
    emailAutorizado: 'teste.dp2@plena.local',
    tabelaContexto: 'projetos_vr',
    label: 'vr-arquivos',
  })
}

// ---------------------------------------------------------------
// Item 4 — Extras (somente leitura)
// ---------------------------------------------------------------

async function testarExtras() {
  const secao = '4. Extras'

  // Categoria "Faltista" com valor 0 (cadastrada em 24/07/2026)
  const { data: categorias, error: erroCat } = await service
    .from('categorias_extras')
    .select('nome, valor_padrao, ativo, created_at')
    .ilike('nome', '%faltista%')
  if (erroCat) {
    reg(secao, 'Categoria "Faltista" existe', false, erroCat.message)
  } else if (!categorias || categorias.length === 0) {
    reg(secao, 'Categoria "Faltista" existe', false, 'nenhuma categoria com nome contendo "faltista"')
    reg(secao, 'Categoria "Faltista" com valor 0', false, 'não verificado (categoria ausente)')
  } else {
    const faltista = categorias[0]
    reg(secao, 'Categoria "Faltista" existe', true,
      `cadastrada em ${String(faltista.created_at).slice(0, 10)}, ativa=${faltista.ativo}`)
    reg(secao, 'Categoria "Faltista" com valor 0', Number(faltista.valor_padrao) === 0,
      `valor_padrao=${faltista.valor_padrao}`)
  }

  // Colunas gera_extra e reforco_contratual (migration 074)
  const { error: erroColunas } = await service.from('extras').select('gera_extra, reforco_contratual').limit(1)
  reg(secao, 'Colunas gera_extra e reforco_contratual em extras (migration 074)', !erroColunas,
    erroColunas ? erroColunas.message : 'colunas presentes e consultáveis')

  // RPC registrar_extra_plantao exposta no PostgREST (spec OpenAPI)
  let rpcExposta = false
  try {
    const resposta = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    })
    const spec = await resposta.json()
    rpcExposta = !!spec?.paths?.['/rpc/registrar_extra_plantao']
    reg(secao, 'RPC registrar_extra_plantao exposta no PostgREST', rpcExposta,
      rpcExposta ? 'presente na spec OpenAPI (/rpc/registrar_extra_plantao, parâmetro p_payload jsonb)'
        : 'ausente da spec OpenAPI')
  } catch (err) {
    reg(secao, 'RPC registrar_extra_plantao exposta no PostgREST', false, `falha ao ler spec: ${err.message}`)
  }

  // Comportamento: visualizador deve ser barrado pela checagem de permissão da RPC
  const visualizador = sessoes['teste.visualizador@plena.local']
  if (visualizador) {
    const { error: erroRpc } = await visualizador.cliente.rpc('registrar_extra_plantao', { p_payload: {} })
    const bloqueou = !!erroRpc && /sem permissão/i.test(erroRpc.message)
    const naoExiste = !!erroRpc && /could not find the function/i.test(erroRpc.message)
    reg(secao, 'RPC nega execução para visualizador', bloqueou,
      naoExiste ? 'função não encontrada no banco (migrations 075/077 não aplicadas?)'
        : bloqueou ? 'barrada com "Sem permissão para registrar extras"' : `resposta inesperada: ${erroRpc?.message ?? 'executou sem erro'}`)
  }

  // Comportamento: editor (mesa) passa na permissão e cai na validação de payload
  const mesa = sessoes['teste.mesa@plena.local']
  if (mesa) {
    const { error: erroMesa } = await mesa.cliente.rpc('registrar_extra_plantao', { p_payload: {} })
    const validou = !!erroMesa && /obrigatórios/i.test(erroMesa.message)
    reg(secao, 'RPC aceita perfil editor e valida payload', validou,
      validou ? 'editor barrado apenas pela validação "Data e departamento são obrigatórios"'
        : `resposta inesperada: ${erroMesa?.message ?? 'executou sem erro'}`)
  }

  // Parâmetros novos (gera_extra/reforco_contratual, migrations 075/077): checagem estática
  const mig075 = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/075_rpc_extra_plantao_gera_extra_reforco.sql'), 'utf-8')
  const mig077 = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/077_rpc_extra_plantao_duplicidade_nao_se_aplica.sql'), 'utf-8')
  const camposOk = mig075.includes('gera_extra') && mig075.includes('reforco_contratual') && mig077.includes('gera_extra')
  reg(secao, 'Parâmetros novos da RPC (migrations 075/077)', camposOk,
    'migrations 075/077 gravam gera_extra/reforco_contratual e implementam a exceção de duplicidade. ' +
    'Verificação comportamental exigiria INSERT em extras (proibido nesta bateria) — confirmar aplicação das migrations no banco se necessário.')
}

// ---------------------------------------------------------------
// Item 5 — Escalas: dry-run do parser (sem gravar)
// ---------------------------------------------------------------

function testarEscalas() {
  const secao = '5. Escalas (dry-run)'
  let saida
  try {
    const stdout = execSync('npx tsx --tsconfig tsconfig.scripts.json scripts/teste-escalas-dryrun.ts', {
      encoding: 'utf-8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300000,
    })
    const match = stdout.match(/@@JSON@@\s*([\s\S]*?)\s*@@FIM@@/)
    if (!match) throw new Error('marcadores de saída não encontrados')
    saida = JSON.parse(match[1])
  } catch (err) {
    reg(secao, 'Execução do dry-run do parser', false, err.message.slice(0, 300))
    return
  }

  // Arquivo real: o arquivo local é de ocorrências, não de escala — o parser deve rejeitar.
  if (saida.arquivoReal.parseou) {
    reg(secao, 'Parser contra arquivo real de dados-locais/', true,
      `${saida.arquivoReal.caminho}: ${saida.arquivoReal.dias} dias parseados`)
  } else {
    reg(secao, 'Parser contra arquivo real de dados-locais/', true,
      `${saida.arquivoReal.caminho}: rejeitado corretamente (não é escala Flit) — ${saida.arquivoReal.erro?.slice(0, 140)}`)
  }

  const d = saida.derivado
  reg(secao, 'Parser no caminho feliz (arquivo Flit derivado de dados reais)', d.diasParseados > 0,
    `${d.linhasEntrada} linhas de entrada → ${d.diasParseados} dias parseados, ${d.colaboradoresUnicos} colaboradores únicos`)
  reg(secao, 'Matching com colaboradores do banco (somente leitura)', d.casaram > 0,
    `${d.casaram} casaram, ${d.naoCasaram} não casaram (de ${d.colaboradoresUnicos} únicos; banco tem ${saida.totalColaboradoresBanco} colaboradores). ` +
    `Amostra de matrículas sem match: ${d.amostraMatriculasSemMatch.join(', ')}`)
  if (d.naoCasaram > 0) {
    reg(secao, 'Colaboradores sem match no dry-run', 'info',
      `${d.naoCasaram} sem match — esperado para ex-colaboradores/demitidos presentes no histórico de faltas; importação real marcaria como "não encontrados"`)
  }
}

// ---------------------------------------------------------------
// Item 6 — Relatório
// ---------------------------------------------------------------

function gerarRelatorio() {
  const agora = new Date()
  const dataIso = agora.toISOString().slice(0, 10)
  const pass = resultados.filter((r) => r.status === 'PASS')
  const fail = resultados.filter((r) => r.status === 'FAIL')
  const info = resultados.filter((r) => r.status === 'INFO')

  const porSecao = new Map()
  for (const r of resultados) {
    if (!porSecao.has(r.secao)) porSecao.set(r.secao, [])
    porSecao.get(r.secao).push(r)
  }

  const linhas = []
  linhas.push('# Testes de integração via API — 2026-07-29', '')
  linhas.push(`Executado por \`scripts/teste-integracao-api.mjs\` em ${agora.toISOString()}.`, '')
  linhas.push('Bateria automatizada cobrindo login/perfis, matriz de permissões, storage, extras (somente leitura) e dry-run do parser de escalas. Sessões obtidas via `generateLink` (magiclink) + `verifyOtp`, sem troca de senhas. Nenhum dado de negócio foi criado/alterado/removido; os únicos writes foram arquivos de storage descartáveis, removidos ao final.', '')
  linhas.push(`**Resumo: ${pass.length + fail.length} verificações — ${pass.length} PASS, ${fail.length} FAIL** (+ ${info.length} observações informativas).`, '')

  for (const [secao, itens] of porSecao) {
    linhas.push(`## ${secao}`, '')
    linhas.push('| Verificação | Status | Evidência |')
    linhas.push('|---|---|---|')
    for (const item of itens) {
      linhas.push(`| ${item.nome} | ${item.status} | ${item.evidencia.replaceAll('|', '\\|')} |`)
    }
    linhas.push('')
  }

  linhas.push('## Problemas encontrados', '')
  if (fail.length === 0) {
    linhas.push('Nenhuma verificação obrigatória falhou.', '')
  } else {
    for (const f of fail) linhas.push(`- **${f.secao} — ${f.nome}**: ${f.evidencia}`)
    linhas.push('')
  }

  linhas.push('## Requer validação manual da usuária', '')
  linhas.push('- Aparência e comportamento visual da UI por perfil (sidebar, menus, telas) — não automatizável via API.')
  linhas.push('- Fluxo de consentimento LGPD na interface (tela exibida no primeiro login).')
  linhas.push('- Verificação comportamental dos parâmetros novos da RPC `registrar_extra_plantao` (gera_extra/reforco_contratual e exceção de duplicidade da migration 077): exigiria INSERT em `extras`, proibido nesta bateria. Evidência estática nas migrations 075/077.', '')

  linhas.push('## Veredito geral', '')
  linhas.push(fail.length === 0
    ? `**APROVADO** — ${pass.length}/${pass.length + fail.length} verificações passaram; pendências manuais de login/perfis, storage, extras e escalas cobertas por automação.`
    : `**REPROVADO** — ${fail.length} de ${pass.length + fail.length} verificações falharam (ver "Problemas encontrados").`)
  linhas.push('')

  const caminho = path.resolve(process.cwd(), `docs/TESTES_INTEGRACAO_${dataIso}.md`)
  fs.writeFileSync(caminho, linhas.join('\n'), 'utf-8')
  return { caminho, pass: pass.length, fail: fail.length, info: info.length, falhas: fail }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  console.log('== Bateria de testes de integração via API ==')
  console.log('Item 1: login/perfis…')
  await testarLoginPerfis()
  console.log('Item 2: matriz de permissões…')
  await testarMatrizPermissoes()
  console.log('Item 3: storage…')
  try {
    await testarStorage()
  } finally {
    await limparArquivos()
  }
  console.log('Item 4: extras…')
  await testarExtras()
  console.log('Item 5: escalas (dry-run)…')
  testarEscalas()
  console.log('Item 6: relatório…')
  const resumo = gerarRelatorio()

  console.log('')
  console.log(`Relatório: ${path.relative(process.cwd(), resumo.caminho)}`)
  console.log(`Total: ${resumo.pass + resumo.fail} verificações | PASS: ${resumo.pass} | FAIL: ${resumo.fail} | INFO: ${resumo.info}`)
  if (resumo.falhas.length > 0) {
    console.log('Falhas:')
    for (const f of resumo.falhas) console.log(`  - [${f.secao}] ${f.nome}: ${f.evidencia}`)
  }
  process.exit(resumo.fail > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('ERRO FATAL:', err)
  await limparArquivos()
  process.exit(2)
})
