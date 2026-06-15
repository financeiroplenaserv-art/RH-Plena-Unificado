import { useEffect, useRef, useState } from 'react'
import { Download, Upload, ShieldAlert, Lock, Unlock, FileJson } from 'lucide-react'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { useCEUFornecedores } from '@/hooks/useCEUFornecedores'
import { CeuPageWrapper } from './CeuPageWrapper'
import { CeuCard } from '@/components/ceu/CeuCard'
import { CeuButton } from '@/components/ceu/CeuButton'
import { CeuInput } from '@/components/ceu/CeuInput'
import { toast } from 'sonner'

interface LogExclusao {
  id: string
  tipo: string
  descricao: string
  data: string
  usuario: string
}

const SENHA_LOG = 'ceu2024'

function downloadFile(content: string, filename: string, type: string) {
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

export function CeuConfiguracoesPage() {
  const { itens, listar: listarItens } = useCEUItens()
  const { entregas, listar: listarEntregas } = useCEUEntregas()
  const { fornecedores, listar: listarFornecedores } = useCEUFornecedores()

  const [logs, setLogs] = useState<LogExclusao[]>([])
  const [logDesbloqueado, setLogDesbloqueado] = useState(false)
  const [senha, setSenha] = useState('')
  const [erroSenha, setErroSenha] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listarItens()
    listarEntregas()
    listarFornecedores()

    const salvos = localStorage.getItem('ceu_logs_exclusao')
    if (salvos) {
      try {
        setLogs(JSON.parse(salvos))
      } catch {
        setLogs([])
      }
    }
  }, [listarItens, listarEntregas, listarFornecedores])

  const backupJSON = () => {
    const dados = {
      gerado_em: new Date().toISOString(),
      modulo: 'CEU',
      itens,
      entregas,
      fornecedores,
      logs_exclusao: logs,
    }
    downloadFile(JSON.stringify(dados, null, 2), `backup_ceu_${new Date().toISOString().split('T')[0]}.json`, 'application/json')
    toast.success('Backup exportado')
  }

  const restaurarJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setRestaurando(true)
    try {
      const text = await file.text()
      const dados = JSON.parse(text)

      if (!dados.itens || !dados.entregas || !dados.fornecedores) {
        toast.error('Arquivo de backup inválido')
        return
      }

      localStorage.setItem('ceu_backup_restaurado', JSON.stringify(dados))
      if (dados.logs_exclusao) {
        localStorage.setItem('ceu_logs_exclusao', JSON.stringify(dados.logs_exclusao))
        setLogs(dados.logs_exclusao)
      }

      toast.success('Backup restaurado no navegador (dados em memória local)')
    } catch {
      toast.error('Erro ao ler arquivo de backup')
    } finally {
      setRestaurando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const desbloquearLog = () => {
    if (senha === SENHA_LOG) {
      setLogDesbloqueado(true)
      setErroSenha(false)
    } else {
      setErroSenha(true)
    }
  }

  return (
    <CeuPageWrapper>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Configurações CEU</h2>
          <p className="text-sm text-slate-500">Backup, restore e logs de exclusão</p>
        </div>

        <CeuCard title="Backup completo" icon={<Download className="w-4 h-4" />} gradient="blue">
          <p className="text-sm text-slate-500 mb-4">
            Exporte todos os dados do módulo CEU (itens, entregas, fornecedores e logs) para um arquivo JSON.
          </p>
          <CeuButton onClick={backupJSON}>
            <FileJson className="w-4 h-4 mr-2" />
            Exportar JSON
          </CeuButton>
        </CeuCard>

        <CeuCard title="Restaurar backup" icon={<Upload className="w-4 h-4" />} gradient="blue">
          <p className="text-sm text-slate-500 mb-4">
            Restaure os dados a partir de um arquivo JSON de backup. Os dados são carregados no armazenamento local do navegador.
          </p>
          <div className="flex items-center gap-3">
            <CeuButton variant="outline" onClick={() => fileInputRef.current?.click()} disabled={restaurando}>
              <Upload className="w-4 h-4 mr-2" />
              {restaurando ? 'Restaurando...' : 'Selecionar arquivo JSON'}
            </CeuButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={restaurarJSON}
            />
          </div>
        </CeuCard>

        <CeuCard title="Log de exclusões" icon={<ShieldAlert className="w-4 h-4" />} gradient="orange">
          {!logDesbloqueado ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                O log de exclusões está protegido por senha. Informe a senha para visualizar.
              </p>
              <div className="flex gap-2">
                <CeuInput
                  type="password"
                  placeholder="Senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-48"
                />
                <CeuButton onClick={desbloquearLog}>
                  <Lock className="w-4 h-4 mr-2" />
                  Desbloquear
                </CeuButton>
              </div>
              {erroSenha && <p className="text-sm text-red-600">Senha incorreta</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Registro de exclusões realizadas no módulo CEU.
                </p>
                <CeuButton variant="outline" size="sm" onClick={() => { setLogDesbloqueado(false); setSenha('') }}>
                  <Unlock className="w-3.5 h-3.5 mr-1.5" />
                  Bloquear
                </CeuButton>
              </div>
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">Nenhum registro de exclusão.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-slate-700">Data</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-700">Descrição</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-700">Usuário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-t border-slate-100">
                          <td className="px-4 py-2">{new Date(log.data).toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-2">{log.tipo}</td>
                          <td className="px-4 py-2">{log.descricao}</td>
                          <td className="px-4 py-2">{log.usuario}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CeuCard>
      </div>
    </CeuPageWrapper>
  )
}
