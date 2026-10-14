// Leitura dos Google Forms de pedido (um por contrato) para a carga do kit de
// uniforme/EPI (scripts/materiais/carregar-uniformes-contratos.ts).
// - Os links vêm da aba 1 ("Kit Mensal e Link por cliente") de
//   docs/Pedido de material/pedido_materiais_todas_abas.md — arquivo grande e
//   com dados pessoais: aqui só se lê a seção 1 e só as colunas nome + link.
// - A estrutura de cada form vem do FB_PUBLIC_LOAD_DATA_ da página pública.
// NUNCA versionar os HTMLs baixados (ficam em dados-locais/).
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

export interface LinkForm {
  nomePlanilha: string
  url: string
}

/** Nome do contrato sem as anotações da planilha: "CNOOC (sem dados p/ KIT MENSAL)" → "CNOOC". */
export function limparNomePlanilha(nome: string): string {
  return nome.replace(/\(.*$/, '').trim()
}

/** Links (nome + URL) da seção 1 do markdown — não lê o resto do arquivo. */
export function extrairLinksForms(arquivoMd: string): LinkForm[] {
  const texto = fs.readFileSync(arquivoMd, 'utf8')
  const ini = texto.indexOf('## 1.')
  const fim = texto.indexOf('## 2.', ini + 1)
  if (ini < 0 || fim < 0) throw new Error('Seção 1 não encontrada em ' + arquivoMd)
  const links: LinkForm[] = []
  for (const linha of texto.slice(ini, fim).split('\n')) {
    const celulas = linha.split('|').map((c) => c.trim())
    const url = celulas.find((c) => /^https:\/\/(forms\.gle|docs\.google\.com\/forms)\//.test(c))
    if (!url) continue
    const nome = limparNomePlanilha(celulas[2] ?? '')
    if (!nome || /^MODELO/i.test(nome)) continue
    links.push({ nomePlanilha: nome, url })
  }
  return links
}

export interface PerguntaForm {
  secao: string
  tipo: number
  titulo: string
  ajuda: string
}

/** Perguntas do form a partir do FB_PUBLIC_LOAD_DATA_ (tipo 8 = cabeçalho de seção). */
export function perguntasDoHtml(html: string): { titulo: string; perguntas: PerguntaForm[] } {
  const m = html.match(/FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/s)
  if (!m) throw new Error('FB_PUBLIC_LOAD_DATA_ não encontrado')
  const dados = JSON.parse(m[1])
  const itens = (dados?.[1]?.[1] ?? []) as unknown[][]
  let secao = ''
  const perguntas: PerguntaForm[] = []
  for (const q of itens) {
    const titulo = String(q[1] ?? '').replace(/\s+/g, ' ').trim()
    const ajuda = String(q[2] ?? '').replace(/\s+/g, ' ').trim()
    const tipo = Number(q[3])
    if (tipo === 8) {
      secao = titulo
      continue
    }
    perguntas.push({ secao, tipo, titulo, ajuda })
  }
  return { titulo: String(dados?.[1]?.[8] ?? ''), perguntas }
}

/** Baixa (com cache em dados-locais/materiais_forms/) a página pública do form. */
export function baixarForm(url: string, dirCache: string, offline: boolean): string | null {
  fs.mkdirSync(dirCache, { recursive: true })
  const arq = path.join(dirCache, url.replace(/[^a-zA-Z0-9]+/g, '_') + '.html')
  if (!fs.existsSync(arq)) {
    if (offline) return null
    try {
      execFileSync('curl', ['-sL', '-m', '40', '-A', 'Mozilla/5.0', url, '-o', arq], { stdio: 'pipe' })
    } catch {
      return null
    }
  }
  const html = fs.readFileSync(arq, 'utf8')
  return html.includes('FB_PUBLIC_LOAD_DATA_') ? html : null
}

const IGNORAR = /^(VOCE PRECISA|SERA PRECISO|E NECESSARIO|UNIFORMES DE OUTRAS|OUTROS EPI|DECLARO|OUTRO)/

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

/** Perguntas de peça (uniforme/EPI) do form: seção de uniformes/EPI, sem as perguntas de controle. */
export function pecasDoForm(perguntas: PerguntaForm[]): { tipo: 'uniforme' | 'epi'; titulo: string; peca: string; usadaPor: string }[] {
  const saida: { tipo: 'uniforme' | 'epi'; titulo: string; peca: string; usadaPor: string }[] = []
  for (const p of perguntas) {
    const sec = semAcento(p.secao)
    const tipo = /EPI|EQUIPAMENTO DE PROTECAO/.test(sec) ? 'epi' : /UNIFORME/.test(sec) ? 'uniforme' : null
    if (!tipo) continue
    const t = semAcento(p.titulo)
    if (!t || IGNORAR.test(t)) continue
    // "PEÇA: UTILIZADA POR X / Y" ou "PEÇA - UTILIZADA PELAS X"
    const m = p.titulo.match(/^(.*?)(?::|\s-\s)\s*(?:UTILIZAD[AO]S?\s+(?:POR|PEL[AO]S?)\s*)?(.*)$/i)
    const peca = (m ? m[1] : p.titulo).trim()
    const usadaPor = (m ? m[2] : '').trim()
    saida.push({ tipo, titulo: p.titulo, peca, usadaPor })
  }
  return saida
}
