/**
 * Script de verificação: gera recibos CEU de exemplo (EPI e Uniforme) com
 * quantidades variadas de itens e mede quantas páginas cada um ocupa ao
 * imprimir em PDF (headless Chrome). Uso:
 *   npx tsx scripts/testar-paginas-recibo.ts
 * Gera HTML em dados-locais/tmp_recibos_teste/*.html
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { gerarReciboEPIColorido, gerarReciboUniformeColorido, type ReciboData } from '../src/lib/ceuRecibos'

function dados(qtdItens: number): ReciboData {
  return {
    colaborador: {
      nome: 'Fulano de Tal da Silva Sauro',
      matricula: '12345',
      funcao: 'Vigilante Patrimonial',
      departamento: 'Posto Central - Turno A',
      cpf: '12345678901',
      data_admissao: '2024-01-15',
    },
    entregas: Array.from({ length: qtdItens }, (_, i) => ({
      item: {
        descricao: `Item de EPI número ${i + 1} com descrição razoavelmente longa`,
        numero_ca: `${10000 + i}`,
        grupo_macro: 'EPI',
        subgrupo: 'Proteção',
      },
      quantidade: 1,
      situacao: 'Troca',
    })),
    dataEntrega: '2026-08-01',
    numeroRecibo: 'REC-2026-0001',
    nomeEmpresa: 'Plena EA Serviços Terceirizados LTDA',
    cnpjEmpresa: '12.345.678/0001-90',
  }
}

function envolver(recibosHTML: string[]): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibos em lote</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    .recibo-page { page-break-after: always; }
    .recibo-page:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  ${recibosHTML.map((h) => `<div class="recibo-page">${h}</div>`).join('')}
</body>
</html>`
}

const dir = 'dados-locais/tmp_recibos_teste'
mkdirSync(dir, { recursive: true })

const quantidades = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 34]
for (const qtd of quantidades) {
  const epi = gerarReciboEPIColorido(dados(qtd))
  const uni = gerarReciboUniformeColorido(dados(qtd))
  writeFileSync(`${dir}/epi_${qtd}.html`, envolver([epi]))
  writeFileSync(`${dir}/uniforme_${qtd}.html`, envolver([uni]))
}

console.log(`Arquivos gerados em ${dir} para ${quantidades.join(', ')} itens (EPI e Uniforme)`)
