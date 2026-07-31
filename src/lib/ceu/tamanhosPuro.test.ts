import { describe, it, expect } from 'vitest'
import { resumoTamanhos, tamanhoParaItem, tamanhoDoNomeItem } from './tamanhosPuro'
import type { CeuTamanhos } from '@/types/database'

const TAMANHOS: CeuTamanhos = {
  colaborador_id: 'x',
  tamanho_camisa: 'G',
  tamanho_calca: '42',
  tamanho_calcado: '40',
  tamanho_luva: 'M',
}

describe('resumoTamanhos', () => {
  it('monta o resumo com todas as medidas', () => {
    expect(resumoTamanhos(TAMANHOS)).toBe('Camisa G · Calça 42 · Calçado 40 · Luva M')
  })
  it('omite medidas vazias e devolve vazio sem cadastro', () => {
    expect(resumoTamanhos({ ...TAMANHOS, tamanho_luva: null, tamanho_camisa: null })).toBe('Calça 42 · Calçado 40')
    expect(resumoTamanhos(null)).toBe('')
    expect(resumoTamanhos(undefined)).toBe('')
  })
})

describe('tamanhoParaItem', () => {
  it('mapeia o tipo do item para a medida certa', () => {
    expect(tamanhoParaItem('LUVA LÁTEX AMARELA', TAMANHOS)).toBe('M')
    expect(tamanhoParaItem('CAMISA POLO AZUL', TAMANHOS)).toBe('G')
    expect(tamanhoParaItem('JALECO OXFORD', TAMANHOS)).toBe('G')
    expect(tamanhoParaItem('CALÇA JEANS', TAMANHOS)).toBe('42')
    expect(tamanhoParaItem('BOTINA COM ELÁSTICO', TAMANHOS)).toBe('40')
    expect(tamanhoParaItem('BOTA PVC CANO CURTO', TAMANHOS)).toBe('40')
  })
  it('devolve null para item sem categoria ou sem cadastro', () => {
    expect(tamanhoParaItem('CRACHÁ COMPLETO', TAMANHOS)).toBeNull()
    expect(tamanhoParaItem('LUVA LÁTEX', null)).toBeNull()
  })
})

describe('tamanhoDoNomeItem', () => {
  it('extrai do sufixo "Tam. X"', () => {
    expect(tamanhoDoNomeItem('BOTINA COM ELÁSTICO 40 - Tam. 40')).toBe('40')
    expect(tamanhoDoNomeItem('LUVA LÁTEX EG - Tam. EG')).toBe('EG')
    expect(tamanhoDoNomeItem('CALÇA EM BRIM AZUL - Tam. G')).toBe('G')
  })
  it('extrai do sufixo solto no nome (importação antiga)', () => {
    expect(tamanhoDoNomeItem('LUVA LATEX M')).toBe('M')
    expect(tamanhoDoNomeItem('BOTA PVC CANO CURTO 42')).toBe('42')
  })
  it('não confunde sufixos que não são tamanho', () => {
    expect(tamanhoDoNomeItem('CAMISA MALHA POLO - AZUL - ASG')).toBeNull()
    expect(tamanhoDoNomeItem('LUVA DE CORTE')).toBeNull()
    expect(tamanhoDoNomeItem('CALÇA SOCIAL')).toBeNull()
  })
})
