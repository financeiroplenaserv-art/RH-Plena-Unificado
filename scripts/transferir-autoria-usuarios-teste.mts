// Transfere a autoria dos registros dos usuários de TESTE para as contas REAIS
// (mesma pessoa), com backup manifest antes. NÃO exclui nada — a exclusão das
// contas de teste é feita por scripts/excluir-usuarios-teste.mts depois da
// verificação. Uso: npx tsx scripts/transferir-autoria-usuarios-teste.mts
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

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

// Mapeamento confirmado pela administradora em 03/08/2026
const MAPEAMENTO: { teste: string; realEmail: string }[] = [
  { teste: 'DP1 Teste', realEmail: 'dp@plenafacilities.com.br' },        // Ludmila
  { teste: 'DP2 Teste', realEmail: 'elizabeth@plenafacilities.com.br' }, // Elizabeth
  { teste: 'Mesa Teste', realEmail: 'maciel@plenaserv.com' },            // Maciel
  { teste: 'Gestor Teste', realEmail: 'comercial@plenafacilities.com.br' }, // Alexandre
  { teste: 'Financeiro Teste', realEmail: 'erica@plenaerv.com' },        // Érica
  { teste: 'Inspetoria Teste', realEmail: 'augusto@plenafacilities.com.br' }, // Augusto
  { teste: 'RH Teste', realEmail: 'rh@plenafacilities.com.br' },         // Rosely
]
// Administrador Teste e Visualizador Teste: sem atividade no banco — só exclusão (etapa 2).

// Tabelas/colunas com referência a usuário (inventário definitivo via information_schema em 03/08).
// consentimentos_lgpd NÃO entra: os consentimentos de teste expiram com as contas;
// cada usuário real consente no primeiro login da conta nova.
const COLUNAS: { tabela: string; coluna: string; pk?: string }[] = [
  { tabela: 'log_auditoria', coluna: 'usuario_id' },
  { tabela: 'entregas', coluna: 'usuario_id' },
  { tabela: 'locais_trabalho_diario', coluna: 'usuario_confirmacao_id' },
  { tabela: 'extras', coluna: 'usuario_id' },
  { tabela: 'historico_importacoes_econtador', coluna: 'usuario_id' },
  { tabela: 'projetos_vr', coluna: 'usuario_id' },
  { tabela: 'recibos_extras', coluna: 'usuario_id' },
  { tabela: 'ferias_notificacoes', coluna: 'usuario_id' },
  { tabela: 'ocorrencias', coluna: 'usuario_id' },
  { tabela: 'ocorrencia_anexos', coluna: 'usuario_id' },
  { tabela: 'ocorrencia_defesas', coluna: 'usuario_id' },
  { tabela: 'ocorrencia_testemunhas', coluna: 'usuario_id' },
  { tabela: 'auditoria', coluna: 'usuario_id' },
  { tabela: 'historico_local_trabalho_diario', coluna: 'usuario_id' },
  { tabela: 'ceu_tamanhos', coluna: 'updated_by', pk: 'colaborador_id' },
  { tabela: 'ponto_espelho_arquivos', coluna: 'enviado_por' },
]

// 1) Resolve IDs
const { data: testes, error: e1 } = await supabase
  .from('perfis').select('id, nome').ilike('nome', '%teste%')
if (e1) throw e1
const { data: reais, error: e2 } = await supabase
  .from('perfis').select('id, email, nome')
  .in('email', MAPEAMENTO.map(m => m.realEmail))
if (e2) throw e2

const pares: { testeId: string; testeNome: string; realId: string; realNome: string }[] = []
for (const m of MAPEAMENTO) {
  const t = (testes ?? []).find(x => x.nome === m.teste)
  const r = (reais ?? []).find(x => x.email === m.realEmail)
  if (!t || !r) throw new Error(`Mapeamento incompleto: ${m.teste} → ${m.realEmail} (teste=${!!t}, real=${!!r})`)
  pares.push({ testeId: t.id, testeNome: t.nome, realId: r.id, realNome: r.nome ?? m.realEmail })
}
console.log('Mapeamento resolvido:')
for (const p of pares) console.log(`  ${p.testeNome} → ${p.realNome}`)

// 2) Backup manifest (id do registro + usuário antigo/novo) com paginação
const backup: { tabela: string; coluna: string; registro_id: unknown; usuario_antigo: string; usuario_novo: string }[] = []
for (const c of COLUNAS) {
  const pk = c.pk ?? 'id'
  for (const p of pares) {
    let desde = 0
    for (;;) {
      const { data, error } = await supabase
        .from(c.tabela).select(`${pk}, ${c.coluna}`)
        .eq(c.coluna, p.testeId)
        .range(desde, desde + 999)
      if (error) throw new Error(`Backup ${c.tabela}: ${error.message}`)
      for (const row of data ?? []) {
        backup.push({ tabela: c.tabela, coluna: c.coluna, registro_id: (row as any)[pk], usuario_antigo: p.testeId, usuario_novo: p.realId })
      }
      if (!data || data.length < 1000) break
      desde += 1000
    }
  }
}
const arquivoBackup = 'dados-locais/backup_transferencia_usuarios_teste_2026-08-03.json'
fs.writeFileSync(arquivoBackup, JSON.stringify(backup, null, 2))
console.log(`\nBackup: ${backup.length} registros em ${arquivoBackup}`)
if (backup.length === 0) {
  console.log('Nada a transferir.')
} else {
  // 3) Transferência
  console.log('\nTransferindo:')
  for (const c of COLUNAS) {
    for (const p of pares) {
      const { data, error } = await supabase
        .from(c.tabela).update({ [c.coluna]: p.realId })
        .eq(c.coluna, p.testeId)
        .select('id')
      if (error) throw new Error(`Transferência ${c.tabela}.${c.coluna} (${p.testeNome}): ${error.message}`)
      if ((data?.length ?? 0) > 0) console.log(`  ${c.tabela}.${c.coluna}: ${data!.length} de ${p.testeNome} → ${p.realNome}`)
    }
  }
}

// 4) Verificação: zero referências restantes (exceto consentimentos_lgpd, proposital)
console.log('\nVerificação final (deve ser 0 em tudo):')
let restantes = 0
for (const c of COLUNAS) {
  const { count, error } = await supabase
    .from(c.tabela).select('*', { count: 'exact', head: true })
    .in(c.coluna, (testes ?? []).map(t => t.id))
  if (error) throw new Error(`Verificação ${c.tabela}: ${error.message}`)
  if ((count ?? 0) > 0) { console.log(`  ✗ ${c.tabela}.${c.coluna}: ${count}`); restantes += count ?? 0 }
}
console.log(restantes === 0
  ? '✓ Nenhuma referência a usuários de teste fora de consentimentos_lgpd.'
  : `✗ ATENÇÃO: ${restantes} referências restantes — NÃO excluir as contas ainda.`)
