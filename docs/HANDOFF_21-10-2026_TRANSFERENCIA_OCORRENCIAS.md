# HANDOFF 21/10/2026 (noite) — Ocorrências: transferência de posto + aviso por e-mail

Sessão do módulo **Ocorrências** na cópia de trabalho da branch `materiais-multiplo` (a mesma do Materiais Fase 2 — o merge na `main` e o deploy ficam para depois, junto com ela; ver `HANDOFF_18-10-2026_FASE2.md` §"21/10 fim"). Decisões da gestora em 21/10/2026. **Sem migration** (gravidade já é coluna por ocorrência; `ocorrencias.tipo_ocorrencia` é texto livre). Regra completa também no AGENTS.md §11 ("Ocorrências — transferência com mudança de posto") e §8 ("Edge Function `aviso-transferencia`").

## 1. Transferência de Setor — gravidade editável + mudança de posto no cadastro

A gestora queria um tipo novo para transferências, mas **já existia "Transferência de Setor"** (grupo 8. Administrativas). Decisão: **não criar grupo novo**, ajustar o existente.

- **Gravidade editável só nesse tipo** (Leve/Moderada/Grave, padrão Leve) — a transferência pode nascer de recusa no posto, não é sempre leve. `permiteEscolherGravidade`/`GRAVIDADES_SELECIONAVEIS`/`TIPO_TRANSFERENCIA` em `src/lib/ocorrencias/tiposOcorrencia.ts`; seletor na caixa "Gravidade" do `TipoOcorrenciaSection` (demais tipos seguem somente leitura); o item do seletor de tipo NÃO mostra mais o sufixo "— Leve" na transferência.
- **Posto de destino obrigatório na criação** (não na edição): `DepartamentoAutocomplete` no bloco de transferência; "Posto atual" resolvido por `nomeCurtoDepartamentoFuzzy` (lista completa `select('id, nome, nome_curto, empresa_id, status')`, padrão documentado).
- **Descrição preenchida sozinha**: `preencherOrigemDestino` troca `[SETOR ORIGEM]`/`[SETOR DESTINO]` (nome vazio mantém o placeholder). Texto-modelo reestruturado em linhas: "Data da transferência:", "Motivo:", "Novo horário de trabalho:", "A quem procurar no novo posto:" (pedido da gestora — facilita o documento entregue ao colaborador). PDF da ocorrência **já tem** "Assinatura do Colaborador" + RH + testemunhas (`src/lib/pdf.ts`) — confirmado à gestora.
- **ConfirmDialog com 3 caminhos** (padrão do "encerrar vínculo" dos Adicionais): "Salvar e atualizar cadastro" grava a ocorrência e faz UPDATE de `colaboradores.departamento_id` (só o ID; texto legado vira histórico; `.select('id')` anti-falso-sucesso); "Salvar sem atualizar" grava só a ocorrência; Cancelar fecha. Descrição do dialog em blocos (`break-words`) — nome longo parecia cortado na primeira versão inline.
- **Ressalva sincronização (aviso no próprio dialog)**: o sync do e-Contador (de madrugada) honra a Alterdata — se o DP não atualizar a lotação lá no mesmo dia, o posto volta ao antigo no sync e se autocorrige no sync seguinte à atualização. Vínculos/escala ficam no Flit/Alterdata, fora do CORH. Discussão registrada: mudança manual pontual OK; não banalizar; se virar rotina, pensar em trava no sync (bloqueada pelo freeze do deploy da `sync-econtador` até Férias ser liberado).

## 2. Aviso por e-mail ao mesário e DP (carta emitida)

- **Edge Function `aviso-transferencia`** (`supabase/functions/aviso-transferencia/index.ts`) — **DEPLOYADA em 21/10/2026 (v2, verify_jwt: true)** pela gestora: `powershell scripts/lib/implantar-edge-function.ps1 -Slug aviso-transferencia -Arquivo supabase/functions/aviso-transferencia/index.ts -VerifyJwt 1`. ⚠️ **Usar `-VerifyJwt 1`, não `$true`** — o `$true` se perde ao colar no PowerShell e o parâmetro booleano falha (AGENTS.md §8 corrigido).
- Destinatários: `perfis.email` de **mesa, dp1, dp2** via service role (hoje: maciel@plenaserv.com, dp@plenafacilities.com.br, elizabeth@plenafacilities.com.br — conferido). Auth: JWT + perfil emissor = quem cria ocorrência. CORS padrão `suporte`. Secret: a mesma `RESEND_API_KEY` do suporte.
- Disparo em `useOcorrenciaForm.salvar` **nos dois caminhos do dialog**, best-effort: sucesso → toast "Aviso enviado por e-mail ao DP e à mesa."; falha → toast amarelo (nunca bloqueia a gravação). Cliente: `src/services/avisoTransferenciaApi.ts`; lógica pura com testes: `src/lib/ocorrencias/avisoTransferencia.ts`.

## 3. PENDENTE — Resend sandbox: o e-mail NÃO chega ainda

Teste em produção confirmou: function OK, destinatários OK, mas o remetente de testes **`onboarding@resend.dev` só entrega para o dono da conta Resend** (`financeiroplenaserv@gmail.com`) — o Resend recusa os demais (toast amarelo confirmado no teste da MARIA). **Solução:** verificar o domínio `plenafacilities.com.br` no painel do Resend (registros DNS DKIM/SPF) e trocar `EMAIL_REMETENTE` para `corh@plenafacilities.com.br` + redeploy da function. **NÃO precisa criar caixa de e-mail real** — o endereço é só de envio (decidido com a gestora em 21/10; caixa real só se quiserem receber respostas). Depois do domínio: repetir o teste ponta a ponta.

## 4. Limpeza dos testes (feito em 21/10)

3 ocorrências de teste excluídas pelo fluxo assistido (status → Cancelada + RPC `excluir_ocorrencia_admin`, JWT do admin emulado via `set_config('request.jwt.claims', ...)` na Management API — o script `executar-sql-management-api.ps1` roda sem JWT): LEANDRO `6017ffc1-…` (transferência, 16:57), JOAO `097b3dbf-…` (Promoção, 18:01 — salva como tipo errado no teste), MARIA `14598182-…` (transferência, 18:16 — a que confirmou o sandbox do Resend). Arquivadas em `ocorrencias_excluidas_log`. **Nenhum cadastro foi alterado nos testes** (0 UPDATE em `colaboradores`; JOAO segue QUATRE).

## 5. Estado e próximos passos

- Testes: 45 em `src/lib/ocorrencias` (6 novos de `avisoTransferencia.test.ts`); suíte completa **1.206 passando**; `npm run build` ok; ESLint limpo nos arquivos tocados (o `npm run lint` geral está quebrado no ambiente por causa dos worktrees de outros agentes em `.claude/worktrees/` — não apagar, um está locked/em uso).
- **Pendências na ordem:** (1) verificar domínio no Resend + trocar remetente + redeploy da function + teste do e-mail; (2) deploy do frontend — junto com o Materiais, pelo checklist do AGENTS §10 (merge na `main` limpa, `MODULO_FERIAS_LIBERADO = false`, conferir hash do bundle pós-deploy); (3) opcional: destacar no histórico do sync quando ele mudar o posto de alguém (visibilidade da reversão — ideia discutida, não aprovada).
