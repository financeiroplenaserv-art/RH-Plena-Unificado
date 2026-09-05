import { useState, useRef, useEffect } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useCEUFornecedores } from '@/hooks/useCEUFornecedores'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { useColaboradores } from '@/hooks/useColaboradores'
import { CeuShell } from './CeuShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { CeuBadge } from '@/components/ceu/CeuBadge'
import { cn } from '@/lib/utils'
import * as XLSX from '@e965/xlsx'
import { toast } from 'sonner'
import { parseMoedaParaCentavos, agoraBrasil } from '@/lib/utils'
import {
  analisarLinhas,
  chaveDuplicidade,
  mapearLinhasArquivo,
  pareceEntregas,
  parseCsvEntregas,
  type LinhaEntregaAnalisada,
} from '@/lib/ceu/importarEntregas'
import type { Colaborador, EntregaCEU, Fornecedor, ItemCEU } from '@/types/database'

type TipoImportacao = 'itens' | 'fornecedores' | 'entregas'

interface LinhaImportacao {
  dados: Record<string, string>
  valido: boolean
  erros: string[]
}

const TIPOS: { id: TipoImportacao; label: string; colunas: string[] }[] = [
  {
    id: 'itens',
    label: 'Itens',
    colunas: ['id', 'codigo', 'nome', 'tipo', 'valor', 'ca', 'validade', 'subgrupo', 'estoque', 'estoque_minimo', 'prazo_uso_dias'],
  },
  {
    id: 'fornecedores',
    label: 'Fornecedores',
    colunas: ['nome', 'cnpj', 'telefone', 'email'],
  },
  {
    id: 'entregas',
    label: 'Entregas (EPI/Uniforme)',
    colunas: ['colaborador', 'quantidade', 'item', 'tamanho'],
  },
]

const SITUACOES_ENTREGA = ['Troca', 'Novo', 'Substituição', 'Devolução'] as const

/** Primeiro dia do mês corrente no fuso de Brasília — padrão operacional dos recibos CEU. */
function primeiroDiaDoMesLocal(): string {
  const agora = agoraBrasil()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`
}

function validarLinha(tipo: TipoImportacao, row: Record<string, string>): LinhaImportacao {
  const erros: string[] = []
  const get = (...keys: string[]) => keys.map((k) => row[k]).find((v) => v !== undefined && v !== '')

  if (tipo === 'itens') {
    if (!get('nome', 'Nome')) erros.push('Nome obrigatório')
    if (!get('tipo', 'Tipo')) erros.push('Tipo obrigatório')
  }
  if (tipo === 'fornecedores') {
    if (!get('nome', 'Nome')) erros.push('Nome obrigatório')
  }

  return { dados: row, valido: erros.length === 0, erros }
}

/** Status visual da linha de entrega, já considerando duplicidade na data. */
function statusEfetivo(linha: LinhaEntregaAnalisada, duplicada: boolean) {
  if (linha.status === 'erro') return 'erro'
  if (linha.status === 'aviso' || duplicada) return 'aviso'
  return 'ok'
}

function linhaDuplicada(linha: LinhaEntregaAnalisada, duplicadas: Set<string>) {
  return (
    !!linha.colaborador &&
    !!linha.item &&
    duplicadas.has(chaveDuplicidade(linha.colaborador.id, linha.item.id, linha.original.quantidade))
  )
}

export function CeuImportarPage() {
  const { criar: criarItem, atualizar: atualizarItem, itens, listar: listarItens } = useCEUItens()
  const { criar: criarFornecedor } = useCEUFornecedores()
  const { criarLote, listar: listarEntregas } = useCEUEntregas()
  const { listarResumido: listarColaboradores } = useColaboradores()

  useEffect(() => {
    listarItens()
  }, [listarItens])

  const [tipo, setTipo] = useState<TipoImportacao>('itens')
  const [linhas, setLinhas] = useState<LinhaImportacao[] | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [importando, setImportando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado específico da importação de entregas
  const [dataEntrega, setDataEntrega] = useState(primeiroDiaDoMesLocal)
  const [situacaoEntrega, setSituacaoEntrega] = useState<string>('Troca')
  const [linhasEntregas, setLinhasEntregas] = useState<LinhaEntregaAnalisada[] | null>(null)
  const [duplicadas, setDuplicadas] = useState<Set<string>>(new Set())
  const colaboradoresRef = useRef<Colaborador[] | null>(null)

  const itensAtivos = itens.filter((i) => i.situacao !== 'I')

  /** Recalcula as duplicadas para a data escolhida e desmarca as linhas afetadas. */
  async function checarDuplicatas(data: string) {
    const entregasDia = await listarEntregas({ dataInicio: data, dataFim: data })
    const dup = new Set(
      entregasDia.map((e) => chaveDuplicidade(e.colaborador_id, e.item_id, e.quantidade))
    )
    setDuplicadas(dup)
    setLinhasEntregas((prev) =>
      prev
        ? prev.map((l) => ({
            ...l,
            incluir:
              l.status === 'ok'
                ? !linhaDuplicada(l, dup)
                : l.incluir && !linhaDuplicada(l, dup),
          }))
        : prev
    )
  }

  /** Analisa as linhas de um arquivo de entregas e monta a prévia. */
  async function processarArquivoEntregas(rows: Record<string, unknown>[], nome: string) {
    const linhasArquivo = mapearLinhasArquivo(rows)
    if (linhasArquivo.length === 0) {
      toast.error('Não encontrei as colunas colaborador / quantidade / item / tamanho no arquivo')
      return
    }

    if (!colaboradoresRef.current) {
      colaboradoresRef.current = await listarColaboradores()
    }
    const analisadas = analisarLinhas(linhasArquivo, colaboradoresRef.current, itensAtivos)
    setLinhasEntregas(analisadas)
    setNomeArquivo(nome)
    await checarDuplicatas(dataEntrega)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    let rows: Record<string, unknown>[]
    if (file.name.endsWith('.csv')) {
      rows = parseCsvEntregas(await file.text())
    } else {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Record<string, unknown>[]
    }

    if (rows.length === 0) {
      toast.error('Arquivo vazio ou formato inválido')
      return
    }

    // Arquivo de entregas subido com outro tipo selecionado: troca sozinho.
    if (tipo !== 'entregas' && pareceEntregas(rows)) {
      setTipo('entregas')
      setLinhas(null)
      toast.info('Arquivo de entregas detectado — tipo alterado para "Entregas (EPI/Uniforme)"')
      await processarArquivoEntregas(rows, file.name)
      return
    }

    if (tipo === 'entregas') {
      await processarArquivoEntregas(rows, file.name)
      return
    }

    const validadas = rows.map((row) => validarLinha(tipo, row as Record<string, string>))
    setLinhas(validadas)
    setNomeArquivo(file.name)
  }

  const handleDataEntregaChange = async (data: string) => {
    setDataEntrega(data)
    if (linhasEntregas && data) await checarDuplicatas(data)
  }

  /** Aplica a escolha manual de item numa linha que não resolveu sozinha. */
  function escolherItem(indice: number, itemId: string) {
    const escolhido = itensAtivos.find((i) => i.id === itemId)
    if (!escolhido) return
    setLinhasEntregas((prev) =>
      prev
        ? prev.map((l) => {
            if (l.indice !== indice) return l
            const mensagens = l.mensagens.filter(
              (m) => !m.startsWith('Item não resolvido') && !m.startsWith('Nenhum item')
            )
            const status = !l.colaborador ? 'erro' : mensagens.length > 0 ? 'aviso' : 'ok'
            const dup = duplicadas.has(
              chaveDuplicidade(l.colaborador?.id || '', escolhido.id, l.original.quantidade)
            )
            return { ...l, item: escolhido, mensagens, status, incluir: status === 'ok' && !dup }
          })
        : prev
    )
  }

  function alternarIncluir(indice: number) {
    setLinhasEntregas((prev) =>
      prev ? prev.map((l) => (l.indice === indice ? { ...l, incluir: !l.incluir } : l)) : prev
    )
  }

  const importarEntregas = async () => {
    if (!linhasEntregas) return
    if (!dataEntrega) {
      toast.error('Informe a data da entrega')
      return
    }
    const escolhidas = linhasEntregas.filter((l) => l.incluir && l.colaborador && l.item)
    if (escolhidas.length === 0) {
      toast.error('Nenhuma linha marcada para importar')
      return
    }

    setImportando(true)
    const payloads = escolhidas.map((l) => ({
      colaborador_id: l.colaborador!.id,
      item_id: l.item!.id,
      data_entrega: dataEntrega,
      quantidade: l.original.quantidade,
      // situacao alimenta o recibo; observacao mantida por compatibilidade
      // (mesmo padrão do Lançamento Rápido).
      situacao: situacaoEntrega,
      observacao: situacaoEntrega,
      matricula: l.colaborador!.matricula,
      snapshot_item: {
        nome: l.item!.nome,
        codigo: l.item!.codigo || '',
        tipo: l.item!.tipo,
        ca: l.item!.ca || '',
        valor: l.item!.valor || null,
        prazo_uso_dias: l.item!.prazo_uso_dias || null,
      },
    }))

    const resultado = await criarLote(payloads as Partial<EntregaCEU>[])
    setImportando(false)
    if (!resultado) return

    const puladas = linhasEntregas.length - escolhidas.length
    toast.success(`${resultado.length} entrega(s) registrada(s) em ${dataEntrega.split('-').reverse().join('/')}`)
    if (puladas > 0) {
      toast.warning(`${puladas} linha(s) ficaram de fora (desmarcadas ou com pendência)`, { duration: 6000 })
    }
    setLinhasEntregas(null)
    setNomeArquivo('')
    setDuplicadas(new Set())
  }

  const importar = async () => {
    if (!linhas) return
    const validas = linhas.filter((l) => l.valido)
    if (validas.length === 0) {
      toast.error('Nenhuma linha válida para importar')
      return
    }

    setImportando(true)
    let sucesso = 0

    for (const linha of validas) {
      const row = linha.dados
      try {
        if (tipo === 'itens') {
          const rawValor = row.valor || row.Valor || row.preco || row.Preco || row['Valor Unitario'] || row['Valor Unitário']

          const payload: Partial<ItemCEU> = {
            codigo: row.codigo || row.Codigo || row.codigo_produto || row['Codigo Produto'] || row['Código Produto'] || null,
            nome: row.nome || row.Nome || '',
            tipo: row.tipo || row.Tipo || '',
            valor: parseMoedaParaCentavos(rawValor),
            ca: row.ca || row.CA || null,
            validade: row.validade || row.Validade || null,
            subgrupo: row.subgrupo || row.Subgrupo || null,
            estoque: parseInt(row.estoque || row.Estoque || '0', 10),
            estoque_minimo: parseInt(row.estoque_minimo || row['Estoque Minimo'] || row['Estoque Mínimo'] || '0', 10),
            prazo_uso_dias: row.prazo_uso_dias || row['Prazo Uso Dias']
              ? parseInt(row.prazo_uso_dias || row['Prazo Uso Dias'] || '0', 10)
              : null,
          }

          const rowId = row.id || row.Id || row.ID
          const rowCodigo = row.codigo || row.Codigo || row.codigo_produto || row['Codigo Produto'] || row['Código Produto']
          const itemPorId = rowId ? itens.find((i) => i.id === rowId) : undefined
          const itemPorCodigo = rowCodigo ? itens.find((i) => i.codigo && i.codigo.toLowerCase() === rowCodigo.toLowerCase()) : undefined

          let result: ItemCEU | null = null
          if (itemPorId) {
            const ok = await atualizarItem(itemPorId.id, payload)
            if (ok) result = { ...itemPorId, ...payload } as ItemCEU
          } else if (itemPorCodigo) {
            const ok = await atualizarItem(itemPorCodigo.id, payload)
            if (ok) result = { ...itemPorCodigo, ...payload } as ItemCEU
          } else {
            result = await criarItem(payload)
          }
          if (result) sucesso++
        }
        if (tipo === 'fornecedores') {
          const payload: Partial<Fornecedor> = {
            nome: row.nome || row.Nome || '',
            cnpj: row.cnpj || row.CNPJ || null,
            telefone: row.telefone || row.Telefone || null,
            email: row.email || row.Email || null,
          }
          const result = await criarFornecedor(payload)
          if (result) sucesso++
        }
      } catch (err) {
        console.error('Erro ao importar linha:', row, err)
      }
    }

    setImportando(false)
    toast.success(`${sucesso} registro(s) importado(s) com sucesso`)
    setLinhas(null)
    setNomeArquivo('')
  }

  const tipoAtual = TIPOS.find((t) => t.id === tipo)!

  const exportarModelo = () => {
    const rows = itens.map((item) => ({
      id: item.id,
      codigo: item.codigo || '',
      nome: item.nome,
      tipo: item.tipo,
      valor: item.valor ? item.valor / 100 : '',
      ca: item.ca || '',
      validade: item.validade || '',
      subgrupo: item.subgrupo || '',
      estoque: item.estoque ?? 0,
      estoque_minimo: item.estoque_minimo ?? 0,
      prazo_uso_dias: item.prazo_uso_dias ?? '',
    }))
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens CEU')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-itens-ceu.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportarModeloEntregas = () => {
    const csv = [
      'colaborador;quantidade;item;tamanho',
      'NOME DO COLABORADOR;2;Luvas látex;G',
      'NOME DO COLABORADOR;1;Bota;42',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-entregas-ceu.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const resumoEntregas = linhasEntregas
    ? {
        incluidas: linhasEntregas.filter((l) => l.incluir && l.colaborador && l.item).length,
        avisos: linhasEntregas.filter((l) => statusEfetivo(l, linhaDuplicada(l, duplicadas)) === 'aviso').length,
        erros: linhasEntregas.filter((l) => l.status === 'erro').length,
      }
    : null

  return (
    <CeuShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader backTo="/ceu/movimentacoes" title="Importar CEU" description="Importe itens, fornecedores ou entregas via CSV/Excel" />

        <ModuleCard title="Tipo de importação" icon={<Upload className="w-4 h-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTipo(t.id)
                  setLinhas(null)
                  setLinhasEntregas(null)
                }}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  tipo === t.id
                    ? 'border-[#3B82F6] bg-blue-50'
                    : 'border-slate-200 hover:border-[#3B82F6]/50'
                }`}
              >
                <p className="font-medium text-slate-900">{t.label}</p>
                <p className="text-xs text-slate-500 mt-1">{t.colunas.join(', ')}</p>
              </button>
            ))}
          </div>
        </ModuleCard>

        {tipo === 'entregas' && (
          <ModuleCard title="Dados do lançamento" icon={<CheckCircle2 className="w-4 h-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Data da entrega</label>
                <Input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => handleDataEntregaChange(e.target.value)}
                  className="mt-1"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Pode ser usada a data de 1º do mês, mesmo que o recibo seja preparado antes.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Situação</label>
                <Select value={situacaoEntrega} onValueChange={setSituacaoEntrega}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITUACOES_ENTREGA.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Os recibos NÃO são emitidos aqui — emita depois em Movimentações.
                </p>
              </div>
            </div>
          </ModuleCard>
        )}

        <ModuleCard title="Upload do arquivo" icon={<FileSpreadsheet className="w-4 h-4" />}>
          <div className="space-y-4">
            {tipo === 'itens' && (
              <div className="flex justify-end">
                <ModuleButton variant="outline" size="sm" onClick={exportarModelo} disabled={itens.length === 0}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Baixar modelo com itens atuais
                </ModuleButton>
              </div>
            )}
            {tipo === 'entregas' && (
              <div className="flex justify-end">
                <ModuleButton variant="outline" size="sm" onClick={exportarModeloEntregas}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Baixar modelo CSV de entregas
                </ModuleButton>
              </div>
            )}
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-[#3B82F6]/30 border-dashed rounded-lg cursor-pointer bg-blue-50/30 hover:bg-blue-50/50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-[#3B82F6] mb-2" />
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold">Clique para fazer upload</span> ou arraste o arquivo
                  </p>
                  <p className="text-xs text-slate-400">CSV ou Excel (.xlsx, .xls)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            {nomeArquivo && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileSpreadsheet className="w-4 h-4 text-[#3B82F6]" />
                {nomeArquivo}
                <button onClick={() => { setLinhas(null); setLinhasEntregas(null); setNomeArquivo('') }}>
                  <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                </button>
              </div>
            )}
          </div>
        </ModuleCard>

        {linhasEntregas && resumoEntregas && (
          <ModuleCard
            title={`Entregas: ${resumoEntregas.incluidas} marcada(s) / ${resumoEntregas.avisos} com aviso / ${resumoEntregas.erros} com erro`}
            icon={<AlertTriangle className="w-4 h-4" />}
          >
            <div className="max-h-[28rem] overflow-auto border rounded-lg border-slate-200">
              <table className="w-full text-xs min-w-[900px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium border-b w-10">Incluir</th>
                    <th className="text-left px-3 py-2 font-medium border-b w-20">Status</th>
                    <th className="text-left px-3 py-2 font-medium border-b">Colaborador (arquivo)</th>
                    <th className="text-left px-3 py-2 font-medium border-b">Colaborador (cadastro)</th>
                    <th className="text-left px-3 py-2 font-medium border-b">Item (arquivo)</th>
                    <th className="text-left px-3 py-2 font-medium border-b min-w-[240px]">Item (cadastro)</th>
                    <th className="text-left px-3 py-2 font-medium border-b w-14">Qtd</th>
                    <th className="text-left px-3 py-2 font-medium border-b">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasEntregas.map((linha) => {
                    const dup = linhaDuplicada(linha, duplicadas)
                    const status = statusEfetivo(linha, dup)
                    const mensagens = dup
                      ? [...linha.mensagens, 'Já existe entrega igual nesta data']
                      : linha.mensagens
                    return (
                      <tr
                        key={linha.indice}
                        className={cn(
                          'border-b border-slate-100',
                          status === 'erro' ? 'bg-red-50' : status === 'aviso' ? 'bg-amber-50/60' : ''
                        )}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={linha.incluir}
                            disabled={!linha.colaborador || !linha.item}
                            onChange={() => alternarIncluir(linha.indice)}
                            className="accent-[#0F6CBD] w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {status === 'ok' && <CeuBadge type="equipamento">OK</CeuBadge>}
                          {status === 'aviso' && <CeuBadge type="cracha">Aviso</CeuBadge>}
                          {status === 'erro' && <CeuBadge type="epi">Erro</CeuBadge>}
                        </td>
                        <td className="px-3 py-2 break-words max-w-[180px]">{linha.original.colaborador}</td>
                        <td className="px-3 py-2 break-words max-w-[180px]">
                          {linha.colaborador ? (
                            <>
                              {linha.colaborador.nome_completo}
                              <span className="block text-slate-400">
                                {linha.colaborador.matricula}
                                {linha.colaborador.status !== 'Ativo' ? ` — ${linha.colaborador.status}` : ''}
                              </span>
                            </>
                          ) : (
                            <span className="text-red-600">não encontrado</span>
                          )}
                        </td>
                        <td className="px-3 py-2 break-words max-w-[160px]">{linha.original.descricaoOriginal}</td>
                        <td className="px-3 py-2">
                          {linha.item && linha.status !== 'erro' ? (
                            linha.item.nome
                          ) : (
                            <Select
                              value={linha.item?.id || ''}
                              onValueChange={(v) => escolherItem(linha.indice, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Escolher item..." />
                              </SelectTrigger>
                              <SelectContent>
                                {linha.candidatosItem.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{linha.original.quantidade}</td>
                        <td className="px-3 py-2 text-amber-700 break-words max-w-[220px]">{mensagens.join('; ')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <ModuleButton variant="outline" size="sm" onClick={() => { setLinhasEntregas(null); setNomeArquivo('') }}>
                Cancelar
              </ModuleButton>
              <ModuleButton size="sm" onClick={importarEntregas} disabled={importando || resumoEntregas.incluidas === 0}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                {importando ? 'Registrando...' : `Registrar ${resumoEntregas.incluidas} entrega(s)`}
              </ModuleButton>
            </div>
          </ModuleCard>
        )}

        {linhas && tipo !== 'entregas' && (
          <ModuleCard
            title={`Preview: ${linhas.filter((l) => l.valido).length} válido(s) / ${linhas.filter((l) => !l.valido).length} inválido(s)`}
            icon={<AlertTriangle className="w-4 h-4" />}
          >
            <div className="max-h-96 overflow-auto border rounded-lg border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium border-b">Status</th>
                    {tipoAtual.colunas.map((col) => (
                      <th key={col} className="text-left px-3 py-2 font-medium border-b capitalize">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                    <th className="text-left px-3 py-2 font-medium border-b">Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${!linha.valido ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2">
                        {linha.valido ? (
                          <CeuBadge type="equipamento">Válido</CeuBadge>
                        ) : (
                          <CeuBadge type="epi">Inválido</CeuBadge>
                        )}
                      </td>
                      {tipoAtual.colunas.map((col) => (
                        <td key={col} className="px-3 py-2 break-words max-w-[200px]">
                          {linha.dados[col] || linha.dados[col.charAt(0).toUpperCase() + col.slice(1)] || '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-red-600">
                        {linha.erros.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <ModuleButton variant="outline" size="sm" onClick={() => { setLinhas(null); setNomeArquivo('') }}>
                Cancelar
              </ModuleButton>
              <ModuleButton size="sm" onClick={importar} disabled={importando || linhas.every((l) => !l.valido)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                {importando ? 'Importando...' : 'Importar válidos'}
              </ModuleButton>
            </div>
          </ModuleCard>
        )}
      </div>
    </CeuShell>
  )
}
