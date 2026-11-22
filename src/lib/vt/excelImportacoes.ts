// Listas de conferência das Importações do mês (VT) em Excel: uma aba por tipo
// de lista, cabeçalhos legíveis. Montagem pura (aoa) separada do download.

import * as XLSX from '@e965/xlsx'
import { formatarData } from '@/lib/utils'
import type { PreviaOptantes } from '@/lib/vt/importacaoAlterdata'
import type { PreviaRiocard } from '@/lib/vt/importacaoRiocard'

export type AbaExcel = { nome: string; linhas: (string | number)[][] }

const simNao = (v: boolean | null | undefined) => (v === true ? 'Sim' : v === false ? 'Não' : 'não informado')

export function abasConferenciaOptantes(p: PreviaOptantes): AbaExcel[] {
  return [
    {
      nome: 'Vão virar optantes',
      linhas: [['Nome', 'CPF', 'Matrícula', 'Optante hoje'], ...p.virarOptante.map((m) => [m.colaborador.nome_completo, m.registro.cpf ?? '', m.colaborador.matricula ?? '', simNao(m.colaborador.vt_optante)])],
    },
    {
      nome: 'Vão deixar de ser',
      linhas: [['Nome', 'CPF', 'Matrícula', 'Optante hoje'], ...p.deixarDeSerOptante.map((m) => [m.colaborador.nome_completo, m.registro.cpf ?? '', m.colaborador.matricula ?? '', simNao(m.colaborador.vt_optante)])],
    },
    {
      nome: 'Nos dois relatórios',
      linhas: [['Nome', 'CPF'], ...p.conflitos.map((c) => [c.colaborador.nome_completo, c.descontaRegistro.cpf ?? ''])],
    },
    {
      nome: 'Não encontrados',
      linhas: [
        ['Relatório', 'Nome', 'CPF', 'Matrícula', 'Motivo'],
        ...p.naoEncontradosDesconta.map((s) => ['Desconta VT', s.registro.nome, s.registro.cpf ?? '', s.registro.matricula ?? '', s.motivo]),
        ...p.naoEncontradosNaoBeneficiario.map((s) => ['Não beneficiário', s.registro.nome, s.registro.cpf ?? '', s.registro.matricula ?? '', s.motivo]),
      ],
    },
    {
      nome: 'Fora dos relatórios',
      linhas: [['Nome', 'Matrícula', 'Situação no CORH', 'Optante hoje'], ...p.foraDosRelatorios.map((c) => [c.nome_completo, c.matricula ?? '', c.status, simNao(c.vt_optante)])],
    },
  ]
}

export function abasConferenciaRiocard(p: PreviaRiocard): AbaExcel[] {
  return [
    {
      nome: 'Mudanças de situação',
      linhas: [
        ['Nome', 'CPF', 'Situação antes', 'Situação depois', 'Nº do cartão'],
        ...p.mudancas.map((m) => [m.colaborador.nome_completo, m.linha.cpf ?? '', m.colaborador.vt_bu_situacao ?? 'não consultado', m.depois.vt_bu_situacao, m.depois.vt_riocard_numero_cartao ?? '']),
      ],
    },
    {
      nome: 'Inativar na Riocard',
      linhas: [['Nome', 'CPF', 'Matrícula Riocard', 'Conta', 'Situação do BU'], ...p.semCadastroAtivoNoCorh.map((l) => [l.nome, l.cpf ?? '', l.matricula, l.conta, l.situacao])],
    },
    {
      nome: 'Cadastrar na Riocard',
      linhas: [['Nome', 'CPF'], ...p.optantesSemCadastroNaRiocard.map((c) => [c.nome_completo, c.cpf ?? ''])],
    },
    {
      nome: 'Ativos que não são optantes',
      linhas: [['Nome', 'CPF', 'Situação do BU'], ...p.ativosNaRiocardNaoOptantes.map((a) => [a.colaborador.nome_completo, a.linha.cpf ?? '', a.linha.situacao])],
    },
    {
      nome: 'Só inativo na Riocard',
      linhas: [['Nome', 'CPF', 'Matrícula Riocard'], ...p.soInativoNaRiocard.map((a) => [a.colaborador.nome_completo, a.linha.cpf ?? '', a.linha.matricula])],
    },
    {
      nome: 'Conflitos e sem CPF',
      linhas: [
        ['Tipo', 'Nome', 'CPF', 'Matrícula Riocard', 'Conta'],
        ...p.conflitosAtivoDuplicado.map((l) => ['Ativo duplicado', l.nome, l.cpf ?? '', l.matricula, l.conta]),
        ...p.semCpf.map((l) => ['Sem CPF no arquivo', l.nome, '', l.matricula, l.conta]),
        ...p.situacoesDesconhecidas.map((l) => [`Situação desconhecida: ${l.situacao}`, l.nome, l.cpf ?? '', l.matricula, l.conta]),
      ],
    },
  ]
}

export function baixarExcelConferencia(abas: AbaExcel[], nomeArquivo: string) {
  const wb = XLSX.utils.book_new()
  for (const aba of abas) {
    const ws = XLSX.utils.aoa_to_sheet(aba.linhas)
    ws['!cols'] = aba.linhas[0].map(() => ({ wch: 32 }))
    XLSX.utils.book_append_sheet(wb, ws, aba.nome.slice(0, 31))
  }
  XLSX.writeFile(wb, nomeArquivo)
}

export const dataParaNomeArquivo = (iso: string) => formatarData(iso).replace(/\//g, '-')
