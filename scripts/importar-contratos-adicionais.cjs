// Importa os contratos adicionais da planilha do public/ para contratos_adicionais.
// Regras combinadas com o usuário:
//  - Departamento por nome_curto (trim, case-insensitive); se não existir, PULA e lista.
//  - Insalubridade/Periculosidade ficam sem dias_intrajornada.
//  - Só contratos; vínculos depois.
//  - Não duplica: pula contratos cujo nome já existe no banco.

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

const ARQUIVO = 'public/Planilha com todos os adicionais para importar para corh.xlsx'

// Exceções: nome na planilha -> id do departamento no banco (match manual,
// pois o nome_curto cadastrado difere do usado na planilha).
const MAPA_EXCECOES = {
  'carmo': null, // preenchido em runtime por nome
  'great place': null,
  'matizes': null,
  'chácara itaguaí': null,
  'quincas': null,
  'quincas pat.': null,
  'jardim fonseca': null,
  'pq dos príncipes': null,
}

// Busca textual por similaridade para resolver as exceções
const BUSCA_EXCECOES = {
  'carmo': 'CARMO CAMPANELLA',
  'great place': 'GREAT PLACE',
  'matizes': 'MATIZES ICARA',
  'chácara itaguaí': 'CHÁCARA ITAGUAI',
  'quincas': 'QUINCAS PATRIMONIAL',
  'quincas pat.': 'QUINCAS PATRIMONIAL',
  'jardim fonseca': 'FONSECA',
  'pq dos príncipes': 'PARQUE DOS PRÍNCIPES',
}

const REGIME_MAP = { '12*36': '12x36', '6*1': '6x1', '5*2': '5x2' }
const ADICIONAL_MAP = {
  Insalubridade: 'insalubridade',
  Noturno: 'noturno',
  Periculosidade: 'periculosidade',
  Intrajornada: 'intrajornada',
}

function diasIntrajornada(texto) {
  const t = (texto || '').trim().toLowerCase()
  if (t === 'todos') return [0, 1, 2, 3, 4, 5, 6, 7]
  if (t === 'dom e feriado') return [0, 7]
  if (t === 'sáb, dom e feriado' || t === 'sab, dom e feriado') return [0, 6, 7]
  if (t === 'dom') return [0]
  return []
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
  // 1. Departamentos do banco, indexados por nome_curto e por nome (lowercase)
  const deptos = await req('GET', 'departamentos?select=id,nome,nome_curto,status&status=eq.Ativo')
  const porNomeCurto = new Map()
  const porNome = new Map()
  for (const d of deptos) {
    if (d.nome_curto) porNomeCurto.set(d.nome_curto.trim().toLowerCase(), d)
    if (d.nome) porNome.set(d.nome.trim().toLowerCase(), d)
  }

  // 2. Contratos já existentes (evitar duplicar)
  const existentes = await req('GET', 'contratos_adicionais?select=nome')
  const nomesExistentes = new Set((existentes || []).map((c) => (c.nome || '').trim().toLowerCase()))

  // 3. Ler planilha
  const wb = XLSX.readFile(ARQUIVO)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1).filter((l) => l[0])

  const inserir = []
  const pulados = []
  const jaExistiam = []

  for (const l of linhas) {
    const [nome, deptoPlanilha, qtd, regime, adicional, dias] = l
    const nomeContrato = String(nome || '').trim()
    const nomeDepto = String(deptoPlanilha || '').trim().toLowerCase()

    if (nomesExistentes.has(nomeContrato.toLowerCase())) {
      jaExistiam.push(nomeContrato)
      continue
    }

    let depto = porNomeCurto.get(nomeDepto) || porNome.get(nomeDepto)
    if (!depto && BUSCA_EXCECOES[nomeDepto]) {
      const termo = BUSCA_EXCECOES[nomeDepto]
      depto = deptos.find(
        (d) =>
          (d.nome_curto || '').toUpperCase().includes(termo) ||
          (d.nome || '').toUpperCase().includes(termo)
      )
    }
    if (!depto) {
      pulados.push({ contrato: nomeContrato, departamento: String(deptoPlanilha || '').trim() })
      continue
    }

    const chaveAdicional = ADICIONAL_MAP[String(adicional || '').trim()]
    if (!chaveAdicional) {
      pulados.push({ contrato: nomeContrato, departamento: String(deptoPlanilha || '').trim(), motivo: 'adicional desconhecido: ' + adicional })
      continue
    }

    inserir.push({
      nome: nomeContrato,
      departamento_id: depto.id,
      quantidade_colaboradores: Number(qtd) || 0,
      regime_trabalho: REGIME_MAP[String(regime || '').trim()] || '12x36',
      adicionais: {
        insalubridade: chaveAdicional === 'insalubridade',
        noturno: chaveAdicional === 'noturno',
        periculosidade: chaveAdicional === 'periculosidade',
        feriado: false,
        intrajornada: chaveAdicional === 'intrajornada',
      },
      dias_intrajornada: chaveAdicional === 'intrajornada' ? diasIntrajornada(String(dias || '')) : [],
    })
  }

  console.log(`Lidos da planilha: ${linhas.length}`)
  console.log(`A inserir: ${inserir.length}`)
  console.log(`Já existiam (pulados): ${jaExistiam.length}`)
  console.log(`Departamento não encontrado (pulados): ${pulados.length}`)

  if (inserir.length > 0) {
    await req('POST', 'contratos_adicionais', inserir)
    console.log(`Inseridos com sucesso: ${inserir.length}`)
  }

  if (pulados.length > 0) {
    console.log('\n--- Pulados (departamento não encontrado ou adicional desconhecido) ---')
    pulados.forEach((p) => console.log(` • ${p.contrato}  [depto: ${p.departamento}]${p.motivo ? '  ' + p.motivo : ''}`))
  }
  if (jaExistiam.length > 0) {
    console.log('\n--- Já existiam (não duplicados) ---')
    jaExistiam.forEach((n) => console.log(` • ${n}`))
  }
}

main().catch((e) => {
  console.error('FALHOU:', e.message)
  process.exit(1)
})
