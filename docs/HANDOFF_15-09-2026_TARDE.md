# Handoff — 15/09/2026 (tarde)

> Sessão: Ocorrências — Nova Ocorrência passa a permitir lançar para
> colaborador **inativo/demitido** (pedido da gestão: caso esporádico, ex.:
> registro de ocorrência após o desligamento). Sem migration, sem edge
> function — mudança só de frontend. **Deploy feito no fim da sessão**
> (Netlify `plena-corh`, deploy `6aa94052b6d6f73c58e464ff`, hash do bundle
> `assets/index-CP7m-KHz.js` conferido igual ao `dist/` local). Commit
> `353fc8e` (push em `main`). Nada pendente de deploy.

## 1) O que era o bloqueio

- O formulário de Nova Ocorrência (`/rh/ocorrencias/novo`) usa
  `AutocompleteColaborador`, que filtra `status = 'Ativo'` por padrão
  (prop `somenteAtivos = true`) — colaborador inativo **nem aparecia nas
  sugestões**, então era impossível selecioná-lo e lançar a ocorrência.
- O hook `useOcorrenciaForm` não tinha nenhuma outra trava por status
  (validações, gravação e geração do PDF funcionam para qualquer
  colaborador com `id`).

## 2) Solução aprovada pela gestão

A primeira versão da sessão simplesmente removeu o filtro (mostrava ativos
e inativos juntos). A gestão pediu para **não expor inativos por padrão**,
já que o caso é esporádico — solução final:

- Card "1. Colaborador" do formulário
  (`src/components/ocorrencias/ocorrencia-form/ColaboradorSection.tsx`)
  ganhou um seletor **Ativos | Inativos** ao lado do rótulo do campo,
  **padrão Ativos** (comportamento anterior preservado).
- Trocar para **Inativos** restringe a busca somente a inativos e remonta
  o autocomplete (`key={statusBusca}`) — limpa busca/seleção do status
  anterior para não sobrar colaborador do grupo errado.
- `AutocompleteColaborador` ganhou a prop opcional **`somenteInativos`**
  (espelho da `somenteAtivos`), aplicada nos dois caminhos de busca
  (`buscarSugestoes` e `buscarPorDepartamento`). Os demais usos do
  componente (férias, filtro da listagem de ocorrências etc.) não mudaram.
- O dropdown continua mostrando o selo de status (`BadgeStatus`) em cada
  linha, útil para desambiguizar homônimos.

## 3) Verificações

- `tsc -p tsconfig.app.json` ok, `npm run lint` ok (0 warnings),
  `npm test` ok (**408 testes, 34 arquivos**), `npm run build` ok.
- Produção verificada: `index-CP7m-KHz.js` servido no ar = `dist/` local.

## Pendências

- Seguem de pé as pendências do handoff de 11/09 (validação da gestão do
  fluxo de reimportação do ponto e o espelho "01 a 08_09.pdf" com período
  de agosto).
- `func-deployada.txt` (untracked, artefato local) segue fora de propósito.
