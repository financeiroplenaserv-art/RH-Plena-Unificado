# Relatório de Auditoria de Integração — e-Contador Alterdata

**Projeto:** RH Plena Unificado  
**Repositório:** `c:\Projetos\RH-Plena-Unificado`  
**Data da análise:** 2026-06-25  
**Escopo:** Integração com API Alterdata e-Contador (`dp.pack.alterdata.com.br/api/v1`)

---

## Resumo Executivo

A integração com o e-Contador Alterdata é o **principal datasource** do sistema: empresas, departamentos e colaboradores são sincronizados a partir dela. A implementação funciona para o "caminho feliz", mas carece de qualidade operacional. Há riscos graves de **duplicatas**, **falhas silenciosas**, **timeout em grandes volumes** e **exposição do token JWT no frontend**. A robustez atual é insuficiente para basear todo o RH Plena Unificado nessa integração sem revisão manual constante.

---

## Nota Geral de Robustez

**Nota: 4,5 / 10**

A integração atende ao caminho feliz, tem proteção básica do token e histórico de importações, mas **carece de qualidade operacional** para ser considerada base confiável do sistema:
- Sem constraints de unicidade → duplicatas prováveis.
- Sem timeout/retry → falhas silenciosas e travamentos.
- Sem batching → impraticável para 5.000 registros.
- Sem guarda de rota → permissão inconsistente.

Com as correções P0/P1 implementadas, a nota sobe para **7,5/8**.

---

## Achados Críticos

| # | Problema | Onde | Impacto |
|---|----------|------|---------|
| 1 | **Token JWT exposto no frontend** | `src/services/econtadorApi.ts` linhas 5, 12–39 | Qualquer usuário autenticado pode ver o token no DevTools e fazer requisições à Alterdata em nome da empresa. |
| 2 | **Rota `/importar/econtador` desprotegida** | `src/App.tsx` linha 195 | Usuários `visualizador` e `gestor` podem acessar a tela e disparar importações. |
| 3 | **Token armazenado em texto plano** | `supabase/migrations/015_rls_token_econtador_e_departamentos.sql`, `src/services/econtadorApi.ts:21-30` | Vazamento total caso o banco seja comprometido ou alguém com acesso à tabela `configuracoes` copie o valor. |
| 4 | **Sem constraints de unicidade em colaboradores** | `src/hooks/useColaboradores.ts`, tabela `colaboradores` | Mesma matrícula/CPF pode gerar múltiplos registros se a API Alterdata enviar duplicatas ou se houver reprocessamento. |
| 5 | **Sem timeout configurado nas requisições fetch** | `src/services/econtadorApi.ts` | Requisição pode ficar pendente indefinidamente, travando a UI. |
| 6 | **Sem retry nem circuit breaker** | `src/services/econtadorApi.ts`, `src/hooks/useEContador.ts` | Falhas temporárias da API causam falha total da importação sem possibilidade de retomada. |
| 7 | **Criação automática de empresa sem validação** | `src/hooks/useEContador.ts` | Empresa com nome similar pode ser criada duplicada ou com dados incorretos. |

---

## Achados Altos

| # | Problema | Onde | Impacto |
|---|----------|------|---------|
| 8 | **Filtro "plena ea" / "plena tech" pode falhar** | `src/hooks/useEContador.ts` | Case sensitive ou problemas com acentos podem excluir empresas válidas. |
| 9 | **5.000 registros paginados sem batching/streaming** | `src/hooks/useEContador.ts` | Carregamento síncrono de grande volume consome memória do navegador e pode estourar limite do Supabase/cliente. |
| 10 | **Mapeamento de status sem tratamento de edge cases** | `src/hooks/useEContador.ts` | Afastamentos com data retroativa, demissão sem data, férias parciais podem ser classificados incorretamente. |
| 11 | **Histórico de importações permite DELETE/UPDATE pelo próprio usuário** | `supabase/migrations/010_rls_tabelas_negocio.sql:125-135` | Usuário pode apagar rastro de importações. |
| 12 | **Não há validação do token antes de salvar** | `src/pages/ConfiguracoesPage.tsx:16-22` | Token inválido é salvo e só falha na próxima importação. |

---

## Achados Médios

| # | Problema | Onde |
|---|----------|------|
| 13 | **Sincronização manual — não há agendamento** | `src/pages/ImportarEContadorPage.tsx` |
| 14 | **Sem cache local de dados mestres** | `src/hooks/useEContador.ts` |
| 15 | **Logs de erro apenas no console** | `src/hooks/useEContador.ts` |
| 16 | **Não há fallback se a API Alterdata ficar indisponível** | Todo o fluxo de importação |
| 17 | **Matching de departamentos por nome puro** | `src/hooks/useEContador.ts` |

---

## Recomendações Práticas

### Imediatas (P0)

1. **Mover toda a comunicação com a Alterdata para Edge Function do Supabase.**
   - O frontend chama `/functions/v1/econtador`.
   - A Edge Function consulta o token criptografado no banco e faz as requisições à API Alterdata.
   - O token nunca transita no frontend.

2. **Proteger a rota `/importar/econtador`.**
   - Exigir `admin` ou `rh` no `ProtectedRoute`.

3. **Criptografar o token no banco.**
   - Usar `pgcrypto` ou criptografia na Edge Function.
   - Logar toda consulta/alteração do token.

4. **Adicionar constraints de unicidade.**
   - `colaboradores(matricula, empresa_id)` ou `colaboradores(cpf)`.
   - `empresas(cnpj)`.
   - `departamentos(nome_curto)` ou identificador externo.

5. **Adicionar timeout e retry nas requisições.**
   - Timeout de 10-15 segundos.
   - Retry exponencial (máx. 3 tentativas).

### Curtas (P1)

6. **Implementar importação em lotes (batching).**
   - Processar 100-200 registros por vez.
   - Mostrar progresso na UI.

7. **Criar fila de retry para falhas parciais.**
   - Tabela `fila_importacao_econtador` para registros que falharam.

8. **Melhorar matching de departamentos.**
   - Usar código/id externo da Alterdata quando disponível.
   - Normalizar nome (lowercase, remover acentos) antes de comparar.

9. **Validar token antes de salvar.**
   - Fazer uma chamada de teste à API Alterdata ao salvar.

### Longas (P2/P3)

10. **Sincronização agendada.**
    - Cron no Supabase ou Edge Function schedule para manter dados mestres atualizados automaticamente.

11. **Circuit breaker para a API externa.**
    - Evitar sobrecarga quando a API estiver instável.

12. **Cache de dados mestres.**
    - Cache controlado com TTL para reduzir chamadas à API Alterdata.

---

*Documento gerado em: 2026-06-25*
