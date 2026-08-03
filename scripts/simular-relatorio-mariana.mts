// Simula o fechamento do relatório para Mariana/Marcelo com os dados atuais
// do banco, usando as funções reais de cálculo. Uso: npx tsx scripts/simular-relatorio-mariana.mts
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import {
  adicionalTitular30,
  insalubridadeSubstituto,
  contarDiasTransferidos,
} from '../src/lib/adicionais/calculoAdicionais'

function carregarEnv(caminho: string) {
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

const VINCULO_ID = '9e195212-fa46-48f7-8bb4-b57c7fcff9da' // Mariana, Insalub. Quatre
const MARCELO_ID = '3e3abc6a-f92d-4459-8302-17c4285d111f'

const { data: vinc, error: e0 } = await supabase
  .from('vinculos_adicionais')
  .select('*, contratos_adicionais(nome, regime_trabalho, adicionais)')
  .eq('id', VINCULO_ID)
  .single()
if (e0) throw e0
const regime = (vinc as any).contratos_adicionais?.regime_trabalho
console.log(`Contrato: ${(vinc as any).contratos_adicionais?.nome} | regime_trabalho=${regime ?? 'indefinido'} | início do vínculo=${vinc.data_inicio}`)

const { data: cal, error: e1 } = await supabase
  .from('calendario_adicionais')
  .select('data, status, substituto_colaborador_id, substituto_colaborador_nome')
  .eq('vinculo_id', VINCULO_ID)
  .gte('data', '2026-06-20')
  .lte('data', '2026-07-19')
  .order('data')
if (e1) throw e1

const feriasAfast = (cal ?? []).filter((d: any) => d.status === 'ferias' || d.status === 'afastado')
const faltas = (cal ?? []).filter((d: any) => d.status === 'falta').length
console.log(`Bloco férias/afastado: ${feriasAfast.length} dias | faltas: ${faltas}`)

// Titular (Mariana): qualquer substituto no dia conta como coberto
const transferidosTitular = contarDiasTransferidos(regime, vinc.data_inicio, feriasAfast.map((d: any) => ({
  data: d.data,
  comSubstituto: !!d.substituto_colaborador_id,
})))
const diasMariana = adicionalTitular30(faltas, transferidosTitular)

// Substituto puro (Marcelo): só os dias em que ELE é o substituto
const transferidosMarcelo = contarDiasTransferidos(regime, vinc.data_inicio, feriasAfast.map((d: any) => ({
  data: d.data,
  comSubstituto: d.substituto_colaborador_id === MARCELO_ID,
})))
const diasMarcelo = insalubridadeSubstituto(transferidosMarcelo, 0)

console.log(`\nTransferidos (titular): ${transferidosTitular} → Mariana (insalubridade) = ${diasMariana}`)
console.log(`Transferidos (Marcelo): ${transferidosMarcelo} → Marcelo (insalubridade) = ${diasMarcelo}`)
console.log(diasMariana === 12 && diasMarcelo === 18 ? '\n✓ FECHA: Mariana 12 / Marcelo 18' : '\n✗ NÃO FECHA — esperado 12/18')
