export function normalizarSubgrupo(texto) {
  if (!texto) return ''
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

export function inferirSubgrupo(tipo, nome) {
  const t = String(tipo || '').trim()
  const n = normalizarSubgrupo(nome)

  if (t === 'Crachá') return 'CRACHÁ'

  if (t === 'EPI') {
    if (/OCULOS/.test(n)) return 'OCULAR'
    if (/ABAFADOR|PROTETOR AURICULAR/.test(n)) return 'AURICULAR'
    if (/MASCARA|RESPIRADOR/.test(n)) return 'RESPIRATÓRIA'
    if (/PROTETOR FACIAL|ESCUDO FACIAL/.test(n)) return 'FACIAL'
    if (/LUVA/.test(n)) return 'MÃOS'
    if (/BOTA|BOTINA|SAPATO/.test(n)) return 'PÉS'
    if (/CAPACETE|BONE|CHAPEU/.test(n)) return 'CABEÇA'
    return 'VESTIMENTA'
  }

  if (t === 'Uniforme') {
    if (/CALCA|BERMUDA/.test(n)) return 'VESTUÁRIO INFERIOR'
    if (/CAMISA|BLUSA|BLAZER|CASACO|JAQUETA|JALECO|TERNO|POLO|CAMISETA|MOLETOM|COLETE/.test(n)) {
      return 'VESTUÁRIO SUPERIOR'
    }
    if (/GRAVATA|LENCO|LACINHO|TOUQUINHA|ECHARPE|LACO|BANDANA|BOLSA/.test(n)) return 'ACESSÓRIOS'
    return null
  }

  return null
}
