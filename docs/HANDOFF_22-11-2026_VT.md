# Handoff VT — 22/11/2026

> Ponto de retomada. Continuação de `docs/HANDOFF_21-11-2026_VT_RECOMECO.md` (as pendências da §3 de lá continuam valendo).
> **Nada desta sessão foi commitado nem publicado.** O deploy ficou combinado para 23/11/2026.

## 1. O que foi feito

### 1.1 Aba nova VT → "Importações do mês" (`/vt/importacoes`)
Substitui o processamento manual que o agente fazia todo mês.
- **Optantes (Alterdata):** sobe os PDFs "desconta VT" e "Declaração de Não Beneficiário". A tela reconhece qual é qual e monta uma prévia com marcação por pessoa antes de gravar `colaboradores.vt_optante`. A prévia separa:
  - vira optante / deixa de ser / sem mudança;
  - pessoa nos dois relatórios (não grava);
  - não encontrados no CORH;
  - ativos e afastados fora dos dois relatórios (só para conferir).
- **Riocard:** sobe o PDF "Cadastro de Funcionários da Empresa" de cada conta (EA e Tech). Grava `vt_bu_ativado`, `vt_bu_situacao`, `vt_bu_consultado_em` (padrão = data de emissão do arquivo, editável) e `vt_riocard_numero_cartao`. Listas de conferência:
  - inativar na Riocard;
  - cadastrar na Riocard;
  - ativos que não são optantes;
  - conflitos.
- Casamento só por CPF de 11 dígitos (no Alterdata, matrícula exata quando não há CPF). Nunca por nome; duplicidade vira "não encontrado".
- "Excel de conferência" em cada cartão. As gravações conferem as linhas afetadas.
- Validado com os arquivos reais de 21/11: 238/238, 61/61 e 930/930 linhas iguais ao processamento manual (`src/lib/vt/importacaoPdfsReais.test.ts`, pulado sem `dados-locais`).
- Código:
  - `src/lib/vt/importacaoAlterdata.ts`, `importacaoRiocard.ts`, `excelImportacoes.ts`;
  - `src/hooks/useVtImportacoes.ts`;
  - `src/pages/vt/VtImportacoesTab.tsx`;
  - rota em `App.tsx`/`VtPage.tsx`;
  - instruções em `InstrucoesArquivosVt.tsx` e `docs/ROTINA_MENSAL_VT.md`.

### 1.2 "Extra no mês (R$)" na aba Carga (decisão da gestora)
- Valor **TOTAL do mês** por pessoa e competência, com **motivo obrigatório**. Casos: DuoConnect (vão a outros contratos alguns dias), a cobertura de Montreal/Évora e faltistas que rodam vários postos sem rota certa.
- **Teto de R$ 500,00 por extra** (decisão da gestora, 22/11). Constante `TETO_EXTRA_MENSAL_CENTAVOS` em `src/lib/vt/extraMensal.ts`.
- Soma no total da pessoa e no Excel do lote (colunas "Extra no mês (R$)" e "Motivo do extra").
- No domínio é um crédito `origem: 'extra_mensal'`. Entra no hash e muda a divergência; lote sem extra mantém o hash antigo.
- Na ponte para `vt_cargas`, entra em `ajuste_centavos`, sem item no `detalhe`. Por isso **o Fechamento nunca desconta nem credita o extra**.
- **Depois de confirmar o lote, o extra fica travado** (decisão da gestora, 22/11). Para corrigir: recalcular o rascunho e confirmar um substituto, aprovando a divergência por pessoa.
- Pessoa sem dia de trabalho pode receber só o extra (aviso "só extra"). Quem está fora do lote por rota pendente não recebe.
- Tabela nova `vt_extras_mensais`, **migration `176_vt_extras_mensais.sql` APLICADA em 22/11/2026 (verificação em `dados-locais/backup_vt_176_2026-11-22/`)**.
  - Inclui RLS, GRANT para authenticated e service_role, `revoke all from anon` e auditoria.
  - Teste em transação desfeita: `scripts/vt/testar-176-transacao.ps1` + `scripts/vt/testes/176_testes.sql`, passou.
  - Sem a migration, a tela avisa "Falta aplicar a migration 176" e o resto da Carga funciona.
- Código:
  - `src/lib/vt/extraMensal.ts`;
  - `src/hooks/useVtExtrasMensais.ts`;
  - `contratosLoteCarga.ts`, `loteCarga.ts`, `pontesLote.ts`, `excelLote.ts`;
  - `VtLoteCargaReal.tsx` e `VtCargaTab.tsx`.

**⚠️ Incidente no teste da 176:** a primeira versão da migration tinha `begin;`/`commit;`. O commit interno fechou a transação do script de teste e a tabela foi **criada em produção**, vazia e sem nenhum dado tocado. O subagente fez `drop table` e corrigiu o arquivo; sem begin/commit está conferido. **A verificação no banco falhou por erro 502 da Management API.** Primeira coisa amanhã:

```sql
select to_regclass('public.vt_extras_mensais');  -- deve ser NULL
```

### 1.3 Pesquisa: o BUI integra ônibus de SG + ônibus municipal de Niterói?
- A gestora acredita que sim (relato de colaboradores de SG).
- O especialista `vt-niteroi` concluiu que **não**: a fonte oficial do BUI diz "exceto os ônibus municipais de Niterói, cuja integração é feita exclusivamente através do BUN". Não achou fonte de 2025–2026 em contrário. Grau de certeza: médio-alto (a página dá 403, foi lida pelo trecho de busca).
- Um texto colado pela gestora ("416M + 33 = R$ 9,40") foi avaliado como **não confiável**: sem fonte, contraria a regra oficial e erra o preço da 416M (R$ 15,10 inteira; R$ 7,10 é a seção Alcântara–Niterói).
- **Cálculo mantido**: 491M + 33 = R$ 9,10 + R$ 4,45 = **R$ 13,55 por sentido**.
- **A prova que decide:** extrato do app Riocard Mais de um colaborador que faz intermunicipal + ônibus de Niterói no mesmo dia. Leitura do valor cobrado no ônibus de Niterói:
  - R$ 4,45: não há integração, a regra atual está certa;
  - ~R$ 0,30 ou ~R$ 2,30: há integração. Mudar a §4 de `VT_REGRAS_TARIFARIAS.md` e recalcular as rotas SG→Niterói com 2 ônibus.
- Alternativa: pedir resposta por escrito à Riocard.

### 1.4 Outros esclarecimentos
- R$ 18,80 **não é teto** do VT: era o bilhete BUI da planilha antiga. O valor é o custo real da rota.
- A página riocardmais.com.br/Tarifas já é fonte do sistema (tabela de 28/09/2026). Hoje dá 403 para leitura automática.

## 2. Para amanhã (23/11/2026), nesta ordem
1. Conferir `to_regclass('public.vt_extras_mensais')` = NULL.
2. Ver se a gestora trouxe o extrato da integração SG–Niterói. Se trouxe e integra, ajustar a regra antes do deploy.
3. **Print da revisão do Thiago Lontra:** a tela mostrou 491M + 33 = **R$ 13,10**, mas o esperado é R$ 13,55. Investigar a diferença: a linha 33 a R$ 4,00? algum desconto aplicado?
4. Backup + autorização da gestora → aplicar a migration 176 (via `scripts/lib/executar-arquivo-sql-management-api.ps1`). Depois, verificar tabela, policies, grants, anon sem grant e 0 U+FFFD.
5. Rodar tsc, lint dos arquivos do VT, vitest (pelo **PowerShell** — o vitest pelo Bash quebra nesta máquina) e build.
6. Commit **só** dos arquivos do VT. Há muitos arquivos alheios não rastreados no repositório: não incluir. Depois push e deploy no `plena-corh`, conferindo o hash do bundle local × remoto.
   - O lint completo falha por 8 erros já existentes em `scripts/vt/*` não commitados (`importar-vt-vigente.ts`, `simular-carga.ts` etc.). Não são desta sessão.
7. Primeiro uso real: a gestora roda as Importações do mês (Alterdata + Riocard EA + Tech). Isso substitui os SQLs pendentes `atualizar_bu_novos_optantes_2026-11-21.sql` e `atualizar_bu_tech_2026-11-21.sql`, que deixam de ser necessários se a tela gravar.
