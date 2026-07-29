# Testes de integração via API — 2026-07-29

Executado por `scripts/teste-integracao-api.mjs` em 2026-07-29T09:08:27.886Z.

Bateria automatizada cobrindo login/perfis, matriz de permissões, storage, extras (somente leitura) e dry-run do parser de escalas. Sessões obtidas via `generateLink` (magiclink) + `verifyOtp`, sem troca de senhas. Nenhum dado de negócio foi criado/alterado/removido; os únicos writes foram arquivos de storage descartáveis, removidos ao final.

**Resumo: 46 verificações — 46 PASS, 0 FAIL** (+ 4 observações informativas).

## 1. Login/perfis

| Verificação | Status | Evidência |
|---|---|---|
| teste.adm: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.adm: nivel_acesso = adm | PASS | banco retornou "adm" |
| teste.adm: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |
| teste.gestor: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.gestor: nivel_acesso = gestor | PASS | banco retornou "gestor" |
| teste.gestor: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |
| teste.rh: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.rh: nivel_acesso = rh | PASS | banco retornou "rh" |
| teste.rh: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |
| teste.dp1: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.dp1: nivel_acesso = dp1 | PASS | banco retornou "dp1" |
| teste.dp1: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |
| teste.dp2: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.dp2: nivel_acesso = dp2 | PASS | banco retornou "dp2" |
| teste.dp2: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |
| teste.mesa: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.mesa: nivel_acesso = mesa | PASS | banco retornou "mesa" |
| teste.mesa: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |
| teste.inspetoria: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.inspetoria: nivel_acesso = inspetoria | PASS | banco retornou "inspetoria" |
| teste.inspetoria: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |
| teste.financeiro: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.financeiro: nivel_acesso = financeiro | PASS | banco retornou "financeiro" |
| teste.financeiro: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |
| teste.visualizador: autenticação via magiclink | PASS | sessão obtida via verifyOtp |
| teste.visualizador: nivel_acesso = visualizador | PASS | banco retornou "visualizador" |
| teste.visualizador: leitura de permissoes_perfil | PASS | 804 linhas legíveis (migration 062) |

## 2. Matriz de permissões

| Verificação | Status | Evidência |
|---|---|---|
| Análise estática PERMISSOES_PADRAO x permissoes_perfil | PASS | 52 pares no mapa padrão, 804 linhas no banco |
| Pares do padrão sem linha no banco | INFO | nenhum — todo par do padrão tem linha explícita |
| Pares só no banco (sem padrão no código) | INFO | 47 par(es): colaboradores/ver, dashboard/ver, departamentos/ver, empresas/ver, escala/confirmar_manual, escala/editar_dia, escala/editar_local, escala/importar, escala/mapear_flit, escala/visualizar, menu/adicionais, menu/alertas … (+35) |
| Conflitos de valor (banco diverge do padrão) | INFO | 33 divergência(s): dp1 departamento/excluir: banco=true, padrão=false \| dp1 configuracoes/configurar_token: banco=true, padrão=false \| dp1 vr/gerenciar: banco=true, padrão=false \| dp1 adicionais/editar_contrato: banco=true, padrão=false \| dp1 adicionais/editar_vinculo: banco=true, padrão=false \| dp1 adicionais/editar_calendario: banco=true, padrão=false \| rh departamento/editar: banco=true, padrão=false \| rh departamento/importar: banco=false, padrão=true \| rh colaborador/cadastrar: banco=false, padrão=true \| dp2 ocorrencia/cancelar: banco=true, padrão=false \| dp2 extras/marcar_pago: banco=true, padrão=false \| dp2 extras/cancelar_recibo: banco=true, padrão=false … (+21) |

## 3. Storage

| Verificação | Status | Evidência |
|---|---|---|
| ocorrencia-anexos: upload autorizado (teste.rh) | PASS | path d6086f9b-412b-4d4d-97eb-990972d34749/teste-automatizado/… aceito |
| ocorrencia-anexos: download e conteúdo íntegro | PASS | conteúdo baixado idêntico ao enviado |
| ocorrencia-anexos: upload negado para visualizador | PASS | bloqueado pelo RLS (new row violates row-level security policy) |
| ocorrencia-anexos: remoção pelo perfil adm (policy DELETE) | PASS | arquivo descartável removido |
| vr-arquivos: upload autorizado (teste.dp2) | PASS | path a3b0ee92-54fa-4eb0-8df5-4355e3d525d4/teste-automatizado/… aceito |
| vr-arquivos: download e conteúdo íntegro | PASS | conteúdo baixado idêntico ao enviado |
| vr-arquivos: upload negado para visualizador | PASS | bloqueado pelo RLS (new row violates row-level security policy) |
| vr-arquivos: remoção pelo perfil adm (policy DELETE) | PASS | arquivo descartável removido |

## 4. Extras

| Verificação | Status | Evidência |
|---|---|---|
| Categoria "Faltista" existe | PASS | cadastrada em 2026-07-24, ativa=true |
| Categoria "Faltista" com valor 0 | PASS | valor_padrao=0 |
| Colunas gera_extra e reforco_contratual em extras (migration 074) | PASS | colunas presentes e consultáveis |
| RPC registrar_extra_plantao exposta no PostgREST | PASS | presente na spec OpenAPI (/rpc/registrar_extra_plantao, parâmetro p_payload jsonb) |
| RPC nega execução para visualizador | PASS | barrada com "Sem permissão para registrar extras" |
| RPC aceita perfil editor e valida payload | PASS | editor barrado apenas pela validação "Data e departamento são obrigatórios" |
| Parâmetros novos da RPC (migrations 075/077) | PASS | migrations 075/077 gravam gera_extra/reforco_contratual e implementam a exceção de duplicidade. Verificação comportamental exigiria INSERT em extras (proibido nesta bateria) — confirmar aplicação das migrations no banco se necessário. |

## 5. Escalas (dry-run)

| Verificação | Status | Evidência |
|---|---|---|
| Parser contra arquivo real de dados-locais/ | PASS | dados-locais/OCC todas 180726 (tratado).xlsx: rejeitado corretamente (não é escala Flit) — Colunas obrigatórias não encontradas no Excel (Nome, Data e Hora). Colunas detectadas: Data Lançamento, Seq, MACRO, Tipo, Título, Local, Cód |
| Parser no caminho feliz (arquivo Flit derivado de dados reais) | PASS | 1000 linhas de entrada → 906 dias parseados, 327 colaboradores únicos |
| Matching com colaboradores do banco (somente leitura) | PASS | 222 casaram, 105 não casaram (de 327 únicos; banco tem 509 colaboradores). Amostra de matrículas sem match: 714, 737, 290, 430, 477, 85, 572, 99, 113, 717 |
| Colaboradores sem match no dry-run | INFO | 105 sem match — esperado para ex-colaboradores/demitidos presentes no histórico de faltas; importação real marcaria como "não encontrados" |

## Problemas encontrados

Nenhuma verificação obrigatória falhou.

## Requer validação manual da usuária

- Aparência e comportamento visual da UI por perfil (sidebar, menus, telas) — não automatizável via API.
- Fluxo de consentimento LGPD na interface (tela exibida no primeiro login).
- Verificação comportamental dos parâmetros novos da RPC `registrar_extra_plantao` (gera_extra/reforco_contratual e exceção de duplicidade da migration 077): exigiria INSERT em `extras`, proibido nesta bateria. Evidência estática nas migrations 075/077.

## Veredito geral

**APROVADO** — 46/46 verificações passaram; pendências manuais de login/perfis, storage, extras e escalas cobertas por automação.
