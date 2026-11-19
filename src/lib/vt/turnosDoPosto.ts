import { supabase } from '@/lib/supabase'
import { normalizarDepartamento, type DepartamentoFuzzy } from '@/lib/departamentos'
import { resolverPostoDoRelatorio } from '@/lib/vt/carga'
import type { RegistroTurno } from '@/lib/vt/horarioTurno'

const DIAS_BUSCA = 60

function diasAtras(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  const dt = new Date(a, m - 1, d - dias)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

interface LinhaTurno {
  data: string
  turno: string | null
  local_trabalho: { nome: string; nome_curto: string | null } | { nome: string; nome_curto: string | null }[] | null
}

function mesmoPosto(departamentos: DepartamentoFuzzy[], alvoId: string, texto: string): boolean {
  const dep = resolverPostoDoRelatorio(departamentos, texto)
  if (!dep) return false
  if (dep.id === alvoId) return true
  // linhas duplicadas do mesmo posto (mesmo nome_curto/nome normalizado)
  const alvo = departamentos.find((d) => d.id === alvoId)
  if (!alvo) return false
  const chave = (d: DepartamentoFuzzy) => normalizarDepartamento(d.nome_curto?.trim() || d.nome)
  return chave(dep) === chave(alvo)
}

/**
 * Turnos dos últimos 60 dias de UMA pessoa NO POSTO do trajeto — uma consulta só
 * (sem N+1). O posto do dia vem do local da escala, resolvido para departamento
 * pela mesma regra do VT (fuzzy, nunca ILIKE no banco).
 */
export async function buscarTurnosDoPosto(
  colaboradorId: string,
  departamentoId: string,
  departamentos: DepartamentoFuzzy[],
  hoje: string,
): Promise<RegistroTurno[]> {
  const { data, error } = await supabase
    .from('locais_trabalho_diario')
    .select('data, turno, local_trabalho:locais_trabalho(nome, nome_curto)')
    .eq('colaborador_id', colaboradorId)
    .gte('data', diasAtras(hoje, DIAS_BUSCA))
    .lte('data', hoje)
    .not('turno', 'is', null)
    .order('data', { ascending: false })
    .limit(200)
  if (error) throw error
  const cache = new Map<string, boolean>()
  const registros: RegistroTurno[] = []
  for (const linha of (data ?? []) as unknown as LinhaTurno[]) {
    const local = Array.isArray(linha.local_trabalho) ? linha.local_trabalho[0] : linha.local_trabalho
    const texto = local?.nome_curto?.trim() || local?.nome?.trim() || ''
    if (!texto) continue
    let ok = cache.get(texto)
    if (ok === undefined) {
      ok = mesmoPosto(departamentos, departamentoId, texto)
      cache.set(texto, ok)
    }
    if (ok) registros.push({ data: linha.data, turno: linha.turno })
  }
  return registros
}
