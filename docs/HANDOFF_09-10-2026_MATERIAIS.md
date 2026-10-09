# HANDOFF — 09/10/2026 — Módulo Materiais (pedido de materiais), Fase 1

> Sessão inteira dedicada ao novo módulo **Materiais**: levantamento do processo atual, proposta
> aprovada pela gestão, plano técnico, preparação dos dados e implementação da Fase 1 na branch
> **`materiais-fase1`** (NÃO mergeada em `main`, site NÃO publicado).
> Banco: migrations 121–124 **aplicadas** em produção (tabelas vazias). Edge Function
> `pedido-materiais` **publicada** (v1). Para os usuários do CORH publicado nada mudou.

---

## 1. Contexto e documentos

- **Processo atual** (relato da usuária, `docs/passo a passo de como fazemos hoje.docx` — não versionado):
  líder preenche Google Form por contrato (1 a 15 do mês) → inspetor confere → gestor (Elisangela)
  aprova pela média/orçamento → mesa operacional (Maciel) confere estoque e compra por fornecedor →
  fornecedor entrega por rota (Rotas 1/2/3 = 3 dias de entrega) → líder assina o relatório "Entrega de
  Material por Cliente". Uniformes/EPI/crachá: mesmo fluxo, mas quem cuida é a **Beth (perfil dp2)**.
- **Fontes analisadas** (em `docs/Pedido de material/` — NÃO versionar, têm nomes/CPFs):
  `Planilha completa de material eu mexendo.xlsx` (162 mil linhas item×contrato×mês desde 12/2022),
  `Entrega de Material por Cliente - 01, 02 e 03_06_26.xlsx`, `pedido_materiais_todas_abas.md`
  (export da planilha de respostas dos 65 Google Forms; aba 1 "Kit Mensal e Link por cliente").
- **Estrutura dos Google Forms atuais** (sem dados pessoais): `docs/materiais-referencia/form-itaguai-com-limpeza.txt`
  e `form-suso-sem-limpeza.txt` — extraídos do `FB_PUBLIC_LOAD_DATA_` dos forms públicos (links na aba 1).
- **Proposta para a gestão** (página publicada, privada da usuária): https://claude.ai/artifact/DTxmqYHGLcyqUQWvTFmc9X
- **Plano técnico (fonte de verdade do desenho):** `docs/PLANO_MATERIAIS_FASE1.md` — §11 lista TODAS as
  decisões confirmadas pela gestão; §12 resume o implementado.

## 2. Decisões da gestão (09/10/2026) — resumo

1. Líder **sem login e sem PIN**: link por contrato num **QR code no quadro do contrato** (público).
   Por isso a tela pública **não exibe dado pessoal** (sem lista da equipe, tamanhos, CPF); uniforme/EPI/crachá
   são digitados; "Seu nome" obrigatório. Rate limit por IP; token revogável.
2. **Redesenho futuro da tela do líder** (quando os kits forem definidos, ~semana de 12/10): público são ASGs
   com dificuldade de preenchimento → tela "confirme o seu kit" (1 toque), cartões com foto, botões +/−, variações
   por toque, sem texto livre obrigatório; equipe escolhida por toque mostrando só **primeiro nome + inicial**
   ("Michelle A.") — dado mínimo aceito pela gestão. A tela atual é PROVISÓRIA.
3. Janela **dia 1 a 15**. **Nada é gerado automaticamente**: tela "Contratos que ainda não pediram" (aviso a
   partir do dia configurável) → inspetor liga e cobra; botão "Preencher pelo kit" (marca "preenchido pelo
   escritório") e "Reabrir link".
4. **Kit Mensal** = limite, personalizado por contrato; fonte oficial = aba do formulário (a cota "MODELO" da
   planilha completa é só referência). Só o gestor edita o kit; mesa/inspetoria pedem alteração.
5. **Um pedido por contrato de pedido por mês**; segundo envio é comum → mescla até aprovação/conferência,
   depois vira **pedido extra**. Repetição de item = **só aviso** (uniforme: só se nome+peça+tamanho coincidem;
   crachá: mesma pessoa no mês).
6. **Duas filas**: produtos → módulo Materiais (inspetor por exceção, gestor aprova, Maciel/mesa compra);
   uniformes/EPI/crachá → **CEU → Pedidos** (inspetor confere tudo, Beth vê saldo do estoque CEU — só referência,
   nunca bloqueia —, compra e atende; crachás vão para a aba Crachás). **Um relatório de entrega por contrato** (Fase 3).
7. Justificativa (acima do kit / antes da validade do item) obrigatória, não bloqueia. Corte de quantidade varia:
   quem aprova ajusta e informa motivo.
8. Rota: gestor e mesa mudam a padrão; mesa pode trocar a rota de UM pedido.
9. Catálogo/preços/kit/links: gestor (Elisangela) e admin (usuária). **Fornecedores**: mesa (Maciel), dp2,
   financeiro, gestor, admin. A aba Fornecedores do CEU saiu (tabela `fornecedores` virou o cadastro único).
10. Ferista no posto: líder pede pelo contrato onde ele trabalha; **faltista sem posto → departamento ADM PLENA**
    (recibo "PLENA ADM").
11. **Contrato de pedido ≠ departamento**: o Telex tem 4 contratos (Barra/Tij/Ipa; Copa/Mad/Bota/Méier;
    Icaraí/Centro Nit/Centro RJ; Sede) no mesmo departamento. Escritório Plena → ADM PLENA. Punta Del Mar encerrado
    (só histórico). Liex Floral/Talco, Vulcan Plus e Pano de chão grande = itens próprios (inativos).
12. Histórico das planilhas será carregado ("vale ouro"); painel usa média de 6 meses fechados (ref. 12).

## 3. O que foi implementado (branch `materiais-fase1`)

| Commit | Conteúdo |
|---|---|
| `556493b`, `80a773d` (também em `main`) | Plano técnico |
| `77ec156` | Migrations 121–123, `src/types/materiais.ts`, `database.ts`, lógica pura `src/lib/materiais/` + testes, permissões |
| `b996cd4` | Telas de cadastro: `/materiais/contratos`, `/materiais/kit`, `/materiais/catalogo`, `/materiais/fornecedores`, `/materiais/alteracoes-kit`; `/ceu/fornecedores` redireciona |
| `06192a0`, `9751d64` | Fornecedores para mesa, dp2 e financeiro (`pode_gerenciar_fornecedores()`, ação `materiais.gerenciar_fornecedores`, menu/rota `materiais_fornecedores`) |
| `66dd823` | Edge Function `pedido-materiais`, tela pública `/pedido/:token` (`PedidoLiderPage.tsx`, roteada no `App.tsx` antes do login), `LinkPedidoDialog` (URL, QR com lib `uqr`, cartaz A4, revogar), `src/services/pedidoMateriaisApi.ts`, `scripts/sincronizar-pedido-materiais.mjs` |
| `4304b46` | Filas: `/materiais/pedidos`, `/materiais/pedidos/:id`, `/materiais/validacao`, `/materiais/painel`, `/materiais/sem-pedido`, pedido extra; `/ceu/pedidos` (Beth); migration 124 |

Checks no último commit: `tsc -b` ok, lint ok, **715 testes** ok, build ok.

**Banco (produção):** 121–124 aplicadas em 09/10/2026 via `scripts/lib/executar-sql-arquivo.ps1` (cada arquivo
embrulhado em `begin;…commit;`, chamado **in-process** com `& ./scripts/lib/executar-sql-arquivo.ps1 -Query $sql`
— chamar via `powershell -File` quebra com SQL grande). 17 tabelas novas, vazias; 4 fornecedores preservados;
`permissoes_perfil` 838 → 898 linhas. Backups: `dados-locais/backup_materiais_121_2026-10-09/`, `..._124_...`.
**Edge Function** `pedido-materiais` v1 publicada (smoke test: OPTIONS 200; token inválido → 404 "Link inválido…").

**Pontos de implementação a conhecer:**
- "Devolver ao líder" só registra comentário (não há devolução pelo link; inspetor liga).
- Identificação do nome digitado → colaborador: sugestão com score ≥ 0,55, gravada só ao clicar "Confirmar identificação".
- Teto de quantidade na tela pública: 10× o kit (mín. 10, máx. 999). Rascunho só no `localStorage` do aparelho.
- "Outros uniformes/EPIs" vão na observação final. Kit portaria vem de `mat_itens` categoria portaria (os 4 itens
  — Livro de Ocorrências, Protocolo, Planilha de Acessos, Planilha de Veículos — precisam ser cadastrados).
- Painel: contrato sem kit nunca aparece "acima do limite"; valor usa qtd aprovada → validada → pedida.
- Saldo da Beth = `itens.estoque` do CEU (mantido à mão; entregas não baixam). Não há lançamento automático de entregas (Fase 3).
- Risco conhecido: `CeuImportarPage` cria fornecedor — agora só perfis de `pode_gerenciar_fornecedores()` conseguem.

## 4. Dados iniciais (NÃO carregados)

Planilha de conferência: **`dados-locais/materiais_conferencia_2026-10-09.xlsx`** (abas Leia-me, Catálogo 116 itens,
Variações, Nomes antigos 254, Kit Mensal 562 linhas, Histórico 01/2025–06/2026 9.479 linhas, Fornecedores 13,
Pendências 39, Decisões 09-10). Scripts geradores ficaram no scratchpad da sessão (não versionados).
Pendências restantes (baixa prioridade): variações não informadas no kit (Flanela, Disco, Cera, Mop), 8 contratos
com kit vazio (Cartório, Carvalho Neto, CBO Macaé, CNOOC, Nise, Nutrindo Ideais, Solar das Oliveiras, Telex Sede),
3 quantidades em texto livre, nomes com confiança média. Histórico de 2022–2024 (8.827 linhas) fora, incluir se a gestão quiser.

## 5. Próximos passos

1. **Gestão confere a planilha e define os kits** (prevista semana de 12/10/2026).
2. **Carga dos dados** (catálogo, variações, aliases, fornecedores, contratos de pedido com rota, kits, histórico)
   — script de carga a partir da planilha conferida, com backup e dry-run.
3. **Redesenho da tela do líder** (decisão 2 acima) — só a tela pública muda; Edge Function pode precisar devolver
   a lista "primeiro nome + inicial" da equipe do contrato (reavaliar LGPD no relatório).
4. **Piloto** com 2–3 contratos, Google Forms em paralelo; só então merge em `main` e deploy (Netlify custa créditos — agrupar).
5. Fases 2 (compra por fornecedor/rota no formato da aba "Pedido ao Fornecedor por Cliente", estoque de materiais
   com contagem) e 3 (recibo único por contrato, lançamento no CEU, assinatura — reavaliar com link público).

## 6. Regras de trabalho com a usuária

- **Economizar créditos é prioridade** (memória `economizar-creditos-roteador`): tarefas de arquivo/código pela skill
  `roteador` (Jev escolhe Haiku/Sonnet/Opus); conversa direta. Reaproveitar subagentes com contexto (SendMessage) é mais barato.
- Explicar em linguagem simples; nada em produção sem autorização explícita (cada migration/deploy foi autorizado nesta sessão).
- Não versionar `docs/Pedido de material/` nem `dados-locais/` (dados pessoais).
