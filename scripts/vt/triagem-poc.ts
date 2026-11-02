/**
 * Triagem da POC da Routes API (02/11/2026): transforma as divergências do
 * relatório em GRUPOS de decisão — a gestora decide por grupo, não por pessoa.
 *
 * Cruzamentos:
 * - CEP da casa × cidade cadastrada (cidadeDoCep): CEP divergente = erro real
 *   de cadastro (o trajeto foi roteirizado da cidade errada).
 * - Direção do valor: sugerido mais caro = pagando a MENOS (a pessoa reclama);
 *   sugerido mais barato = pagando a MAIS (a empresa perde).
 * - "Sem integração BU" = ação na Setrans, não é correção de trajeto.
 *
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/vt/triagem-poc.ts
 * Saída: dados-locais/poc_rotas_api_2026-11-02_triagem.md
 */

import fs from 'fs'
import { cidadeDoCep } from '../../src/lib/vt/enderecos'
import { removerAcentos } from '../../src/lib/utils'

const ARQUIVO = 'dados-locais/poc_rotas_api_2026-11-02.csv'

const VALOR: Record<string, number> = {
  'CENTRO RJ': 1000,
  'BU NITERÓI': 1120,
  'CARTÃO JAE RJ': 1400,
  'PASSAGEM SÃO GONÇALO': 1420,
  TREM: 1580,
  'ÔNIBUS E VLT - INTEGRAÇÃO RJ': 1600,
  'BILHETE ÚNICO INTERMUNICIPAL': 1880,
  'ÔNIBUS, TREM E METRÔ': 2880,
  'SEM INTEGRAÇÃO BU': 3200,
}

interface Linha {
  resultado: string
  nome: string
  origem: string
  destino: string
  atual: string
  sugerido: string
  confianca: string
  avisos: string
}

const linhas: Linha[] = fs
  .readFileSync(ARQUIVO, 'utf-8')
  .split('\n')
  .slice(1)
  .filter((l) => l.trim())
  .map((l) => {
    const [resultado, nome, origem, destino, atual, sugerido, confianca, , avisos] = l.split(';')
    return { resultado, nome, origem, destino, atual, sugerido, confianca, avisos: avisos ?? '' }
  })

function cidadeDaOrigem(origem: string): string {
  // "rua, num, bairro, CIDADE - UF, CEP"
  const partes = origem.split(',').map((p) => p.trim())
  const comUf = partes.find((p) => / - [A-Z]{2}$/.test(p))
  return comUf ? comUf.replace(/ - [A-Z]{2}$/, '') : ''
}

function cepDaOrigem(origem: string): string {
  return /\d{5}-\d{3}/.exec(origem)?.[0] ?? ''
}

type Grupo = 'A_erro_provavel' | 'B_revisar_ambiguo' | 'C_setrans' | 'D_pagando_a_mais' | 'OK'

function grupoDa(l: Linha): Grupo {
  if (l.resultado === 'OK') return 'OK'
  if (!l.sugerido) return 'A_erro_provavel' // sem rota = problema de endereço
  if (l.sugerido === 'SEM INTEGRAÇÃO BU') return 'C_setrans'
  const cidade = cidadeDaOrigem(l.origem)
  const cep = cepDaOrigem(l.origem)
  const doCep = cidadeDoCep(cep)
  const cepDiverge = !!doCep && !!cidade && removerAcentos(cidade).toUpperCase() !== doCep
  if (cepDiverge) return 'A_erro_provavel'
  const vAtual = VALOR[l.atual] ?? 0
  const vSugerido = VALOR[l.sugerido] ?? 0
  if (vSugerido < vAtual) return 'D_pagando_a_mais'
  return 'B_revisar_ambiguo'
}

const grupos = new Map<Grupo, Linha[]>()
for (const l of linhas) {
  const g = grupoDa(l)
  grupos.set(g, [...(grupos.get(g) ?? []), l])
}

const NOMES: Record<Grupo, string> = {
  A_erro_provavel: 'A — ERRO PROVÁVEL (endereço/cidade errada ou rota incompatível)',
  B_revisar_ambiguo: 'B — REVISAR (rota pode usar linha intermunicipal — confirmar com a pessoa)',
  C_setrans: 'C — SETRANS (BU suspenso/sem BU — reativar, não é correção de trajeto)',
  D_pagando_a_mais: 'D — PAGANDO A MAIS (sugerido mais barato que o atual)',
  OK: 'OK — confirmados pela rota',
}

let md = `# Triagem da POC de rotas (02/11/2026)\n\nTotal: ${linhas.length} trajetos.\n\n`
for (const g of ['A_erro_provavel', 'B_revisar_ambiguo', 'C_setrans', 'D_pagando_a_mais', 'OK'] as Grupo[]) {
  const lista = grupos.get(g) ?? []
  md += `\n## ${NOMES[g]} (${lista.length})\n\n`
  for (const l of lista) {
    md += `- ${l.nome} — ${cidadeDaOrigem(l.origem)} → ${l.destino.split(',')[0]} — atual: ${l.atual}, sugerido: ${l.sugerido || 'sem rota'} (${l.confianca})\n`
  }
}

const out = ARQUIVO.replace('.csv', '_triagem.md')
fs.writeFileSync(out, md)
console.log(`OK: ${grupos.get('OK')?.length ?? 0}`)
console.log(`A erro provável: ${grupos.get('A_erro_provavel')?.length ?? 0}`)
console.log(`B revisar (ambíguo): ${grupos.get('B_revisar_ambiguo')?.length ?? 0}`)
console.log(`C Setrans: ${grupos.get('C_setrans')?.length ?? 0}`)
console.log(`D pagando a mais: ${grupos.get('D_pagando_a_mais')?.length ?? 0}`)
console.log(`Relatório: ${out}`)
