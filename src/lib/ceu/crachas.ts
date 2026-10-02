/**
 * Emissão de crachás (CEU → Crachás).
 *
 * Lógica PURA (sem DOM, sem Supabase): monta o HTML completo das folhas A4 a
 * partir de `{ nome, cargo, fotoDataUrl?, logoDataUrl? }[]`. O CSS é cópia fiel
 * de docs/referencia-cracha/cracha.html (modo normal) e de
 * docs/referencia-cracha/cracha-teste-sem-cor.html (modo teste) — medidas em mm
 * exatas: cartão CR80 54 x 85,6 mm, cantos de 3 mm, grade 3x3, vão de 8 mm
 * (`--vao-corte`), A4 em pé com margem de 10 mm e marcas de corte.
 * Se mudar uma medida aqui, os arquivos de referência valem (não editá-los).
 *
 * Nada de internet: fontes locais, logo e foto entram como data URL.
 */

/** Crachás por folha A4 (3 colunas x 3 linhas). */
export const CRACHAS_POR_FOLHA = 9

/** Altura/largura máxima (px) ao reduzir foto/logo no cliente (igual ao `lerImagem` do cracha.html). */
export const LADO_MAXIMO_IMAGEM_PX = 600

export type ModoCracha = 'normal' | 'teste'

export interface DadosCracha {
  nome: string
  cargo?: string | null
  /** data URL da foto (JPEG reduzido); ausente → moldura cinza (ou "3x4" no modo teste) */
  fotoDataUrl?: string | null
  /** data URL do logo da empresa (PNG); ausente → logo padrão desenhado */
  logoDataUrl?: string | null
  /** fundo configurado para a empresa (modo normal); ausente → degradê padrão */
  fundo?: FundoCracha | null
}

// ============================================================
// Folhas
// ============================================================

/** Divide em grupos de 9 (uma folha cada) — nunca corta um crachá no meio. */
export function dividirEmFolhas<T>(itens: T[]): T[][] {
  const folhas: T[][] = []
  for (let i = 0; i < itens.length; i += CRACHAS_POR_FOLHA) {
    folhas.push(itens.slice(i, i + CRACHAS_POR_FOLHA))
  }
  return folhas
}

/** Quantas folhas A4 são necessárias para `quantidade` crachás. */
export function contarFolhas(quantidade: number): number {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return 0
  return Math.ceil(quantidade / CRACHAS_POR_FOLHA)
}

// ============================================================
// Escape e validação de entradas
// ============================================================

/** Escape HTML para texto e atributos (nome/cargo vêm de cadastro/edição manual). */
export function escaparHtml(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Só aceita data URL de imagem (nunca URL remota — nada sai/entra da internet). */
export function dataUrlImagemValida(url?: string | null): url is string {
  return typeof url === 'string' && /^data:image\/(png|jpe?g|webp|gif|svg\+xml);/i.test(url)
}

/** O crachá sai sem cargo? (a tela avisa na fila). */
export function crachaSemCargo(dados: Pick<DadosCracha, 'cargo'>): boolean {
  return !dados.cargo || dados.cargo.trim() === ''
}

// ============================================================
// Nome do crachá x cadastro
// ============================================================

/** Nome que aparece pré-preenchido: o salvo para o crachá, senão o do cadastro. */
export function nomeInicialCracha(colab: { nome_completo: string; nome_cracha?: string | null }): string {
  const salvo = colab.nome_cracha?.trim()
  return salvo ? salvo : colab.nome_completo
}

/**
 * Payload do salvamento do nome do crachá (RPC `salvar_dados_cracha`).
 * Regras: NUNCA inclui `nome_completo`; nome vazio ou igual ao do cadastro
 * volta para NULL (= usar o nome do cadastro).
 */
export function payloadSalvarNomeCracha(
  colaboradorId: string,
  nomeEditado: string,
  nomeCadastro: string
): { p_colaborador_id: string; p_nome_cracha: string | null; p_atualizar_nome: true } {
  const editado = nomeEditado.trim()
  const igualAoCadastro = editado === '' || editado === nomeCadastro.trim()
  return {
    p_colaborador_id: colaboradorId,
    p_nome_cracha: igualAoCadastro ? null : editado,
    p_atualizar_nome: true,
  }
}

/** Cargo/função que aparece pré-preenchido: o salvo para o crachá, senão o do cadastro. */
export function cargoInicialCracha(colab: { cargo?: string | null; cargo_cracha?: string | null }): string {
  const salvo = colab.cargo_cracha?.trim()
  return salvo ? salvo : (colab.cargo ?? '').trim()
}

export interface PayloadTextosCracha {
  p_colaborador_id: string
  p_nome_cracha?: string | null
  p_atualizar_nome?: true
  p_cargo_cracha?: string | null
  p_atualizar_cargo?: true
}

function textoParaSalvar(editado: string, cadastro: string): string | null {
  const e = editado.trim()
  return e === '' || e === cadastro.trim() ? null : e
}

/**
 * Payload do salvamento de nome e/ou função do crachá (RPC `salvar_dados_cracha`).
 * Só inclui os campos pedidos; NUNCA inclui `nome_completo` nem `cargo`;
 * vazio ou igual ao cadastro volta para NULL (= usar o do cadastro).
 */
export function payloadSalvarTextosCracha(
  colaboradorId: string,
  campos: {
    nome?: { editado: string; cadastro: string }
    cargo?: { editado: string; cadastro: string }
  }
): PayloadTextosCracha {
  const p: PayloadTextosCracha = { p_colaborador_id: colaboradorId }
  if (campos.nome) {
    p.p_nome_cracha = textoParaSalvar(campos.nome.editado, campos.nome.cadastro)
    p.p_atualizar_nome = true
  }
  if (campos.cargo) {
    p.p_cargo_cracha = textoParaSalvar(campos.cargo.editado, campos.cargo.cadastro)
    p.p_atualizar_cargo = true
  }
  return p
}

// ============================================================
// Fundo do crachá (por empresa)
// ============================================================

export type TipoFundoCracha = 'degrade' | 'solido' | 'imagem'

export interface FundoCracha {
  tipo: TipoFundoCracha
  /** degradê: cor do topo (hex) */
  corTopo: string
  /** degradê: % da altura em que chega ao branco (0–100) */
  ponto: number
  /** sólido: cor (hex) */
  cor: string
  /** imagem: data URL (cobre o cartão: background-size cover) */
  imagem: string | null
  /** cor do texto de nome/cargo (hex) */
  corTexto: string
}

export const COR_TOPO_PADRAO = '#0aa0e2'
export const PONTO_BRANCO_PADRAO = 62
export const COR_TEXTO_PADRAO = '#000000'

export const FUNDO_CRACHA_PADRAO: FundoCracha = {
  tipo: 'degrade',
  corTopo: COR_TOPO_PADRAO,
  ponto: PONTO_BRANCO_PADRAO,
  cor: '#ffffff',
  imagem: null,
  corTexto: COR_TEXTO_PADRAO,
}

/** Aceita #rgb ou #rrggbb; devolve minúsculo em 6 dígitos, ou null. */
export function corHexValida(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const v = valor.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v)
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : null
}

/** Normaliza um fundo vindo do banco/formulário: cores hex válidas, % entre 0 e 100, imagem só em data URL. */
export function normalizarFundoCracha(valor: unknown): FundoCracha {
  const v = (valor && typeof valor === 'object' ? valor : {}) as Record<string, unknown>
  const tipo: TipoFundoCracha = v.tipo === 'solido' || v.tipo === 'imagem' ? v.tipo : 'degrade'
  const pontoNum = typeof v.ponto === 'number' && Number.isFinite(v.ponto) ? v.ponto : PONTO_BRANCO_PADRAO
  const imagem = typeof v.imagem === 'string' && dataUrlImagemValida(v.imagem) ? v.imagem : null
  return {
    tipo: tipo === 'imagem' && !imagem ? 'degrade' : tipo,
    corTopo: corHexValida(v.corTopo) ?? COR_TOPO_PADRAO,
    ponto: Math.min(100, Math.max(0, Math.round(pontoNum))),
    cor: corHexValida(v.cor) ?? '#ffffff',
    imagem,
    corTexto: corHexValida(v.corTexto) ?? COR_TEXTO_PADRAO,
  }
}

/** Declaração CSS inline do fundo do cartão (modo normal). Só valores já validados. */
export function cssFundoCracha(fundo?: FundoCracha | null): string {
  const f = normalizarFundoCracha(fundo ?? FUNDO_CRACHA_PADRAO)
  if (f.tipo === 'solido') return `background:${f.cor};`
  if (f.tipo === 'imagem' && f.imagem) {
    return `background:#fff url('${f.imagem}') center / cover no-repeat;`
  }
  return `background:linear-gradient(to bottom, ${f.corTopo} 0%, #fff ${f.ponto}%, #fff 100%);`
}

// ============================================================
// Configuração de logos e fundos por empresa (configuracoes.cracha_config)
// ============================================================

export interface ConfigCracha {
  /** logo em data URL (PNG) por empresa_id */
  logos: Record<string, string>
  /** fundo por empresa_id (ausente → degradê padrão) */
  fundos: Record<string, FundoCracha>
}

export const CONFIG_CRACHA_PADRAO: ConfigCracha = { logos: {}, fundos: {} }

/** Normaliza o valor guardado (string JSON ou objeto), descartando logos inválidos. */
export function normalizarConfigCracha(valor: unknown): ConfigCracha {
  let obj: unknown = valor
  if (typeof valor === 'string') {
    try {
      obj = JSON.parse(valor)
    } catch {
      return { logos: {}, fundos: {} }
    }
  }
  const logosBrutos = (obj as { logos?: unknown } | null)?.logos
  const logos: Record<string, string> = {}
  if (logosBrutos && typeof logosBrutos === 'object') {
    for (const [empresaId, url] of Object.entries(logosBrutos as Record<string, unknown>)) {
      if (dataUrlImagemValida(typeof url === 'string' ? url : null)) logos[empresaId] = url as string
    }
  }
  const fundosBrutos = (obj as { fundos?: unknown } | null)?.fundos
  const fundos: Record<string, FundoCracha> = {}
  if (fundosBrutos && typeof fundosBrutos === 'object') {
    for (const [empresaId, f] of Object.entries(fundosBrutos as Record<string, unknown>)) {
      fundos[empresaId] = normalizarFundoCracha(f)
    }
  }
  return { logos, fundos }
}

/** Fundo da empresa; sem configuração → undefined = degradê padrão. */
export function fundoDaEmpresa(config: ConfigCracha, empresaId?: string | null): FundoCracha | undefined {
  if (!empresaId) return undefined
  return config.fundos[empresaId]
}

/** Logo da empresa; sem logo configurado (ou colaborador sem empresa) → undefined = logo padrão. */
export function logoDaEmpresa(config: ConfigCracha, empresaId?: string | null): string | undefined {
  if (!empresaId) return undefined
  return config.logos[empresaId]
}

// ============================================================
// CSS (cópia fiel dos arquivos de referência)
// ============================================================

/** Valor único do espaço entre crachás na impressão (mínimo recomendado 6mm). */
export const VAO_CORTE = '8mm'

const CSS_BASE = `  :root {
    --azul: #1a9be0;
    --azul-topo: #0aa0e2;
    --vao-corte: ${VAO_CORTE}; /* espaço entre crachás na impressão (margem de corte). Mínimo recomendado: 6mm */
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, "Segoe UI", Arial, sans-serif; }`

/** Regras do cartão (tamanho real em mm). Usadas na folha e na pré-visualização da fila. */
export function cssCracha(modo: ModoCracha): string {
  if (modo === 'teste') {
    return `  .cracha {
    width: 54mm; height: 85.6mm; position: relative; overflow: hidden;
    border-radius: 3mm; background: #fff;
    font-family: Arial, Helvetica, sans-serif; color: #000; text-align: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* MODELO DE TESTE: contorno preto de 0,2mm desenhado por cima, sem alterar medidas internas */
  .cracha::after { content: ""; position: absolute; inset: 0; border: .2mm solid #000; border-radius: 3mm; pointer-events: none; }
  .cracha .logo { position: absolute; top: 8.6mm; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; }
  .cracha .logo > svg { width: 13.6mm; height: 13.6mm; display: block; }
  .cracha .logo > img { max-width: 30mm; max-height: 26mm; display: block; }
  .cracha .marca { margin-top: .2mm; color: #c4c4c4; font-family: "Varela Round", "Nunito", "Segoe UI", "Trebuchet MS", Arial, sans-serif; /* só fontes locais, sem internet */ line-height: 1; }
  .cracha .plena { font-size: 9.6mm; line-height: .9; letter-spacing: -.1mm; display: block; text-align: left; }
  .cracha .facilities { font-size: 3.3mm; display: block; text-align: right; margin-top: -.6mm; letter-spacing: .15mm; }
  .cracha .logo-ph { width: 30mm; height: 20mm; border: .2mm dashed #999; color: #999; font-size: 3.3mm; display: flex; align-items: center; justify-content: center; }
  .cracha .foto { position: absolute; top: 36.8mm; left: 50%; transform: translateX(-50%); width: 22mm; height: 29.33mm; border: .2mm solid #999; background: #fff; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 2.6mm; }
  .cracha .nome { position: absolute; top: 67.8mm; left: 2mm; right: 2mm; font-weight: 400; color: #888; font-size: 3.3mm; text-transform: uppercase; line-height: 1.15; }
  .cracha .cargo { position: absolute; top: 75.4mm; left: 2mm; right: 2mm; font-weight: 400; color: #888; font-size: 3.3mm; text-transform: uppercase; line-height: 1.15; }`
  }
  return `  .cracha {
    width: 54mm; height: 85.6mm; position: relative; overflow: hidden;
    border-radius: 3mm; background: linear-gradient(to bottom, var(--azul-topo) 0%, #fff 62%, #fff 100%);
    font-family: Arial, Helvetica, sans-serif; color: #000; text-align: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .cracha .logo { position: absolute; top: 8.6mm; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; }
  .cracha .logo > svg { width: 13.6mm; height: 13.6mm; display: block; }
  .cracha .logo > img { max-width: 30mm; max-height: 26mm; display: block; }
  .cracha .marca { margin-top: .2mm; color: var(--azul); font-family: "Varela Round", "Nunito", "Segoe UI", "Trebuchet MS", Arial, sans-serif; /* só fontes locais, sem internet */ line-height: 1; }
  .cracha .plena { font-size: 9.6mm; line-height: .9; letter-spacing: -.1mm; display: block; text-align: left; }
  .cracha .facilities { font-size: 3.3mm; display: block; text-align: right; margin-top: -.6mm; letter-spacing: .15mm; }
  .cracha .foto { position: absolute; top: 36.8mm; left: 50%; transform: translateX(-50%); width: 22mm; height: 29.33mm; border: .25mm solid #000; background: #e9eef2; object-fit: cover; display: block; }
  .cracha .nome { position: absolute; top: 67.8mm; left: 2mm; right: 2mm; font-weight: 700; font-size: 3.3mm; text-transform: uppercase; line-height: 1.15; }
  .cracha .cargo { position: absolute; top: 75.4mm; left: 2mm; right: 2mm; font-weight: 400; font-size: 3.3mm; text-transform: uppercase; line-height: 1.15; }`
}

/**
 * Layout das folhas A4: página A4 com margem de 10mm => área útil 190 x 277mm.
 * Grade 3 x 3: largura = 3*54 + 2*vão (8mm) = 178mm; altura = 3*85,6 + 2*vão = 272,8mm. Cabe.
 * Se mudar --vao-corte, mantenha 3*85,6 + 2*vão <= 277mm (vão máximo ~9,9mm).
 */
export function cssFolhas(modo: ModoCracha): string {
  const teste = modo === 'teste'
  const regua = teste
    ? `
    .folha { position: relative; }
    /* régua de conferência (só na 1ª folha): cabe no espaço livre abaixo da fileira de baixo, entre as marcas de corte da coluna do meio */
    .folha:first-child::after { content: "40 mm"; position: absolute; left: 75mm; top: 273.8mm; width: 40mm; height: 2.8mm;
      font: 1.8mm/1.6mm Arial, Helvetica, sans-serif; color: #666; text-align: center; --c: #000;
      background:
        linear-gradient(var(--c),var(--c)) 0 100% / 100% .15mm no-repeat,
        linear-gradient(var(--c),var(--c)) 0 100% / .15mm 1.8mm no-repeat,
        linear-gradient(var(--c),var(--c)) 100% 100% / .15mm 1.8mm no-repeat; }`
    : ''
  const contornoCelula = teste
    ? '.celula .cracha { zoom: 1; box-shadow: none; border-radius: 3mm; }'
    : '.celula .cracha { zoom: 1; box-shadow: none; border-radius: 3mm; outline: .1mm solid #ccc; }'

  return `  @page { size: A4 portrait; margin: 10mm; }
  .faixa-teste { background: #222; color: #ffd400; text-align: center; font-weight: 700; padding: 10px 12px; letter-spacing: .03em; font-size: .95rem; }
  .aviso-impressao { background: #fff7d6; color: #5b4a00; text-align: center; padding: 8px 12px; font-size: .85rem; }
  /* na tela (pré-visualização): cada folha vira uma "página" A4 sobre fundo cinza */
  @media screen {
    body { background: #d9dee3; }
    .folha { width: 210mm; padding: 10mm; background: #fff; margin: 10px auto; box-shadow: 0 2px 10px rgba(0,0,0,.25); }
    .folha:first-child::after { left: 85mm; top: 283.8mm; }
  }
  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .faixa-teste, .aviso-impressao { display: none !important; }
  }
  .folha { display: grid; grid-template-columns: repeat(3, 54mm); grid-auto-rows: 85.6mm;
    gap: var(--vao-corte); justify-content: center; align-content: start; }
  @media print {
    .folha { width: 190mm; break-after: page; page-break-after: always; padding: 0; margin: 0; box-shadow: none; background: transparent; }
    .folha:last-child { break-after: auto; page-break-after: auto; }
  }
  .celula { position: relative; width: 54mm; height: 85.6mm; break-inside: avoid; page-break-inside: avoid; }
  ${contornoCelula}
  /* marcas de corte: ficam FORA do crachá, no vão (de 1mm a 4mm de distância das bordas) */
  .celula::before { content: ""; position: absolute; inset: -4mm; pointer-events: none;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    --c: #000;
    background:
      linear-gradient(var(--c),var(--c)) 0 4mm / 3mm .15mm no-repeat,
      linear-gradient(var(--c),var(--c)) 100% 4mm / 3mm .15mm no-repeat,
      linear-gradient(var(--c),var(--c)) 0 calc(100% - 4mm) / 3mm .15mm no-repeat,
      linear-gradient(var(--c),var(--c)) 100% calc(100% - 4mm) / 3mm .15mm no-repeat,
      linear-gradient(var(--c),var(--c)) 4mm 0 / .15mm 3mm no-repeat,
      linear-gradient(var(--c),var(--c)) calc(100% - 4mm) 0 / .15mm 3mm no-repeat,
      linear-gradient(var(--c),var(--c)) 4mm 100% / .15mm 3mm no-repeat,
      linear-gradient(var(--c),var(--c)) calc(100% - 4mm) 100% / .15mm 3mm no-repeat;
  }${regua}`
}

// ============================================================
// HTML do crachá e das folhas
// ============================================================

const LOGO_PADRAO_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="50" fill="#1a9be0"/>
    <!-- P estilizado: haste com ponta curva embaixo e bojo arredondado -->
    <path fill="#fff" fill-rule="evenodd" d="M36 24h22a19 19 0 0 1 0 38H50v6c0 5-4 9-9 9H27c3-3 5-6 5-10V28c0-2 2-4 4-4zm14 11v16h8a8 8 0 0 0 0-16z"/>
  </svg>`

const LOGO_PADRAO_SVG_TESTE = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="49" fill="none" stroke="#bbb" stroke-width="1.5"/>
    <path fill="none" stroke="#bbb" stroke-width="1.5" fill-rule="evenodd" d="M36 24h22a19 19 0 0 1 0 38H50v6c0 5-4 9-9 9H27c3-3 5-6 5-10V28c0-2 2-4 4-4zm14 11v16h8a8 8 0 0 0 0-16z"/>
  </svg>`

const MARCA_PADRAO = '<div class="marca"><span class="plena">plena</span><span class="facilities">facilities</span></div>'

const FOTO_VAZIA =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="3" height="4"><rect width="3" height="4" fill="#e9eef2"/></svg>')

/** HTML de UM crachá (`<div class="cracha">`), usado na folha e na miniatura da fila. */
export function montarCracha(dados: DadosCracha, modo: ModoCracha = 'normal'): string {
  const teste = modo === 'teste'
  const nome = escaparHtml(dados.nome ?? '')
  const cargo = escaparHtml(dados.cargo ?? '')
  const logoValido = dataUrlImagemValida(dados.logoDataUrl)
  const fotoValida = dataUrlImagemValida(dados.fotoDataUrl)

  let logo: string
  if (logoValido) {
    logo = teste
      ? '<div class="logo-ph">LOGO</div>'
      : `<img src="${escaparHtml(dados.logoDataUrl as string)}" alt="Logo da empresa">`
  } else {
    logo = (teste ? LOGO_PADRAO_SVG_TESTE : LOGO_PADRAO_SVG) + MARCA_PADRAO
  }

  const foto = teste
    ? '<div class="foto">3x4</div>' // a foto não é impressa: só a moldura 3x4
    : `<img class="foto" alt="Foto de ${nome}" src="${escaparHtml(fotoValida ? (dados.fotoDataUrl as string) : FOTO_VAZIA)}">`

  // Fundo e cor do texto configurados valem só no modo normal (o teste é sempre branco)
  const fundo = teste || !dados.fundo ? null : normalizarFundoCracha(dados.fundo)
  const estiloCracha = fundo ? ` style="${escaparHtml(cssFundoCracha(fundo))}"` : ''
  const estiloTexto = fundo && fundo.corTexto !== COR_TEXTO_PADRAO ? ` style="color:${fundo.corTexto}"` : ''
  return `<div class="cracha"${estiloCracha}><div class="logo">${logo}</div>${foto}<div class="nome"${estiloTexto}>${nome}</div><div class="cargo"${estiloTexto}>${cargo}</div></div>`
}

/** Apenas as `<div class="folha">…` (sem documento), uma por 9 crachás. */
export function montarFolhas(dados: DadosCracha[], modo: ModoCracha = 'normal'): string {
  return dividirEmFolhas(dados)
    .map(
      (grupo) =>
        `<div class="folha">${grupo.map((d) => `<div class="celula">${montarCracha(d, modo)}</div>`).join('')}</div>`
    )
    .join('\n')
}

/** Documento HTML completo para impressão (iframe) e pré-visualização. */
export function montarDocumentoCrachas(dados: DadosCracha[], modo: ModoCracha = 'normal'): string {
  const teste = modo === 'teste'
  const faixa = teste ? '<div class="faixa-teste">MODELO DE TESTE — sem cor, para conferir medidas</div>' : ''
  const aviso = '<div class="aviso-impressao">Imprima em "Tamanho real" / 100%, sem ajustar à página.</div>'
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${teste ? 'Crachás - MODELO DE TESTE sem cor' : 'Crachás'}</title>
<style>
${CSS_BASE}
${cssCracha(modo)}
${cssFolhas(modo)}
</style>
</head>
<body>
${faixa}${aviso}
<div id="folhas">
${montarFolhas(dados, modo)}
</div>
</body>
</html>`
}
