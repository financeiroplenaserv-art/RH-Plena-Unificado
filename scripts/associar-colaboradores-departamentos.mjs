import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function carregarEnv(caminho) {
  if (!fs.existsSync(caminho)) return
  const conteudo = fs.readFileSync(caminho, 'utf-8')
  for (const linha of conteudo.split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const chave = trimmed.slice(0, idx).trim()
    const valor = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    process.env[chave] = valor
  }
}

carregarEnv(path.resolve(process.cwd(), '.env'))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_ANON_KEY) são obrigatórias')
  process.exit(1)
}

const supabase = createClient(url, key)

function normalizarDepartamento(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\bCOND\.?\b/g, 'CONDOMINIO')
    .replace(/\bEDIFCIO\b/g, 'EDIFICIO')
    .replace(/\bEDIF\.?\b/g, 'EDIFICIO')
    .replace(/\bRESID\.?\b/g, 'RESIDENCIAL')
    .replace(/\bCONJ\.?\b/g, 'CONJUNTO')
    .replace(/\bADMIN\.?\b/g, 'ADMINISTRATIVO')
    .replace(/\bCOM\.?\b/g, 'COMERCIAL')
    .replace(/\bLTDA\.?\b/g, 'LTDA')
    .replace(/\bS\.?A\.?\b/g, 'SA')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\b(DE|DO|DA|DOS|DAS|E|O|A|OS|AS)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokensSignificativos(str) {
  const normalizado = normalizarDepartamento(str)
  return normalizado.split(' ').filter((t) => t.length > 1)
}

async function associar() {
  console.log('Carregando colaboradores...')
  const { data: colaboradores, error: erroColabs } = await supabase
    .from('colaboradores')
    .select('id, departamento, departamento_id')
    .not('departamento', 'is', null)

  if (erroColabs) {
    console.error('Erro ao carregar colaboradores:', erroColabs.message)
    process.exit(1)
  }

  console.log('Carregando departamentos...')
  const { data: departamentos, error: erroDepts } = await supabase
    .from('departamentos')
    .select('id, nome, nome_curto')

  if (erroDepts) {
    console.error('Erro ao carregar departamentos:', erroDepts.message)
    process.exit(1)
  }

  const deptNormalizado = (departamentos || []).map((d) => ({
    ...d,
    nomeNormalizado: normalizarDepartamento(d.nome),
    tokensCurto: tokensSignificativos(d.nome_curto || d.nome),
  }))

  const atualizacoes = []
  const naoEncontrados = new Map()

  for (const colab of colaboradores || []) {
    if (colab.departamento_id) continue
    const deptTexto = colab.departamento || ''
    const deptTextoNormalizado = normalizarDepartamento(deptTexto)

    let match = null

    // 1) Match exato pelo nome completo normalizado
    match = deptNormalizado.find((d) => d.nomeNormalizado === deptTextoNormalizado)

    // 2) Match pelo nome_curto contido no texto original do colaborador
    if (!match) {
      const deptTextoSemAcento = deptTexto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      match = deptNormalizado.find((d) => {
        if (!d.nome_curto) return false
        const curtoSemAcento = d.nome_curto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
        if (!curtoSemAcento) return false
        return deptTextoSemAcento.includes(curtoSemAcento)
      })
    }

    // 3) Match se todos os tokens significativos do nome_curto estiverem no texto
    if (!match) {
      const tokensTexto = tokensSignificativos(deptTexto)
      match = deptNormalizado.find((d) => {
        if (d.tokensCurto.length === 0) return false
        return d.tokensCurto.every((t) => tokensTexto.includes(t))
      })
    }

    if (match) {
      atualizacoes.push({ id: colab.id, departamento_id: match.id })
    } else {
      const chave = deptTexto.trim()
      naoEncontrados.set(chave, (naoEncontrados.get(chave) || 0) + 1)
    }
  }

  console.log(`\nColaboradores sem departamento_id: ${colaboradores.filter((c) => !c.departamento_id).length}`)
  console.log(`Matches encontrados: ${atualizacoes.length}`)
  console.log(`Não encontrados: ${naoEncontrados.size}`)

  if (atualizacoes.length === 0) {
    console.log('Nenhuma atualização necessária.')
    return
  }

  console.log('\nAmostra de associações:')
  atualizacoes.slice(0, 10).forEach((a) => {
    const colab = colaboradores.find((c) => c.id === a.id)
    const dept = departamentos.find((d) => d.id === a.departamento_id)
    console.log(`  ${colab?.departamento?.trim()} => ${dept?.nome_curto || dept?.nome}`)
  })

  console.log('\nAplicando atualizações...')
  let sucessos = 0
  let erros = 0

  for (let i = 0; i < atualizacoes.length; i += 50) {
    const lote = atualizacoes.slice(i, i + 50)
    const resultados = await Promise.all(
      lote.map((a) => supabase.from('colaboradores').update({ departamento_id: a.departamento_id }).eq('id', a.id))
    )

    for (const res of resultados) {
      if (res.error) {
        erros++
        console.error('Erro ao atualizar colaborador:', res.error.message)
      } else {
        sucessos++
      }
    }
  }

  console.log('\n=== Resumo ===')
  console.log(`Atualizados com sucesso: ${sucessos}`)
  console.log(`Erros: ${erros}`)

  if (naoEncontrados.size > 0) {
    console.log('\nDepartamentos de colaboradores não encontrados (primeiros 20):')
    Array.from(naoEncontrados.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([nome, qtd]) => console.log(`  - ${nome} (${qtd}x)`))
  }
}

associar().catch((err) => {
  console.error(err)
  process.exit(1)
})
