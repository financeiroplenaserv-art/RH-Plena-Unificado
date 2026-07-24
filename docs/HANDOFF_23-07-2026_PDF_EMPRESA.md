# HANDOFF — PDF de ocorrência com empresa errada (Plena EA x Plena Tech)

> **Data:** 23/07/2026 (noite, fim de sessão)
> **Status:** ✅ **RESOLVIDO em 24/07/2026.** Confirmado: era o service worker do PWA servindo JS antigo. Adicionado `skipWaiting()` em `src/sw.ts` (ativações futuras são automáticas) e marcador de build no rodapé do PDF (`build 2026-07-24`). Também corrigido o CPF do colaborador que não saía no PDF gerado após "Nova ocorrência" (`COLUNAS_AUTOCOMPLETE` sem a coluna `cpf`). Validado pela usuária em produção: logo, nome/CNPJ da empresa (Plena EA e Plena Tech) e CPF corretos.
> **Usuária:** cansada, parou no fim do dia. Retomar com calma e sem pedir muitos SQLs de uma vez.

---

## 1. O que a usuária quer

No PDF "REGISTRO DE OCORRÊNCIA" (gerado nas telas de ocorrências/colaborador):

1. Logo correta: **Plena 30 anos** (`public/logo_plena_30anos_redonda.png`). ✅ Resolvido.
2. Cabeçalho com **nome e CNPJ reais da empresa** da ocorrência. ❌ Ainda sai "Plena EA / CNPJ 00.378.476/0001-60" nos testes dela (último print: Ref `DA91A7B0`, colaboradora Graciane — deveria sair **Plena Tech / 41.299.487/0001-32**).

## 2. Estado CONFIRMADO do banco (não mexer)

- Empresas: **Plena EA** = `fe2f1e37-3915-4801-a2a4-179268a56fa2` (CNPJ 00.378.476/0001-60); **Plena Tech** = `c37b5720-259a-4ce4-a364-87421dcdffa7` (CNPJ 41.299.487/0001-32).
- Graciane: colaborador `6e605bac-7638-464d-924c-9cbc494c94a0`, matrícula `000007`, `empresa_id` = Plena Tech, departamento texto "PLENA TECH ADMINISTRATIVO", `departamento_id` NULL. **Sem ficha duplicada.**
- Ocorrência real dela (`90521a0d-...`): `empresa_id` = Plena Tech. ✅
- Contagem de ocorrências por empresa (fim da sessão): **Plena EA 9.175 / Plena Tech 58**. Correto.
- Placeholder "OCORRENCIAS HISTORICAS – NAO IDENTIFICADO" (matrícula `999999`): `empresa_id` = **NULL** (zerado nesta sessão de propósito). Suas ~5.033 históricas ficam como Plena EA (estado da importação; decisão da gestão: são só histórico, não corrigir empresa).
- Ocorrências de teste criadas pela usuária ("dddd", "gggg", Refs `81A0EC78`, `25A4EDC6`, `DA91A7B0` etc.) ficaram com `empresa_id` NULL — podem ser apagadas ou corrigidas com o UPDATE do §6.

## 3. Correções de código já no GitHub (main)

| Commit | O quê |
|---|---|
| `4f8179b` | Logo Plena 30 anos no PDF; `gerarPDFOcorrencia` busca empresa quando a tela não informa |
| `8b7c6c2` | Fallback Plena EA quando não há vínculo nenhum |
| `c0a06cf` | Cadeia: ocorrência → colaborador → departamento (id/nome) → Plena EA |
| `675b1c9` | **Causa raiz:** `COLUNAS_AUTOCOMPLETE` em `src/components/AutocompleteColaborador.tsx` não trazia `empresa_id` → ocorrências novas salvas com empresa NULL e PDF caía no fallback. Corrigido; `buscarEmpresaDoRegistro` (`src/lib/pdf.ts`) agora consulta o cadastro do colaborador no banco se o objeto vier sem `empresa_id` |

Com esses commits, **nenhum caminho de código deveria produzir Plena EA para a Graciane**. O PDF dela saindo Plena EA indica que o navegador dela ainda executa build antigo.

## 4. Hipótese principal: PWA segurando JS antigo

- `vite.config.ts`: `registerType: 'autoUpdate'`, `injectManifest`, `devOptions.enabled: false` (sem SW no dev). `src/sw.ts` tem `clientsClaim()` mas **não tem `skipWaiting()`** → no Netlify, o SW novo só ativa quando TODAS as abas do app fecham.
- A logo nova aparecia nos prints porque o PNG é baixado em runtime; o JS precacheado continua velho.
- A usuária testou em `localhost:5173` e possivelmente no Netlify. Não está confirmado se ela concluiu o procedimento de unregister/clear storage.

## 5. Próximos passos (em ordem)

1. **Confirmar qual build roda no navegador dela.** Opção rápida e definitiva: adicionar marcador de versão no rodapé do PDF (ex.: `doc.text('build 2026-07-24-1', ...)` em `gerarPDFOcorrencia`), push, esperar deploy do Netlify (~2 min), pedir Ctrl+Shift+R e gerar PDF. Se o marcador não aparecer → é cache/SW; instruir: F12 → Application → Service Workers → Unregister → Storage → Clear site data → fechar todas as abas → reabrir.
2. Se o marcador **aparecer** e ainda sair Plena EA: investigar de verdade o runtime — colocar `console.warn` temporário em `buscarEmpresaDoRegistro` mostrando cada etapa (empresaId encontrado, resultado de `empresaPorId`), reproduzir pela mesma tela que ela usa e ler o console.
3. Verificar com ela **de qual tela** gera o PDF (ficha do colaborador, detalhe da ocorrência ou logo após salvar nova) e **se está logada com o perfil admin** (RLS de `empresas` exige `pode_ver_empresas()`; se o perfil dela não estiver na lista, `empresaPorId` retorna null e cai no fallback — mas nesse caso o fallback também falharia e sairia `[EMPRESA]`, não Plena EA; ainda assim, verificar).
4. Considerar adicionar `skipWaiting()` em `src/sw.ts` para o SW novo ativar sem depender de fechar abas (decisão técnica; avaliar impacto em sessões abertas).

## 6. SQLs úteis (rodar no SQL Editor do Supabase)

Limpeza opcional das ocorrências com empresa NULL (seguro: só preenche vazio, exclui placeholder):

```sql
update ocorrencias o
set empresa_id = c.empresa_id
from colaboradores c
where o.colaborador_id = c.id
  and o.empresa_id is null
  and c.empresa_id is not null
  and c.matricula <> '999999';
```

Inspeção de uma ocorrência pelo Ref (8 primeiros caracteres do id):

```sql
select o.id, o.titulo, e.nome as empresa_na_ocorrencia, c.matricula, ec.nome as empresa_do_colaborador
from ocorrencias o
join colaboradores c on c.id = o.colaborador_id
left join empresas e on e.id = o.empresa_id
left join empresas ec on ec.id = c.empresa_id
where o.id::text like 'da91a7b0%';
```

## 7. Lições aprendidas nesta sessão (não repetir)

- **Nunca** rodar UPDATE em lote alinhando ocorrência à empresa do colaborador sem excluir `matricula = '999999'` (placeholder). Aconteceu nesta sessão e foi revertido (5.033 históricas).
- O SQL Editor do Supabase só mostra o resultado da **última** query do script — pedir uma query por vez à usuária.
- `npm run lint` e `npm run build` passam em todos os commits acima.

## 8. Outros pendestes conhecidos (não urgentes)

- Apagar as ocorrências de teste ("dddd...", "gggg...", etc.) pelo sistema.
- `departamento_id` da Graciane é NULL (só tem o texto); não existe departamento "PLENA TECH ADMINISTRATIVO" confirmado com empresa vinculada — se for criado, o fallback por departamento melhora.
- Demais pendências: ver `docs/CONTINUAR_AQUI.md`.
