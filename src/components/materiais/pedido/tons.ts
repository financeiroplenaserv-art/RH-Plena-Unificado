import { IdCard, PackageCheck, Shirt, ShoppingBasket, type LucideIcon } from 'lucide-react'

// Cores da tela pública do líder (/pedido/:token), decisão da gestão de
// 16/10/2026: o que vem no mês em VERDE, o que a pessoa pede a mais em AZUL,
// uniforme/EPI em LARANJA e crachá em ROXO. Tokens --pedido-* em
// src/index.css (com tema escuro). Só cores sólidas — o único degradê do
// sistema aqui é o do botão primário.

export type Tom = 'kit' | 'extra' | 'epi' | 'cracha'

/** Classes por cor (o Tailwind precisa das classes escritas por extenso). */
export const TONS: Record<Tom, { fundo: string; borda: string; texto: string; cheio: string; contorno: string; icone: LucideIcon }> = {
  kit: {
    fundo: 'bg-pedido-kit-bg',
    borda: 'border-pedido-kit',
    texto: 'text-pedido-kit-texto',
    cheio: 'border-pedido-kit bg-pedido-kit text-pedido-contraste',
    contorno: 'border-pedido-kit text-pedido-kit-texto',
    icone: PackageCheck,
  },
  extra: {
    fundo: 'bg-pedido-extra-bg',
    borda: 'border-pedido-extra',
    texto: 'text-pedido-extra-texto',
    cheio: 'border-pedido-extra bg-pedido-extra text-pedido-contraste',
    contorno: 'border-pedido-extra text-pedido-extra-texto',
    icone: ShoppingBasket,
  },
  epi: {
    fundo: 'bg-pedido-epi-bg',
    borda: 'border-pedido-epi',
    texto: 'text-pedido-epi-texto',
    cheio: 'border-pedido-epi bg-pedido-epi text-pedido-contraste',
    contorno: 'border-pedido-epi text-pedido-epi-texto',
    icone: Shirt,
  },
  cracha: {
    fundo: 'bg-pedido-cracha-bg',
    borda: 'border-pedido-cracha',
    texto: 'text-pedido-cracha-texto',
    cheio: 'border-pedido-cracha bg-pedido-cracha text-pedido-contraste',
    contorno: 'border-pedido-cracha text-pedido-cracha-texto',
    icone: IdCard,
  },
}
