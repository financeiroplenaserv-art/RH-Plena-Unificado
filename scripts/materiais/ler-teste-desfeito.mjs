// Lê o resultado de um teste "desfeito" (erro TESTE_DESFEITO {json}) do Management API e imprime um resumo.
//   node scripts/materiais/ler-teste-desfeito.mjs <arquivo-com-a-saida>
import fs from 'fs'

const t = fs.readFileSync(process.argv[2], 'utf8')
const i = t.indexOf('TESTE_DESFEITO ')
if (i < 0) {
  console.log(t.slice(0, 2000))
  process.exit(1)
}
let s = t.slice(i + 'TESTE_DESFEITO '.length)
s = s.slice(0, s.lastIndexOf('\\nCONTEXT'))
const j = JSON.parse(JSON.parse('"' + s + '"'))
fs.writeFileSync(process.argv[2] + '.json', JSON.stringify(j, null, 1))
if (j.fluxo) console.log('FLUXO', JSON.stringify(j.fluxo))
if (j.conf) {
  const soma = (f) => j.conf.reduce((a, c) => a + Number(c[f]), 0)
  console.log('pedidos', j.conf.length, 'cheias', soma('kit_cheias'), 'zeradas', soma('kit_zeradas_nao_precisa'), 'valor', soma('valor_kit_adicionado').toFixed(2))
  console.log('envios', j.envios_novos, 'linhas novas', j.linhas_novas, 'sem preço', j.sem_preco_novas, 'total linhas', j.total_linhas_pedido)
  console.log(j.conf.map((c) => `${c.contrato}: ${c.status_antes}->${c.status_depois} cheias ${c.kit_cheias} zer ${c.kit_zeradas_nao_precisa} ja ${c.ja_tinham_kit} R$${c.valor_kit_adicionado}`).join('\n'))
}
for (const k of ['pedidos_nao_tocados', 'kit_sem_pedido', 'convertidas', 'extra_com_decisao']) if (k in j) console.log(k, JSON.stringify(j[k]))
for (const k of Object.keys(j)) if (!['conf', 'fluxo', 'pedidos_nao_tocados', 'kit_sem_pedido', 'convertidas', 'extra_com_decisao', 'envios_novos', 'linhas_novas', 'sem_preco_novas', 'total_linhas_pedido'].includes(k)) console.log(k, JSON.stringify(j[k]))
