import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAdicionaisContratuais } from '@/hooks/useAdicionaisContratuais'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { AdicionaisPageWrapper, AdicionaisCard, AdicionaisButton } from './AdicionaisPageWrapper'
import { PageHeader } from '@/components/PageHeader'
import * as XLSX from '@e965/xlsx'
import { nomeDepartamento } from '@/lib/utils'
import { diaIntrajornada } from '@/lib/adicionais/calculoAdicionais'
import type { ContratoAdicional, StatusDiaAdicional } from '@/types/adicionais'
import type { Departamento } from '@/types/database'

interface RelatorioAdicionalAgregado {
  colaborador_id: string
  colaborador_nome: string
  contrato_id: string
  contrato_nome: string
  departamento: string
  dias_trabalhados: number
  dias_noturno: number
  dias_periculosidade: number
  dias_insalubridade: number
  dias_intrajornada: number
  folgas: number
  faltas: number
  ferias: number
  afastados: number
}

function exportarCSV(linhas: RelatorioAdicionalAgregado[]) {
  const headers = ['Colaborador', 'Contrato', 'Departamento', 'Trabalhados', 'Noturno', 'Periculosidade', 'Insalubridade', 'Intrajornada', 'Folgas', 'Faltas', 'Férias', 'Afastados']
  const rows = linhas.map(l => [l.colaborador_nome, l.contrato_nome, l.departamento, String(l.dias_trabalhados), String(l.dias_noturno), String(l.dias_periculosidade), String(l.dias_insalubridade), String(l.dias_intrajornada), String(l.folgas), String(l.faltas), String(l.ferias), String(l.afastados)])
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  downloadBlob(csv, 'relatorio_adicionais.csv', 'text/csv;charset=utf-8;')
}

function exportarExcel(linhas: RelatorioAdicionalAgregado[]) {
  const ws = XLSX.utils.json_to_sheet(linhas.map(l => ({
    Colaborador: l.colaborador_nome,
    Contrato: l.contrato_nome,
    Departamento: l.departamento,
    Trabalhados: l.dias_trabalhados,
    Noturno: l.dias_noturno,
    Periculosidade: l.dias_periculosidade,
    Insalubridade: l.dias_insalubridade,
    Intrajornada: l.dias_intrajornada,
    Folgas: l.folgas,
    Faltas: l.faltas,
    'Férias': l.ferias,
    Afastados: l.afastados,
  })))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Adicionais')
  XLSX.writeFile(wb, 'relatorio_adicionais.xlsx')
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function normalizarStatus(status: unknown): StatusDiaAdicional {
  if (
    status === 'trabalhou' ||
    status === 'falta' ||
    status === 'ferias' ||
    status === 'afastado' ||
    status === 'folga' ||
    status === 'folga_substituicao'
  ) {
    return status
  }
  return 'trabalhou'
}

function calcularStatus12x36(dataInicio: string | undefined, dataAtual: string): 'trabalhou' | 'folga' {
  if (!dataInicio) return 'trabalhou'
  const inicio = new Date(dataInicio + 'T00:00:00')
  const atual = new Date(dataAtual + 'T00:00:00')
  const diffMs = atual.getTime() - inicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDias % 2 === 0 ? 'trabalhou' : 'folga'
}

function calcularStatus6x1(dataInicio: string | undefined, dataAtual: string): 'trabalhou' | 'folga' {
  if (!dataInicio) return 'trabalhou'
  const inicio = new Date(dataInicio + 'T00:00:00')
  const atual = new Date(dataAtual + 'T00:00:00')
  const diffMs = atual.getTime() - inicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDias % 7 < 6 ? 'trabalhou' : 'folga'
}

function calcularStatus5x2(dataAtual: string): 'trabalhou' | 'folga' {
  const dia = new Date(dataAtual + 'T00:00:00').getDay()
  return dia >= 1 && dia <= 5 ? 'trabalhou' : 'folga'
}

function calcularStatusPorRegime(regime: string | undefined, dataInicio: string | undefined, dataAtual: string): 'trabalhou' | 'folga' {
  switch (regime) {
    case '6x1':
      return calcularStatus6x1(dataInicio, dataAtual)
    case '5x2':
      return calcularStatus5x2(dataAtual)
    case 'personalizado':
      return 'trabalhou'
    case '12x36':
    default:
      return calcularStatus12x36(dataInicio, dataAtual)
  }
}

function gerarDiasDoPeriodo(inicio: string, fim: string): string[] {
  const dias: string[] = []
  const atual = new Date(inicio + 'T00:00:00')
  const dataFim = new Date(fim + 'T00:00:00')
  while (atual <= dataFim) {
    dias.push(`${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}-${String(atual.getDate()).padStart(2, '0')}`)
    atual.setDate(atual.getDate() + 1)
  }
  return dias
}

interface DiaCalendarioBasico {
  vinculo_id: string
  data: string
  status: StatusDiaAdicional
  substituto_colaborador_id?: string | null
  substituto_colaborador_nome?: string | null
}

function getDiaEfetivo(vinculo: { id: string; data_inicio: string }, regime: string | undefined, data: string, calendarioUnico: DiaCalendarioBasico[]): DiaCalendarioBasico {
  const salvo = calendarioUnico.find(d => d.vinculo_id === vinculo.id && d.data === data)
  if (salvo) {
    return {
      vinculo_id: vinculo.id,
      data,
      status: normalizarStatus(salvo.status),
      substituto_colaborador_id: salvo.substituto_colaborador_id,
      substituto_colaborador_nome: salvo.substituto_colaborador_nome,
    }
  }
  return {
    vinculo_id: vinculo.id,
    data,
    status: calcularStatusPorRegime(regime, vinculo.data_inicio, data),
    substituto_colaborador_id: null,
    substituto_colaborador_nome: null,
  }
}

export function AdicionaisRelatorioPage() {
  const {
    contratos,
    vinculos,
    calendario,
    loading: loadingAdicionais,
    listarContratos,
    listarVinculos,
    listarCalendario,
  } = useAdicionaisContratuais()
  const { colaboradores, loading: loadingColaboradores, listar: listarColaboradores } = useColaboradores()
  const { departamentos, loading: loadingDepartamentos, listar: listarDepartamentos } = useDepartamentos()

  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)

  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>('todos')
  const [adicionalFiltro, setAdicionalFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  const inicioMes = useMemo(() => {
    const anoAnterior = mes === 1 ? ano - 1 : ano
    const mesAnterior = mes === 1 ? 12 : mes - 1
    return `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-20`
  }, [ano, mes])

  const fimMes = useMemo(() => {
    return `${ano}-${String(mes).padStart(2, '0')}-19`
  }, [ano, mes])

  useEffect(() => {
    listarContratos()
    listarVinculos()
    listarColaboradores()
    listarDepartamentos()
  }, [listarContratos, listarVinculos, listarColaboradores, listarDepartamentos])

  useEffect(() => {
    listarCalendario({ dataInicio: inicioMes, dataFim: fimMes })
  }, [inicioMes, fimMes, listarCalendario])

  const mapContrato = useMemo(() => {
    const m = new Map<string, ContratoAdicional>()
    contratos.forEach(c => m.set(c.id, c))
    return m
  }, [contratos])

  const mapColaborador = useMemo(() => {
    const m = new Map<string, { nome: string; matricula: string }>()
    colaboradores.forEach(c => m.set(c.id, { nome: c.nome_completo, matricula: c.matricula }))
    return m
  }, [colaboradores])

  const mapDepartamento = useMemo(() => {
    const m = new Map<string, Departamento>()
    departamentos.forEach(d => m.set(d.id, d))
    return m
  }, [departamentos])

  const vinculosAtivosNoMes = useMemo(() => {
    return vinculos.filter(v => {
      if (v.data_inicio > fimMes || v.data_fim < inicioMes) return false
      return true
    })
  }, [vinculos, inicioMes, fimMes])

  // Deduplica calendário por vinculo_id + data (mantém o mais recente)
  const calendarioUnico = useMemo(() => {
    const map = new Map<string, typeof calendario[0]>()
    calendario.forEach(dia => {
      const chave = `${dia.vinculo_id}|${dia.data}`
      const existente = map.get(chave)
      if (!existente || (dia.updated_at || dia.created_at || '') > (existente.updated_at || existente.created_at || '')) {
        map.set(chave, dia)
      }
    })
    return Array.from(map.values())
  }, [calendario])

  const linhasAgregadas = useMemo<RelatorioAdicionalAgregado[]>(() => {
    const contagem = new Map<string, RelatorioAdicionalAgregado>()

    // Inicializa todos os vínculos ativos no período
    vinculosAtivosNoMes.forEach(v => {
      const contrato = mapContrato.get(v.contrato_id)
      const col = mapColaborador.get(v.colaborador_id)
      const dept = nomeDepartamento(mapDepartamento.get(contrato?.departamento_id || ''))
      const chave = `${v.colaborador_id}|${v.contrato_id}`

      if (!contagem.has(chave)) {
        contagem.set(chave, {
          colaborador_id: v.colaborador_id,
          colaborador_nome: col?.nome || v.colaborador_nome || '—',
          contrato_id: v.contrato_id,
          contrato_nome: contrato?.nome || v.contrato_nome || '—',
          departamento: dept,
          dias_trabalhados: 0,
          dias_noturno: 0,
          dias_periculosidade: 0,
          dias_insalubridade: 0,
          dias_intrajornada: 0,
          folgas: 0,
          faltas: 0,
          ferias: 0,
          afastados: 0,
        })
      }
    })

    // Gera todos os dias do período para cada vínculo ativo, aplicando fallback 12x36
    const diasDoPeriodo = gerarDiasDoPeriodo(inicioMes, fimMes)

    // Mapa auxiliar para corrigir dias 'afastado' isolados dentro de um bloco de férias
    const chaveDia = (vinculoId: string, data: string) => `${vinculoId}|${data}`
    const feriasPorVinculo = new Set<string>()
    vinculosAtivosNoMes.forEach(v => {
      const contrato = mapContrato.get(v.contrato_id)
      const regime = contrato?.regime_trabalho
      diasDoPeriodo.forEach(data => {
        if (getDiaEfetivo(v, regime, data, calendarioUnico).status === 'ferias') {
          feriasPorVinculo.add(chaveDia(v.id, data))
        }
      })
    })

    const statusEfetivo = (vinculo: typeof vinculosAtivosNoMes[0], regime: string | undefined, data: string): StatusDiaAdicional => {
      const dia = getDiaEfetivo(vinculo, regime, data, calendarioUnico)
      if (dia.status !== 'afastado') return dia.status
      const anterior = new Date(data)
      anterior.setDate(anterior.getDate() - 1)
      const posterior = new Date(data)
      posterior.setDate(posterior.getDate() + 1)
      const antStr = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}-${String(anterior.getDate()).padStart(2, '0')}`
      const postStr = `${posterior.getFullYear()}-${String(posterior.getMonth() + 1).padStart(2, '0')}-${String(posterior.getDate()).padStart(2, '0')}`
      if (feriasPorVinculo.has(chaveDia(vinculo.id, antStr)) || feriasPorVinculo.has(chaveDia(vinculo.id, postStr))) {
        return 'ferias'
      }
      return 'afastado'
    }

    vinculosAtivosNoMes.forEach(vinculo => {
      const contrato = mapContrato.get(vinculo.contrato_id)
      const chave = `${vinculo.colaborador_id}|${vinculo.contrato_id}`
      const col = mapColaborador.get(vinculo.colaborador_id)
      const dept = nomeDepartamento(mapDepartamento.get(contrato?.departamento_id || ''))

      let registro = contagem.get(chave)
      if (!registro) {
        registro = {
          colaborador_id: vinculo.colaborador_id,
          colaborador_nome: col?.nome || vinculo.colaborador_nome || '—',
          contrato_id: vinculo.contrato_id,
          contrato_nome: contrato?.nome || vinculo.contrato_nome || '—',
          departamento: dept,
          dias_trabalhados: 0,
          dias_noturno: 0,
          dias_periculosidade: 0,
          dias_insalubridade: 0,
          dias_intrajornada: 0,
          folgas: 0,
          faltas: 0,
          ferias: 0,
          afastados: 0,
        }
        contagem.set(chave, registro)
      }

      const regime = contrato?.regime_trabalho
      diasDoPeriodo.forEach(data => {
        const dia = getDiaEfetivo(vinculo, regime, data, calendarioUnico)
        const status = statusEfetivo(vinculo, regime, data)

        if (status === 'trabalhou') {
          registro!.dias_trabalhados += 1
          if (contrato?.adicionais?.noturno) registro!.dias_noturno += 1
          if (contrato?.adicionais?.periculosidade) registro!.dias_periculosidade += 1
          if (contrato?.adicionais?.insalubridade) registro!.dias_insalubridade += 1
          if (diaIntrajornada(contrato, data)) registro!.dias_intrajornada += 1
        } else if (status === 'folga' || status === 'folga_substituicao') {
          registro!.folgas += 1
        } else if (status === 'falta') {
          registro!.faltas += 1
        } else if (status === 'ferias') {
          registro!.ferias += 1
        } else if (status === 'afastado') {
          registro!.afastados += 1
        }

        // Se há substituto em dia de ausência, conta como trabalhado para o substituto
        const temSubstituto = dia.substituto_colaborador_id &&
          (status === 'falta' || status === 'ferias' || status === 'afastado' || status === 'folga_substituicao')

        if (temSubstituto) {
          const substitutoId = dia.substituto_colaborador_id!
          const chaveSubst = `${substitutoId}|${vinculo.contrato_id}`
          let registroSubst = contagem.get(chaveSubst)

          if (!registroSubst) {
            const colSubst = mapColaborador.get(substitutoId)
            registroSubst = {
              colaborador_id: substitutoId,
              colaborador_nome: colSubst?.nome || dia.substituto_colaborador_nome || '—',
              contrato_id: vinculo.contrato_id,
              contrato_nome: contrato?.nome || vinculo.contrato_nome || '—',
              departamento: dept,
              dias_trabalhados: 0,
              dias_noturno: 0,
              dias_periculosidade: 0,
              dias_insalubridade: 0,
              dias_intrajornada: 0,
              folgas: 0,
              faltas: 0,
              ferias: 0,
              afastados: 0,
            }
            contagem.set(chaveSubst, registroSubst)
          }

          registroSubst.dias_trabalhados += 1
          if (contrato?.adicionais?.noturno) registroSubst.dias_noturno += 1
          if (contrato?.adicionais?.periculosidade) registroSubst.dias_periculosidade += 1
          if (contrato?.adicionais?.insalubridade) registroSubst.dias_insalubridade += 1
          if (diaIntrajornada(contrato, data)) registroSubst.dias_intrajornada += 1
        }
      })
    })

    const resultado = Array.from(contagem.values())

    // REVERTIDO: mantida a regra original do sistema conforme solicitado.
    // Regra de negócio: insalubridade/periculosidade = 30 dias se não houver faltas; senão, desconta as faltas.
    // Para escala 12×36 o adicional é cheio (30 dias), independentemente dos dias trabalhados.
    resultado.forEach(registro => {
      const contrato = mapContrato.get(registro.contrato_id)
      if (!contrato) return
      if (contrato.adicionais?.insalubridade) {
        registro.dias_insalubridade = Math.max(0, 30 - registro.faltas)
      }
      if (contrato.adicionais?.periculosidade) {
        registro.dias_periculosidade = Math.max(0, 30 - registro.faltas)
      }
    })

    return resultado
  }, [calendarioUnico, vinculosAtivosNoMes, inicioMes, fimMes, mapContrato, mapColaborador, mapDepartamento])

  const linhasFiltradas = useMemo(() => {
    let lista = linhasAgregadas
    if (departamentoFiltro !== 'todos') {
      lista = lista.filter(l => {
        const dept = nomeDepartamento(mapDepartamento.get(departamentoFiltro))
        return l.departamento === dept
      })
    }
    if (adicionalFiltro !== 'todos') {
      lista = lista.filter(l => {
        const contrato = mapContrato.get(l.contrato_id)
        if (!contrato) return false
        return contrato.adicionais[adicionalFiltro as keyof typeof contrato.adicionais] === true
      })
    }
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter(l =>
        l.colaborador_nome.toLowerCase().includes(termo) ||
        l.contrato_nome.toLowerCase().includes(termo) ||
        l.departamento.toLowerCase().includes(termo)
      )
    }
    return lista
  }, [linhasAgregadas, departamentoFiltro, adicionalFiltro, busca, mapDepartamento, mapContrato])

  return (
    <AdicionaisPageWrapper>
      <PageHeader backTo="/adicionais/contratos" title="Relatório de Adicionais" description="Visualize e exporte os adicionais contratuais por colaborador" />

      <AdicionaisCard>
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex items-center gap-2">
            <AdicionaisButton variant="outline" size="sm" onClick={() => {
              if (mes === 1) { setMes(12); setAno(a => a - 1) }
              else setMes(m => m - 1)
            }}>
              <ChevronLeft className="w-4 h-4" />
            </AdicionaisButton>
            <div className="text-lg font-semibold min-w-[220px] text-center" style={{ color: '#1F2937' }}>
              {inicioMes ? `${inicioMes.split('-').reverse().join('/')} a ${fimMes.split('-').reverse().join('/')}` : ''}
            </div>
            <AdicionaisButton variant="outline" size="sm" onClick={() => {
              if (mes === 12) { setMes(1); setAno(a => a + 1) }
              else setMes(m => m + 1)
            }}>
              <ChevronRight className="w-4 h-4" />
            </AdicionaisButton>
          </div>

          <div className="w-full lg:w-56">
            <Label style={{ color: '#1F2937' }}>Departamento</Label>
            <Select value={departamentoFiltro} onValueChange={setDepartamentoFiltro}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {departamentos.map(d => (
                  <SelectItem key={d.id} value={d.id}>{nomeDepartamento(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-48">
            <Label style={{ color: '#1F2937' }}>Adicional</Label>
            <Select value={adicionalFiltro} onValueChange={setAdicionalFiltro}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="noturno">Noturno</SelectItem>
                <SelectItem value="periculosidade">Periculosidade</SelectItem>
                <SelectItem value="insalubridade">Insalubridade</SelectItem>
                <SelectItem value="intrajornada">Intrajornada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1">
            <Label style={{ color: '#1F2937' }}>Buscar</Label>
            <Input
              placeholder="Colaborador, contrato ou departamento..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="rounded-lg"
            />
          </div>

          <AdicionaisButton variant="outline" onClick={() => exportarExcel(linhasFiltradas)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </AdicionaisButton>
          <AdicionaisButton variant="outline" onClick={() => exportarCSV(linhasFiltradas)}>
            <FileText className="w-4 h-4 mr-2" />
            CSV
          </AdicionaisButton>
        </div>
      </AdicionaisCard>

      {(loadingAdicionais || loadingColaboradores || loadingDepartamentos) && (
        <AdicionaisCard>
          <p className="text-center py-4" style={{ color: '#94A3B8' }}>Carregando dados...</p>
        </AdicionaisCard>
      )}

      {!loadingColaboradores && colaboradores.length === 0 && (
        <AdicionaisCard>
          <p className="text-center py-4 text-amber-600">
            Nenhum colaborador carregado. Verifique a conexão com o Supabase e as permissões (RLS).
          </p>
        </AdicionaisCard>
      )}

      <AdicionaisCard title={`Resultados (${linhasFiltradas.length})`}>
        {linhasFiltradas.length === 0 ? (
          <p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum registro encontrado para o período.</p>
        ) : (
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
            <Table>
              <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                <TableRow>
                  <TableHead style={{ color: '#1F2937' }}>Colaborador</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Contrato</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Departamento</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Trabalhados</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Noturno</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Periculosidade</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Insalubridade</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Intrajornada</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Folgas</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Faltas</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Férias</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}>Afastados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasFiltradas.map((l, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50">
                    <TableCell className="font-medium" style={{ color: '#1F2937' }}>{l.colaborador_nome}</TableCell>
                    <TableCell style={{ color: '#1F2937' }}>{l.contrato_nome}</TableCell>
                    <TableCell style={{ color: '#1F2937' }}>{l.departamento}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.dias_trabalhados}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.dias_noturno}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.dias_periculosidade}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.dias_insalubridade}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.dias_intrajornada}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.folgas}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.faltas}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.ferias}</TableCell>
                    <TableCell className="text-center" style={{ color: '#1F2937' }}>{l.afastados}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdicionaisCard>
    </AdicionaisPageWrapper>
  )
}
