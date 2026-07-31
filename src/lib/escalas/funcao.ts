/**
 * Abreviações das funções (cargos) para exibição compacta na grade de Escalas.
 * Chaves normalizadas: minúsculas, sem acentos, sem parênteses, espaços simples.
 * Função não mapeada é exibida como está no cadastro.
 */
const ABREVIACOES_FUNCAO: Record<string, string> = {
  'auxiliar de serv gerais': 'ASG',
  'auxiliar de servicos gerais': 'ASG',
  'porteiro': 'Port.',
  'porteira': 'Port.',
  'encarregado junior': 'Enc. Jr',
  'encarregado pleno': 'Enc. Pl',
  'encarregado senior': 'Enc. Sr',
  'encarregado': 'Enc.',
  'operador de monitoramento': 'Op. Monit.',
  'vigia': 'Vigia',
  'zelador': 'Zel.',
  'lider': 'Líder',
  'inspetor de servicos pleno': 'Insp. Pl',
  'inspetor de servicos': 'Insp.',
  'auxiliar de manutencao': 'Aux. Man.',
  'auxiliar de jardinagem': 'Aux. Jard.',
  'auxiliar de portaria': 'Aux. Port.',
  'chefe de departamento': 'Chefe Dep.',
  'estagiario': 'Estag.',
  'auxiliar tecnico em eletronica': 'Aux. Téc.',
  'gerente de rh': 'Ger. RH',
  'copeiro': 'Cop.',
  'assistente administrativo': 'Ass. Adm.',
  'atendimento ao cliente': 'Atend.',
  'recepcionista': 'Recep.',
  'assistente comercial': 'Ass. Com.',
  'supervisor administrativo': 'Sup. Adm.',
  'auxiliar de ti': 'Aux. TI',
}

function normalizarFuncao(cargo: string): string {
  return cargo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove marcas diacríticas (acentos)
    .replace(/\(.*?\)/g, '') // remove parênteses: "PORTEIRO (a)" → "porteiro"
    .replace(/\./g, '') // "t.i" → "ti"
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Abrevia a função do colaborador para a grade de Escalas
 * (ex.: "Auxiliar de Serv Gerais (Limpeza)" → "ASG", "Encarregado Junior" → "Enc. Jr").
 * Sem mapeamento, devolve o cargo original. Vazio devolve '—'.
 */
export function abreviarFuncao(cargo?: string | null): string {
  if (!cargo || !cargo.trim()) return '—'
  return ABREVIACOES_FUNCAO[normalizarFuncao(cargo)] ?? cargo
}
