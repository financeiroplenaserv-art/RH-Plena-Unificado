# CORH · Assinatura "Abraço" — Guia de implementação

> Especificação completa para implementar a assinatura visual da tela de login do CORH.
> Pode ser colada diretamente no Kimi Code junto com os arquivos listados na seção 2.

---

## 1. O que é

Assinatura de marca no **canto superior direito** da tela de login: dois traços manuscritos e suaves formam um coração esguio (referência a "COR" de CORH) que **abraça a logo circular Plena 30 anos**. No carregamento da página, os dois braços se desenham em sequência e a logo surge ao final — "o abraço acontece a cada login".

Decisões de design já incorporadas (não alterar sem discussão):

- **Traço suave, sem tremor** — a humanidade vem da espessura variável (afina nas pontas) e da leve assimetria entre os braços, não de irregularidade;
- **Halo escuro + anel fino** atrás da logo (via CSS) para separá-la do gradiente azul (evita "azul sobre azul");
- **Largura do coração = largura do título "CORH"** (151px em viewport de 926px) — rima proporcional entre emblema e wordmark;
- **Margem direita de ~55px**, alinhada ao grid do conteúdo;
- Logo = **48,7% da largura do container**, posicionada em porcentagem (escala junto).

---

## 2. Arquivos do kit

Copiar para `public/brand/` (ajustar caminhos no código conforme a estrutura do projeto).

### Componente (obrigatórios)
| Arquivo | Uso |
|---|---|
| `corh_abraco_draw.svg` | Camada da animação (2 paths com stroke, `pathLength="100"`) — **usar inline no HTML** |
| `corh_abraco_final.svg` | Estado final (traço cônico preenchido, com glow) — **usar inline no HTML** |
| `logo_plena_30anos_redonda.png` | Logo circular 512px, fundo transparente |

### Ícones e favicon
| Arquivo | Uso |
|---|---|
| `favicon.svg` | Favicon moderno (browsers com suporte a SVG) |
| `favicon.ico` | Fallback — 16px usa **master sólido** (legibilidade), 32/48px usam os dois traços |
| `favicon-32.png` | Fallback PNG 32px |
| `apple-touch-icon.png` | iOS 180×180 |
| `corh_icone_app_192.png` / `corh_icone_app_512.png` | PWA / Android |
| `corh_coracao_icone_branco.svg` / `_branco_512.png` | Coração solo, branco — uso sobre fundos escuros |
| `corh_coracao_icone_azul.svg` / `_azul_512.png` | Coração solo, azul #2B4FD8 — uso sobre fundos claros |
| `corh_coracao_icone_marinho.svg` | Coração solo, marinho #16225C — uso sobre fundos claros |

### Reuso / marketing
| Arquivo | Uso |
|---|---|
| `corh_emblema_logo_abracada_1024.png` | Emblema completo (coração + logo) transparente — e-mails, páginas internas, apresentações |
| `corh_og_image_1200x630.png` | Imagem social (Open Graph / WhatsApp / LinkedIn) |
| `mockup_FINAL_corh_abraco.png` | Referência visual da tela aplicada |

---

## 3. Componente (HTML + CSS)

Os dois SVGs precisam estar **inline** (a animação age nos paths). Colar o conteúdo de cada arquivo onde indicado.

```html
<!-- assinatura de marca: canto superior direito do container da tela de login -->
<div class="brand-hug" aria-hidden="true">
  <!-- 1) camada de desenho: colar aqui o conteúdo de corh_abraco_draw.svg -->
  <svg class="draw" viewBox="700 0 226 230" xmlns="http://www.w3.org/2000/svg">
    <path d="M ..." pathLength="100" stroke="#FFFFFF" stroke-opacity="0.92"
          stroke-width="2.9" fill="none" stroke-linecap="round"/>
    <path class="p2" d="M ..." pathLength="100" stroke="#FFFFFF" stroke-opacity="0.92"
          stroke-width="2.7" fill="none" stroke-linecap="round"/>
  </svg>
  <!-- 2) camada final: colar aqui o conteúdo de corh_abraco_final.svg -->
  <svg class="final" viewBox="700 0 226 230" xmlns="http://www.w3.org/2000/svg">
    <!-- paths preenchidos + filtro de glow -->
  </svg>
  <!-- 3) logo -->
  <img src="/brand/logo_plena_30anos_redonda.png" alt="">
</div>

<style>
/* Largura casada com o título: coração = 151px num painel de 926px.
   O clamp mantém a proporção em qualquer largura de painel. */
.brand-hug { position:absolute; top:0; right:0;
  width:clamp(168px, 24.4%, 226px); aspect-ratio:226/230; pointer-events:none; }
.brand-hug svg { position:absolute; inset:0; width:100%; height:100%; }
.brand-hug img { position:absolute; left:19.5%; top:22.9%; width:48.7%; border-radius:50%;
  box-shadow: 0 0 0 2px rgba(255,255,255,.25), 0 0 46px 16px rgba(9,14,38,.6); }

/* animação do abraço (uma vez, no load) */
.brand-hug .draw path { stroke-dasharray:100; stroke-dashoffset:100;
  animation:corh-draw 1.05s ease-in-out forwards; }
.brand-hug .draw .p2 { animation-delay:.22s; }
.brand-hug .final { opacity:0; animation:corh-fade .45s ease 1s forwards; }
.brand-hug img { opacity:0; transform:scale(.92);
  animation:corh-pop .55s cubic-bezier(.2,.9,.3,1.35) 1.15s forwards; }
@keyframes corh-draw { to { stroke-dashoffset:0; } }
@keyframes corh-fade { to { opacity:1; } }
@keyframes corh-pop  { to { opacity:1; transform:scale(1); } }

/* mobile */
@media (max-width:640px) { .brand-hug { width:132px; } }

/* acessibilidade */
@media (prefers-reduced-motion:reduce) {
  .brand-hug .draw { display:none; }
  .brand-hug .final, .brand-hug img { opacity:1; transform:none; animation:none; }
}
</style>
```

---

## 4. Regras de integração

1. O container pai da tela de login precisa de `position:relative`. O `.brand-hug` se ancora sozinho no canto (`top:0; right:0`) — **as margens já estão embutidas no viewBox**; não adicionar `margin`/`padding` nem `translate`.
2. Não alterar `width` sem manter o `aspect-ratio:226/230` (o posicionamento da logo em % depende disso).
3. Não aplicar filtros, sombras ou `opacity` extras sobre os SVGs — o glow e o halo já estão nos arquivos/CSS.
4. O componente é decorativo: manter `aria-hidden="true"` e `pointer-events:none`.
5. z-index: acima do background da tela, abaixo de qualquer modal/overlay.
6. A animação roda **uma única vez** por carregamento — sem loop, sem repetição em navegação interna (se for SPA, exibir apenas na primeira montagem da tela de login).

---

## 5. Favicon e meta tags (colocar no `<head>`)

```html
<link rel="icon" href="/brand/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<meta name="theme-color" content="#16225C">

<meta property="og:title" content="CORH — Controle Operacional e de RH">
<meta property="og:description" content="Gestão unificada de colaboradores, ocorrências, uniformes e benefícios em um só lugar.">
<meta property="og:image" content="/brand/corh_og_image_1200x630.png">
<meta property="og:type" content="website">
```

---

## 6. Checklist de aceite (QA visual)

- [ ] Coração no canto superior direito, margem direita visual ≈ 55px, respiros superior e inferior aproximadamente iguais;
- [ ] Largura do coração visualmente igual à largura do título "CORH";
- [ ] Logo nítida sobre o gradiente (halo visível, sem "azul sobre azul");
- [ ] Animação: braços se desenham em ~1s → traço final aparece → logo surge com leve pop; executa uma vez só;
- [ ] Com `prefers-reduced-motion` ativo, o estado final aparece direto, sem animação;
- [ ] Em ≤640px, o conjunto aparece reduzido (132px) e sem sobrepor conteúdo;
- [ ] Favicon legível na aba do browser (16px usa o coração sólido);
- [ ] Preview social (WhatsApp/LinkedIn) exibe a OG image.

---

## 7. Não fazer

- Não reintroduzir tremor/ruído no traço (versões anteriores foram descartadas exatamente por isso);
- Não rotacionar nem aplicar filtros na logo;
- Não usar a versão branca do ícone sobre fundos claros — usar a azul (#2B4FD8) ou a marinho (#16225C);
- Não aumentar o conjunto além do definido: ele já está no limite vertical da faixa disponível — crescer colide com o título e quebra a hierarquia;
- Não trocar o gradiente do fundo do favicon por cor chapada sem manter contraste equivalente.

---

*Referência de design: mockup_FINAL_corh_abraco.png · Proporções calibradas em viewport 926×813.*
