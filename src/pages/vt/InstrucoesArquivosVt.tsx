import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

// Instruções na tela sobre quais arquivos anexar e em que formato (pedido da
// gestora, 23/10/2026: "deixe anotado no programa quais os arquivos precisam
// ser anexados e formato"). Texto curto e sem jargão. <details> aberto por
// padrão: quem já conhece fecha com um clique.

function CaixaInstrucoes({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details open className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
      <summary className="flex cursor-pointer select-none items-center gap-2 font-semibold text-foreground">
        <Info className="size-4 shrink-0 text-primary" />
        {titulo}
      </summary>
      <div className="mt-2 space-y-1.5 pl-6">{children}</div>
    </details>
  )
}

/** Aba Carga: relatório "Gestão de escalas" do Flit (formato validado pelo parser gestaoEscalasFlit.ts). */
export function InstrucoesCarga() {
  return (
    <CaixaInstrucoes titulo="Qual arquivo anexar na Carga">
      <p>
        <strong className="text-foreground">Arquivo:</strong> relatório <strong className="text-foreground">"Gestão
        de escalas"</strong> do Flit, exportado em <strong className="text-foreground">Excel (.xlsx)</strong>.
      </p>
      <p>
        <strong className="text-foreground">Período:</strong> o mês da carga <strong className="text-foreground">inteiro</strong>,
        do dia 1 ao último dia do mês. Gere por volta do dia 25, quando o mês seguinte já estiver programado no Flit.
      </p>
      <p>
        <strong className="text-foreground">O que o relatório precisa ter:</strong> uma linha por pessoa, com as colunas
        Colaborador, Empresa, Departamento (o posto), Cargo e Horário, e depois uma coluna para cada dia do mês
        (ex.: "01/11/2026 - Dom."). Em cada dia, a marca do Flit: [T] trabalha, [F] folga, [FR] férias, [AF] afastado,
        [AT] atestado. Pode deixar a aba com o nome que o Flit dá ("data").
      </p>
      <p>Não edite o arquivo antes de anexar: o sistema lê o relatório como o Flit gera.</p>
    </CaixaInstrucoes>
  )
}

/** Aba Fechamento: espelho de ponto do Flit ("CORH - Adicionais e Ocorrências", PDF). */
export function InstrucoesFechamento() {
  return (
    <CaixaInstrucoes titulo="Quais arquivos são usados no Fechamento">
      <p>
        <strong className="text-foreground">Arquivo:</strong> espelho de ponto do Flit, relatório{' '}
        <strong className="text-foreground">"CORH - Adicionais e Ocorrências"</strong>, em{' '}
        <strong className="text-foreground">PDF</strong>. Ele não é anexado aqui: envie em{' '}
        <strong className="text-foreground">Adicionais → Importar Ponto</strong> e ele aparece nesta tela.
      </p>
      <p>
        <strong className="text-foreground">Quais períodos:</strong> o ponto fecha do dia 20 ao dia 19, então um mês
        precisa de <strong className="text-foreground">dois períodos</strong>: o que vai do dia 20 do mês anterior ao dia
        19 do mês, e o que vai do dia 20 do mês ao dia 19 do mês seguinte.
      </p>
      <p>
        Cada período pode vir em <strong className="text-foreground">vários arquivos</strong> (ex.: 20/09 a 07/10, 07 a
        13/10 e 12 a 19/10). Marque todos: o sistema junta os dias. Se o mesmo dia aparecer em dois arquivos, vale o
        arquivo enviado mais recentemente.
      </p>
      <p>
        <strong className="text-foreground">Quando fazer:</strong> depois que o ponto do segundo período fechar (após o
        dia 19 do mês seguinte). Antes disso, os dias que faltam ficam como "não conferidos" e nunca são descontados.
      </p>
    </CaixaInstrucoes>
  )
}
