/* Informativo de Apresentação de Colaborador — folha A4 afixada nos elevadores
 * dos prédios (modelo de referência: "Informativo de Apresentação Colaborador.pdf"
 * em dados-locais). Decisão da gestão: só PDF, nada é gravado no banco; o texto
 * padrão vem preenchido com os dados do cadastro e é editável na hora.
 *
 * Lógica pura (sem DOM/Supabase): nome curto, texto padrão com variáveis,
 * parser do texto editável (**negrito**) e montagem do HTML de impressão.
 * O "P" com fotos (public/plena_p_fotos.jpg) foi extraído do PDF do modelo —
 * não existe arquivo original em boa resolução.
 */
import type { FocoFotoQuadro } from '@/types/database'
import { escaparHtml } from './crachas'
import { cssFocoFoto, focoAfastado } from './quadro'

// ---------- textos ----------

export const SLOGAN_PLENA = 'Plena desenvolvendo pessoas e buscando talentos!'

const PREPOSICOES = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

/** "Flaviano da Silva Vicente" → "Flaviano Silva" (1º nome + 1º sobrenome sem preposição). */
export function primeiroNomeSobrenome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  const sobrenome = partes.slice(1).find((p) => !PREPOSICOES.has(p.toLowerCase()))
  return sobrenome ? `${partes[0]} ${sobrenome}` : partes[0]
}

export interface VariaveisTextoApresentacao {
  funcao: string
  nomeCompleto: string
  cliente: string
}

/**
 * Texto padrão do corpo do informativo (editável na tela; ** = negrito,
 * parágrafos separados por linha em branco). Sem pronome "Ele/Ela" de propósito:
 * o cadastro não guarda gênero e o informativo não pode errar isso.
 */
export function textoPadraoApresentacao({ funcao, nomeCompleto, cliente }: VariaveisTextoApresentacao): string {
  const apresentacao = funcao.trim()
    ? `Apresentamos o nosso colaborador **${funcao.trim()} ${nomeCompleto.trim()}**.`
    : `Apresentamos o nosso colaborador **${nomeCompleto.trim()}**.`
  const noCliente = cliente.trim() ? ` no **${cliente.trim()}**` : ''
  return [
    'Prezado(a) Cliente,',
    `${apresentacao} Receberá toda a orientação necessária, o acompanhamento e o treinamento da Supervisão e Inspetoria Operacional da Plena para o bom desempenho de suas atividades${noCliente}.`,
    `Desejamos a **${primeiroNomeSobrenome(nomeCompleto)}** sucesso em seu novo desafio profissional, garantindo assim a qualidade Plena de atendimento e prestação de serviços!`,
  ].join('\n\n')
}

/** Texto editável → HTML seguro: escapa tudo, **negrito**, linha em branco = parágrafo. */
export function textoInformativoParaHtml(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const seguro = escaparHtml(p).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      return `<p>${seguro.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')
}

// ---------- documento ----------

export interface DadosInformativoApresentacao {
  /** nome sob a foto (padrão: primeiroNomeSobrenome do cadastro) */
  nomeExibicao: string
  funcao: string
  /** nome do posto/cliente no cartaz (só aparece dentro do texto) */
  cliente: string
  /** corpo editável (**negrito**, parágrafos por linha em branco) */
  texto: string
  fotoDataUrl: string | null
  foco: FocoFotoQuadro | null
  /** logo da empresa (mesmo do quadro/crachá) */
  logoDataUrl: string
  /** "P" com fotos da Plena */
  pFotosDataUrl: string
  /** selo redondo 30 anos do rodapé */
  logo30DataUrl: string | null
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #0C1730;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pagina {
    width: 210mm; height: 297mm;
    padding: 12mm 14mm 0;
    display: flex; flex-direction: column;
    background: #fff;
  }

  header { display: flex; align-items: center; gap: 6mm; }
  header img.logo { height: 15mm; }
  header .linha-vertical { width: 0.5mm; align-self: stretch; background: linear-gradient(180deg, #0F6CBD, #0aa0e2); border-radius: 1mm; }
  header .sobre {
    font-size: 8pt; font-weight: 600; letter-spacing: 0.26em;
    text-transform: uppercase; color: #0F6CBD;
  }
  header h1 { font-size: 23pt; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
  header .sub { font-size: 9pt; color: #5a6b85; margin-top: 1mm; }
  .faixa {
    height: 1.4mm; margin: 4mm 0 6mm;
    background: linear-gradient(90deg, #0C1730 0%, #0F6CBD 45%, #0aa0e2 100%);
    border-radius: 1mm;
  }

  .palco {
    display: flex; align-items: center; justify-content: space-between;
    padding: 2mm 10mm 0;
  }
  .palco img.p-fotos { height: 84mm; }

  .pessoa { text-align: center; }
  .foto-wrap {
    width: 52mm; aspect-ratio: 3 / 4; margin: 0 auto;
    border: 0.4mm solid #d8e2ee; border-radius: 3mm;
    box-shadow: 0 2mm 6mm rgba(12, 23, 48, 0.12);
    background: #eef3f9; overflow: hidden; position: relative;
  }
  .foto { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  /* zoom < 1 (afastar): a mesma foto desfocada cobre as bordas vazias */
  .foto.fundo { filter: blur(8px) brightness(0.92); transform: scale(1.15); }
  .foto.sem-foto { display: flex; align-items: center; justify-content: center; }
  .foto.sem-foto svg { width: 60%; }
  .nome-exib {
    margin-top: 4mm; font-size: 17pt; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.15;
    max-width: 82mm;
  }
  .funcao-exib {
    margin-top: 1.2mm; font-size: 11pt; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase; color: #0F6CBD;
  }

  .texto {
    flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 0 8mm; text-align: center;
  }
  .texto p { font-size: 14pt; line-height: 1.6; color: #24354d; }
  .texto p + p { margin-top: 5.5mm; }
  .texto strong { color: #0C1730; }

  .slogan {
    padding-bottom: 6mm;
    display: flex; align-items: center; gap: 5mm;
    font-size: 12.5pt; font-weight: 700; color: #0F6CBD;
    text-align: center;
  }
  .slogan::before, .slogan::after {
    content: ''; flex: 1; height: 0.4mm; background: #d8e2ee; border-radius: 1mm;
  }

  footer {
    margin: 0 -14mm;
    background: #0C1730; color: #cfe0f2;
    padding: 3mm 14mm;
    display: flex; align-items: center; justify-content: space-between; gap: 6mm;
  }
  footer .contatos { font-size: 7pt; line-height: 1.5; }
  footer .contatos b { color: #fff; font-weight: 600; }
  footer img.logo30 { height: 13mm; }
`

const PLACEHOLDER_FOTO = `<div class="foto sem-foto"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#b8cbe0"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" fill="#b8cbe0"/></svg></div>`

/** Documento A4 completo do informativo de apresentação (uma página). */
export function montarDocumentoInformativo(dados: DadosInformativoApresentacao): string {
  const fundo = dados.fotoDataUrl && focoAfastado(dados.foco)
    ? `<img class="foto fundo" src="${escaparHtml(dados.fotoDataUrl)}" alt="">`
    : ''
  const foto = dados.fotoDataUrl
    ? `${fundo}<img class="foto" style="${cssFocoFoto(dados.foco)}" src="${escaparHtml(dados.fotoDataUrl)}" alt="">`
    : PLACEHOLDER_FOTO
  const funcao = dados.funcao.trim()
    ? `<div class="funcao-exib">${escaparHtml(dados.funcao.trim())}</div>`
    : ''
  const logo30 = dados.logo30DataUrl
    ? `<img class="logo30" src="${escaparHtml(dados.logo30DataUrl)}" alt="Plena 30 anos">`
    : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Apresentação — ${escaparHtml(dados.nomeExibicao)}</title>
<style>${CSS}</style>
</head>
<body>
  <div class="pagina">
    <header>
      <img class="logo" src="${escaparHtml(dados.logoDataUrl)}" alt="Plena">
      <div class="linha-vertical"></div>
      <div>
        <div class="sobre">Informativo Operacional</div>
        <h1>Apresentação de Colaborador</h1>
        <div class="sub">Recursos Humanos · Plena Facilities</div>
      </div>
    </header>
    <div class="faixa"></div>
    <div class="palco">
      <img class="p-fotos" src="${escaparHtml(dados.pFotosDataUrl)}" alt="">
      <div class="pessoa">
        <div class="foto-wrap">${foto}</div>
        <div class="nome-exib">${escaparHtml(dados.nomeExibicao)}</div>
        ${funcao}
      </div>
    </div>
    <div class="texto">
${textoInformativoParaHtml(dados.texto)}
    </div>
    <div class="slogan">${escaparHtml(SLOGAN_PLENA)}</div>
    <footer>
      <div class="contatos">
        <b>Plena Facilities</b> — Rua Dr. Borman, 23 · Grupo 1206 a 1210 · Centro · Niterói/RJ<br>
        Tels: (21) 2621-0111 · 3619-7036 · 99493-8248 (WhatsApp) · <b>www.plenafacilities.com.br</b><br>
        facebook/plenafacilities · instagram/plena_facilities
      </div>
      ${logo30}
    </footer>
  </div>
</body>
</html>
`
}
