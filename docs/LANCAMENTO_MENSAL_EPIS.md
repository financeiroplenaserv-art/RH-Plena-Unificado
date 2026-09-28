# Lançamento mensal de EPIs (entregas em lote)

> Roteiro para lançar, todo dia 1º, as entregas de EPI/uniforme do mês no CORH.
> Existem **dois caminhos** — escolha um:
>
> 1. **Pela tela** (você mesma, sem agente): aba **CEU → Importar**, tipo
>    "Entregas (EPI/Uniforme)". Serve para qualquer volume e já mostra a
>    prévia linha a linha.
> 2. **Pelo script** (com um agente): `scripts/lancar-epis-mensal.mjs`.
>    Útil quando a lista já vem pronta em planilha e você prefere que o
>    agente faça tudo e te mostre o relatório.

---

## Caminho 1 — pela tela (CEU → Importar)

1. Monte a planilha com as colunas: `colaborador;quantidade;item;tamanho`.
2. No CORH: **CEU → Importar → Entregas (EPI/Uniforme)**.
3. Escolha a **data** (padrão: 1º do mês) e a **situação** (padrão: Troca).
4. Confira a prévia linha a linha (o sistema marca colaborador e item
   automaticamente; desmarque o que não se aplica).
5. Grave. As entregas entram **sem recibo** (o recibo é emitido depois,
   na tela de recibos, quando o colaborador assinar).

## Caminho 2 — pelo script (com um agente)

### O que a usuária faz

0. **ANTES de lançar: conferir os CAs** — se algum fabricante trocou o CA de
   um item, atualize o **cadastro do item** antes do lançamento (ou peça ao
   agente). O script copia o CA do cadastro para o snapshot da entrega no
   momento do lançamento, e o recibo mostra o CA do snapshot (nunca o do
   cadastro atual). Lançou com CA errado? Dá para corrigir o snapshot das
   entregas **somente antes de emitir os recibos** — depois de emitido, o
   recibo é imutável.
0. **A lista pode vir "bagunçada" direto do Google Drive** — não precisa
   arrumar antes. Se o Google Drive estiver sincronizado no computador
   (pasta "Meu Drive" ou disco `G:\`), basta dizer ao agente o nome/caminho
   do arquivo (Excel, CSV ou até colar o conteúdo na conversa): ele limpa,
   converte para o formato abaixo e mostra a prévia antes de gravar.
   Nada disso exige abrir o VS Code.
1. Gera a lista do mês (planilha de sempre) e salva como **CSV separado por
   ponto e vírgula** com o cabeçalho:
   ```
   colaborador;quantidade;item;tamanho;descricao_original
   ```

   - `colaborador`: nome como está no cadastro (pode estar truncado; o
     script tenta achar mesmo assim). Observações entre parênteses são
     ignoradas.
   - `quantidade`: número inteiro.
   - `item`: nome livre ("Luvas látex", "botina", "luva nitrílica9" — o
     tamanho pode vir grudado no nome).
   - `tamanho`: M/G/EG/8/9/40... (pode ficar vazio).
   - `descricao_original`: texto livre, só para o relatório (pode repetir
     o item). Colunas extras depois dela são ignoradas.
2. Salva o arquivo no projeto, por exemplo
   `docs/epis_outubro_lancamentos.csv` (modelo de setembro:
   `docs/epis_setembro_lancamentos.csv`).
3. Pede ao agente: **"lança os EPIs do mês"** e informa onde está o arquivo.

### O que o agente faz

```bash
# 1) Ensaio (dry-run): só mostra o relatório, NÃO grava nada
node scripts/lancar-epis-mensal.mjs --csv=docs/epis_outubro_lancamentos.csv --data=2026-10-01

# 2) Conferir o relatório COM a usuária:
#    - resumo por item (quantidades totais)
#    - plano linha a linha (colaborador → item)
#    - DIVERGÊNCIAS DE TAMANHO: o que ficaria vermelho no Lançamento Rápido
#      (tamanho do item escolhido × medida do cadastro CEU → Tamanhos) —
#      só alerta, NÃO bloqueia; a lista é salva em arquivo em
#      dados-locais/divergencias_tamanho_<AAAAMM>_<data>.csv (abre no Excel);
#      conferir se o pedido novo está certo e, quando
#      a mudança for permanente, atualizar o cadastro na aba CEU → Tamanhos
#    - PROBLEMAS: colaborador não encontrado, inativo/afastado (pulado de
#      propósito), item não resolvido (mostra os candidatos do catálogo)

# 3) Com o OK dela, gravar de verdade:
node scripts/lancar-epis-mensal.mjs --csv=docs/epis_outubro_lancamentos.csv --data=2026-10-01 --aplicar
```

- Se `--data` for omitida, o padrão é o **dia 1º do mês corrente** (horário
  de Brasília).
- O script grava exatamente como o Lançamento Rápido: situação **"Troca"**,
  snapshot do item (com CA da data da entrega) e **sem recibo**
  (`recibo_emitido = false`).
- **Anti-duplicidade**: linhas já existentes na data (mesmo
  colaborador+item+quantidade) são puladas — rodar duas vezes é seguro.
- **Inativos/afastados ficam de fora** (decisão da gestão, 04/09/2026) e
  aparecem na lista de problemas.
- Antes de gravar, o script salva em `dados-locais/` o backup dos IDs
  inseridos (`backup_epis_<AAAAMM>_entregas_<data>.json`) — é com ele que
  uma eventual reversão é feita.
- Ao final, conferir na tela **CEU → Entregas** filtrando pela data.

### Se um item não for resolvido

O relatório mostra os candidatos do catálogo. Ou se ajusta o nome no CSV,
ou se confirma com a usuária qual item vale e, se for um caso recorrente,
registra a escolha fixa no mapa `PREFERE_EXATO` do próprio script (foi
assim com máscara → respirador com válvula, óculos → incolor etc.).

---

*Criado em 26/09/2026, a partir do script de setembro
(`scripts/lancar-epis-setembro.mjs`, mantido como histórico).*
