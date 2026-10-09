import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { ROTULO_STATUS_CEU, ROTULO_STATUS_PRODUTOS } from './rotulosFilas'
import type { StatusCeuPedido, StatusProdutos } from '@/types/materiais'

// Peças visuais compartilhadas pelas filas internas do módulo Materiais.

export function StatusProdutosBadge({ status }: { status: StatusProdutos }) {
  const r = ROTULO_STATUS_PRODUTOS[status] ?? { texto: status, variante: 'neutral' as const }
  return <StatusBadge variant={r.variante}>{r.texto}</StatusBadge>
}

export function StatusCeuBadge({ status }: { status: StatusCeuPedido }) {
  const r = ROTULO_STATUS_CEU[status] ?? { texto: status, variante: 'neutral' as const }
  return <StatusBadge variant={r.variante}>{r.texto}</StatusBadge>
}

/** Seletor de mês (input type=month). `valor` e `onChange` em AAAA-MM. */
export function SeletorMes({ id, valor, onChange, rotulo = 'Mês' }: { id: string; valor: string; onChange: (v: string) => void; rotulo?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} type="month" value={valor} onChange={(e) => e.target.value && onChange(e.target.value)} className="tabular-nums" />
    </div>
  )
}

/** Selo pequeno para destaques de linha (exceção, repetição, divergência). */
export function Selo({ children, tom = 'ambar', title }: { children: React.ReactNode; tom?: 'ambar' | 'vermelho' | 'azul' | 'cinza'; title?: string }) {
  const cores = {
    ambar: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800',
    vermelho: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800',
    azul: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800',
    cinza: 'bg-muted text-muted-foreground ring-border',
  }
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cores[tom]}`}>
      {children}
    </span>
  )
}
