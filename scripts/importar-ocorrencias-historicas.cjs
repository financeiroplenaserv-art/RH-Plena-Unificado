// Importa as ocorrências históricas da planilha "OCC todas 180726 (tratado).xlsx"
// para o CORH, casando colaboradores por matrícula/CPF/nome e usando o
// placeholder "OCORRENCIAS HISTORICAS - NAO IDENTIFICADO" para os não casados.
//
// Padrão dos campos segue o das importações anteriores:
//   titulo, tipo_penalidade=tipo, base_legal/gravidade do catálogo de tipos,
//   data_hora_ocorrido=data_ocorrencia, status='Ativa', empresa principal.

const fs = require('fs')
const XLSX = require('@e965/xlsx')

const env = fs.readFileSync('.env', 'utf8')
const get = (k) => (env.match(new RegExp(k + '=(.+)')) || [])[1]?.trim()
const url = get('VITE_SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY')
const H = {
  apikey: key,
  Authorization: 'Bearer ' + key,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const PLACEHOLDER_ID = 'af8cb17e-8065-445b-89e5-a29e9b7e822f' // OCORRENCIAS HISTORICAS - NAO IDENTIFICADO
const EMPRESA_ID = 'fe2f1e37-3915-4801-a2a4-179268a56fa2'
const USUARIO_ID = '9c5d9bce-4a7e-44f3-a662-34a4a545c7a7'

// ---- catálogo de tipos do CORH (lido de tiposOcorrencia.ts) ----
function carregarTipos() {
  const src = fs.readFileSync('src/lib/ocorrencias/tiposOcorrencia.ts', 'utf8')
  const tipos = {}
  const re = /\{\s*macroGrupo:\s*'([^']+)',\s*tipo:\s*'([^']+)',\s*gravidade:\s*'([^']+)',\s*baseLegal:\s*'([^']+)'/g
  let m
  while ((m = re.exec(src))) {
    tipos[m[2]] = { macroGrupo: m[1], gravidade: m[3], baseLegal: m[4] }
  }
  return tipos
}

function serialParaData(n) {
  if (typeof n !== 'number' || !isFinite(n)) return null
  const d = XLSX.SSF.parse_date_code(n)
  if (!d) return null
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}

function normalizarNome(s) {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function req(method, path, body) {
  const r = await fetch(url + '/rest/v1/' + path, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${txt.slice(0, 300)}`)
  return txt ? JSON.parse(txt) : null
}

async function main() {
  const TIPOS = carregarTipos()
  const mapaPdf = JSON.parse(fs.readFileSync('scripts/tmp-mapa-pdf.json', 'utf8'))

  // ---- colaboradores do CORH indexados ----
  // Casamento APENAS por CPF (via PDF do sistema antigo) e por nome exato único.
  // A matrícula do sistema antigo NÃO corresponde à do CORH (erro do Ramulpho).
  const colaboradores = await req('GET', 'colaboradores?select=id,nome_completo,matricula,cpf,status&limit=2000')
  const porCpf = new Map()
  const contagemNome = new Map()
  const porNome = new Map()
  for (const c of colaboradores) {
    if (c.cpf) porCpf.set(String(c.cpf).replace(/\D/g, ''), c)
    if (c.nome_completo) {
      const n = normalizarNome(c.nome_completo)
      contagemNome.set(n, (contagemNome.get(n) || 0) + 1)
      porNome.set(n, c)
    }
  }
  console.log(`Colaboradores CORH: ${colaboradores.length} | CPFs: ${porCpf.size}`)

  function casar(codigo, nomePlanilha) {
    const cod = String(codigo ?? '').trim()
    const nomeNorm = normalizarNome(nomePlanilha)
    // 1. Nome exato, mas só se for único no CORH (homônimo -> placeholder)
    if (nomeNorm && (contagemNome.get(nomeNorm) || 0) === 1) {
      const porNomeColab = porNome.get(nomeNorm)
      if (porNomeColab) return { colaborador: porNomeColab, via: 'nome' }
    }
    // 2. PDF (sistema antigo) -> CPF -> CORH, MAS SÓ com validação cruzada de
    // nome: códigos de sistemas diferentes colidem (ex: "974" = Alexandre na
    // OCC e Ramulpho no PDF/Gesoper). Sem o nome batendo, não casa.
    if (cod) {
      const cpfPdf = mapaPdf.mapaMatriculaCpf[cod] || mapaPdf.mapaCodCpf[cod]
      if (cpfPdf) {
        const porCpfPdf = porCpf.get(cpfPdf)
        if (porCpfPdf && normalizarNome(porCpfPdf.nome_completo) === nomeNorm) {
          return { colaborador: porCpfPdf, via: 'pdf-cpf' }
        }
      }
    }
    return null
  }

  // ---- lê a planilha ----
  const wb = XLSX.readFile('dados-locais/OCC todas 180726 (tratado).xlsx')
  const ABAS = wb.SheetNames
  const payloads = []
  const stats = { porAba: {}, casamento: { 'pdf-cpf': 0, nome: 0, placeholder: 0 } }
  const semTipo = []
  const semData = []

  for (const aba of ABAS) {
    const ws = wb.Sheets[aba]
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1).filter((l) => l.some((c) => c !== undefined && c !== null && c !== ''))
    stats.porAba[aba] = { total: linhas.length, importadas: 0 }

    for (const l of linhas) {
      let dataLanc, seq, tipo, titulo, local, codigo, funcionario, observacao
      if (aba === 'registros de rh e inspetoria') {
        ;[dataLanc, seq, , , tipo, titulo, local, codigo, funcionario, observacao] = l
      } else {
        ;[dataLanc, seq, , tipo, titulo, local, codigo, funcionario, observacao] = l
      }

      const tipoTrim = String(tipo || '').trim()
      const infoTipo = TIPOS[tipoTrim]
      if (!infoTipo) {
        semTipo.push({ aba, tipo: tipoTrim })
        continue
      }

      const data = serialParaData(dataLanc)
      if (!data) {
        semData.push({ aba, seq, funcionario })
        continue
      }

      const casamento = casar(codigo, funcionario)
      const via = casamento ? casamento.via : 'placeholder'
      stats.casamento[via]++

      const obs = String(observacao ?? '').trim()
      const descricao = obs && obs.toLowerCase() !== 'nan'
        ? obs
        : `Ocorrência nº ${seq} registrada no sistema antigo.${casamento ? '' : `\n\nColaborador no sistema antigo: ${String(funcionario || '').trim()}`}`

      payloads.push({
        colaborador_id: casamento ? casamento.colaborador.id : PLACEHOLDER_ID,
        empresa_id: EMPRESA_ID,
        colaborador_nome: casamento ? null : String(funcionario || '').trim() || null,
        tipo_ocorrencia: tipoTrim,
        macro_grupo: infoTipo.macroGrupo,
        titulo: titulo ? `[${seq}] ${String(titulo).trim()}` : `[${seq}] ${tipoTrim}`,
        data_ocorrencia: data,
        descricao,
        status: 'Ativa',
        tipo_penalidade: tipoTrim,
        base_legal: infoTipo.baseLegal,
        gravidade: infoTipo.gravidade,
        data_hora_ocorrido: data,
        local_ocorrido: local ? String(local).trim() : null,
        usuario_id: USUARIO_ID,
      })
      stats.porAba[aba].importadas++
    }
  }

  console.log(`\nPayloads montados: ${payloads.length}`)
  console.log('Casamento:', JSON.stringify(stats.casamento))
  console.log('Sem tipo reconhecido:', semTipo.length, semTipo.slice(0, 5))
  console.log('Sem data válida:', semData.length, semData.slice(0, 5))

  // ---- insere em lotes de 500 ----
  let inseridas = 0
  for (let i = 0; i < payloads.length; i += 500) {
    const lote = payloads.slice(i, i + 500)
    await req('POST', 'ocorrencias', lote)
    inseridas += lote.length
    console.log(`Inseridas ${inseridas}/${payloads.length}`)
  }

  console.log('\n=== RESUMO POR ABA ===')
  for (const [aba, s] of Object.entries(stats.porAba)) {
    console.log(` ${aba}: ${s.importadas}/${s.total}`)
  }
  console.log('\nImportação concluída.')
}

main().catch((e) => {
  console.error('FALHOU:', e.message)
  process.exit(1)
})
