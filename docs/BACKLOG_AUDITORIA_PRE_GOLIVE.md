# Backlog da Auditoria Pré-Go-Live (18/07/2026)

> Auditoria executada com 4 agentes (segurança de banco, segurança de frontend, performance, qualidade).
> Legenda: ✅ feito · 🔶 parcial · ⬜ pendente

## LEVA 1 — Críticos de segurança (FEITA nesta rodada)

| # | Item | Status |
|---|------|--------|
| C1 | Escalonamento a admin via `perfis` (policies órfãs 042 + self-update sem trava) | ✅ migration 064: drops + trigger `proteger_campos_sensiveis_perfil` + self-INSERT só `visualizador` |
| C2 | `calendario_adicionais` com CRUD aberto (policies 003/037) | ✅ migration 064: policies restritas + drop da aberta da 037 |
| C3 | Suíte de testes vermelha (validador RLS desatualizado) | ✅ `scripts/validar_rls.py` alinhado à 063/064 |
| C4 | Policy aberta da 037 em `departamentos` anulava a 063 | ✅ drop incluído na migration 064 |
| C5 | `/colaboradores` sem `ProtectedRoute` + CPF completo | ✅ wrapper adicionado; `mascararCPF` para quem não tem `editar_completo` |
| C6 | `/mobile/falta` fora do `<Suspense>` | ✅ corrigido no `App.tsx` |
| C7 | Cache de permissões não limpo no logout | ✅ `setPermissoesCache([])` no logout e na troca de sessão |
| — | Bloco CEU na tela Permissões (pedido do usuário) | ✅ 9 ações em `PERMISSOES_CONFIG` + funções `pode*` + seed na 064 + guardas nas páginas CEU |

**Pendente do usuário:** aplicar `supabase/migrations/064_seguranca_perfis_calendario_ceu.sql` no SQL Editor (instruções em `docs/APLICAR_MIGRATION_064.md`).

## LEVA 2 — Altos (FEITA nesta rodada)

| # | Item | Status |
|---|------|--------|
| A1 | Tela Permissões mostrava "desmarcado" enquanto fallbacks concediam acesso | ✅ mapa único `PERMISSOES_PADRAO` em `permissoes.ts`; tela exibe o valor efetivo real e o toggle não apaga mais os fallbacks ao salvar |
| A2 | SELECT aberto em `locais_trabalho*` e `mapeamento_flit_*` (localização diária — LGPD) | ✅ migration 065 (`pode_ver_escalas`) |
| A3 | SELECT aberto em `itens`, `fornecedores`, `entregas`, `alertas`, `modelos_ocorrencia` | ✅ migration 065 (`pode_ver_ceu`, `pode_ver_alertas`) |
| A4 | Perfil `rh` lia `econtador_token` | ✅ migration 065 (policy única com `is_admin_ou_dp`) |
| A5 | Importação de colaboradores zerava CPF/RG/datas em reimportação parcial | ✅ `limparRegistroParaUpsert` (payload sem vazios) + validações + testes |
| A6 | Rotas de escrita com permissão de leitura; páginas sem verificação `pode*` | ✅ rota `/rh/importar` corrigida; guards em `ColaboradorFormPage` e `ImportarPage` |
| A7 | Falha ao carregar permissões degrada para fallbacks | 🔶 comportamento mantido por decisão (disponibilidade); a tela passou a mostrar o valor efetivo, eliminando a confusão |
| A8 | Entrega CEU com falso sucesso; edição de item CEU apagava valor | ✅ `criarLote` atômico + input de moeda com máscara + navegação só após sucesso |
| A9 | Falha no PDF de ocorrência travava tela e induzia duplicidade | ✅ try/catch no PDF + navegação garantida |
| — | Extras da rodada: dialogs Departamentos/Empresas só fecham em sucesso; validação de CPF no cadastro de colaborador | ✅ |

**Pendente do usuário:** aplicar `supabase/migrations/065_rls_escalas_ceu_alertas_modelos.sql` no SQL Editor (instruções em `docs/APLICAR_MIGRATION_065.md`).

## LEVA 3 — Médios

| # | Item | Origem |
|---|------|--------|
| M1 | `salvarLote` VR: delete-total + insert sem transação (risco de perda total) | Qualidade M2 |
| M2 | Assinar recibo + marcar Pago não atômicos; exclusão de recibo assinado não reverte extras | Qualidade M3/M4 |
| M3 | Arquivo VR PAT gera crédito (Tipo 60) para CPF sem beneficiário (Tipo 30) | Qualidade M1 |
| M4 | Dialogs Departamentos/Empresas fecham como "salvo" mesmo quando o save falha | Qualidade M5 |
| M5 | CNPJ sem máscara/validação (Empresas, VR); CPF sem validação no cadastro de colaborador | Qualidade M6/M7 |
| M6 | Duplicidade de extras contornável sem departamento; valor R$ 0,00 aceito; VR aceita negativos | Qualidade M8/M9 |
| M7 | Remoção de anexos/testemunhas sem confirmação; deletes diretos em Locais/Mapeamento/Calendário | Qualidade M10/B7 |
| M8 | Auditoria por triggers não cobre `departamentos`, `empresas`, CEU, adicionais | Qualidade M11 |
| M9 | Consentimento LGPD sem valor probatório (self-update) — mover para RPC server-side | Frontend #7 |
| M10 | `plena_perfil` em localStorage: escrito, nunca lido — remover | Frontend #9 |
| M11 | Divergências matriz × RLS fail-closed (financeiro/inspetoria/visualizador) — alinhar e documentar fonte única | Banco #9 |

## LEVA 4 — Performance

| # | Item | Origem |
|---|------|--------|
| P1 | Service worker precacheia 5,2 MB (chunks lazy + imagens de marketing) — restringir `globPatterns`/`globIgnores` | Perf #1 |
| P2 | `AbaEscalasDiario` sem paginação — trunca no limite de 1000 linhas do PostgREST | Perf #2 |
| P3 | `useColaboradores.listar` (32 colunas, sem paginação) usado em 14 telas só para dropdown — criar `listarResumido()` | Perf #3 |
| P4 | OcorrenciasPage dispara listagem 3× no mount; Dashboard baixa tabelas inteiras para 4 números | Perf #4/#5 |
| P5 | Perfil+permissões carregados 2× no boot (getSession + INITIAL_SESSION) | Perf #7 |
| P6 | Geração de alertas varre o banco no cliente; writes sequenciais em loop (CEU entrega, ImportarPonto) | Perf #8/#9 |
| P7 | Logo 131 KB na tela de login (redimensionar/WebP) | Perf #11 |

## Baixos registrados (sem urgência)

- Funções SECURITY DEFINER sem `SET search_path` (higiene; não exploráveis hoje)
- Código morto: `recuperarSenha` aponta para rota inexistente; `signUp` sem UI
- VR: defaults silenciosos em arquivo oficial (data 01012000, nascimento 01011990, sexo fixo)
- Deletes sem checar `error` em ModelosPage; e-mails sem validação HTML5 em Departamentos

## Verificado e OK (não exige ação)

- Storage: buckets privados, policies por perfil, URLs assinadas 15 min
- Edge Function e-Contador: JWT validado, perfil server-side, rate limit, token AES-GCM só na Edge
- Nenhuma tabela do app sem RLS habilitado; sem policies para `anon`; sem `service_role` no cliente
- Cálculos de dinheiro em centavos (sem erro de float); validador RLS verde; 117 testes passando
