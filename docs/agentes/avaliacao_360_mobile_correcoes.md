# Avaliação 360° — Mobile, Recibos e Permissões

**Data:** 2026-06-25  
**Autor:** Engenharia Frontend — Avaliação Técnica  
**Escopo:** `MobileFaltaPage.tsx`, `App.tsx` (/mobile/falta), `EmpresasPage.tsx`, `ExtrasRecibosPage.tsx`, `AssinaturaCanvas.tsx`, `lib/permissoes.ts`  
**Mandato:** Apenas leitura/análise. Nenhum arquivo de produção foi alterado.

---

## 1. Resumo das mudanças

### 1.1 `src/pages/extras/MobileFaltaPage.tsx` — refatoração mobile
- **UX repaginada:** formulário passou a usar um wizard de 5 passos com indicadores visuais, botões maiores (`h-16`, `text-lg/xl`), cards arredondados e componente `BotaoOpcao` para turno, tipo de extra e meio de comunicação.
- **Campos reordenados:** categoria genérica foi removida da tela e hard-coded como `'Operacional'` no payload; motivo foi promovido ao passo 1.
- **Melhorias de validação:** passo 1 agora exige data, departamento e motivo; passo 2 exige ausente ou "Não se aplica" + substituto; passo 3 exige valor > 0.
- **Defaults mais seguros:** `"Não se aplica"` é o valor inicial do colaborador ausente; data padrão é `hoje`; categoria de valor default é `"acordado"`.
- **Feedback pós-salvamento:** tela de sucesso com ações "Novo registro" e "Ver lançamentos".

### 1.2 `src/App.tsx` — rota `/mobile/falta`
- A rota `/mobile/falta` permanece **fora do layout desktop** (sem sidebar/header), renderizando `MobileFaltaPage` dentro de `ProtectedRoute` restrito a `['admin','adm','mesa','inspetoria']`.
- Não houve alteração no diff de hoje; a rota já existia assim.

### 1.3 `src/pages/EmpresasPage.tsx` — correção do botão cadastrar
- Adicionado `useAuth` + funções de permissão `podeEditarEmpresa` / `podeExcluirEmpresa`.
- Formulário de cadastro/edição e botões de ação da tabela agora respeitam RBAC.
- `handleSubmit` tornou-se resiliente a erros (`try/catch` + `toast.error`).
- Botão "Cadastrar/Atualizar" recebeu `onClick={handleSubmit}` além de `type="submit"`.

### 1.4 `src/pages/extras/ExtrasRecibosPage.tsx` — correção "marcar como pago"
- **Compliance reforçado:** antes de marcar extras como `Pago`, o sistema agora exige um recibo `assinado` (digital ou em papel) para o mesmo colaborador no mesmo período.
- Adicionado uso de `useAuth` e helpers `podeGerenciarReciboExtra`, `podeMarcarExtraComoPago`, `podeCancelarReciboExtra`.
- Removido CNPJ/empresa hard-coded `"Plena EA Facilities"`; o select de empresa agora lista dinamicamente.
- Ícone de "marcar como pago" alterado de `Pencil` para `DollarSign`.
- Assinatura em modo papel agora grava `data_assinatura` e repassa para o gerador de PDF.

### 1.5 `src/components/extras/AssinaturaCanvas.tsx` — cor da assinatura
- `strokeStyle` alterado de `#1F2937` (cinza escuro) para `#000000` (preto).
- `lineWidth` aumentado de `2.5` para `3`.

### 1.6 `src/lib/permissoes.ts`
- **Não houve mudança hoje** no arquivo em si; as funções já existiam e passaram a ser consumidas pelas páginas acima.

---

## 2. Pontos fortes

1. **RBAC está evoluindo corretamente.** Empresas e recibos agora consultam `useAuth` e `lib/permissoes` antes de expor ações críticas. Isso reduz superfície de ataque e evita erros de ação acidental por perfis sem poder.
2. **Correção de compliance nos recibos.** A exigência de recibo assinado antes do pagamento é uma guarda importante contra pagamento sem prova — exigência típica de auditoria trabalhista/financeira.
3. **Remoção de hard-coded.** Tirar empresa/CNPJ fixo do gerador de PDF e usar o cadastro de empresas é um avanço de manutenibilidade e LGPD/CLT.
4. **UX mobile melhorou materialmente.** Botões maiores, opções em grade, campos com fonte maior e melhor separação de passos favorecem uso em campo com luvas/touch.
5. **Tratamento de erro no cadastro de empresa.** Adicionar `try/catch` e `toast.error` evita silenciar falhas do Supabase.
6. **Assinatura preta e mais grossa.** Melhora legibilidade em impressão/PDF e reduz risco de recusa por baixo contraste.

---

## 3. Problemas, riscos e bugs identificados

### 3.1 MobileFaltaPage.tsx

#### A. Perda de dados acidental ao sair
O botão **X** do header e o navegador de rotas não pedem confirmação se o usuário já preencheu algo. Em campo isso é comum e pode causar retrabalho.

#### B. Ausente e substituto podem ser a mesma pessoa
Não há validação `ausenteId !== substitutoId`. Isso permite um auto-substituto, gerando pagamento indevido.

#### C. Valor "acordado" é um pseudo-placeholder
```tsx
const [categoriaValorId, setCategoriaValorId] = useState<string>('acordado')
```
"acordado" não existe como id na tabela `categorias_extras`. No payload:
```tsx
categoria_valor_id: catValor?.id || null,
categoria_valor_nome: catValor?.nome || null,
```
Resultado: quando o usuário não muda o select, o campo fica `null` no banco. O rótulo "Valor acordado" não fica registrado. Pode dificultar auditoria de "por que este valor foi usado".

#### D. Categoria fixa `'Operacional'`
O payload envia `categoria: 'Operacional'` para todo registro. Se o motivo for `Atestado` ou `Folga`, a categoria ainda será Operacional. Isso pode distorcer relatórios/balanço diário que filtram por categoria.

#### E. Deduplicação de departamentos por nome pode mascarar dados reais
```tsx
const chave = d.nome_curto.toLowerCase().trim()
if (vistos.has(chave)) return false
```
Se houver departamentos distintos com mesmo nome curto (cenário multi-empresa ou cadastro duplicado), um deles some da lista sem aviso.

#### F. Risco de data futura
O campo `data` aceita qualquer data, inclusive futura. Extras são pagamentos retroativos; permitir data futura pode gerar registros fantasmas.

#### G. Sem feedback de carregamento inicial
`listarCategorias/listarColaboradores/listarDepartamentos` são chamados sem estado de loading. Em conexão lenta, selects aparecem vazios por alguns segundos.

#### H. `empresa_id: null` fixo
```tsx
empresa_id: null,
```
O sistema tem suporte a multi-empresa, mas o mobile descarta essa dimensão. Em relatórios financeiros, esses registros podem ficar órfãos.

#### I. Select de colaborador ausente default "Não se aplica"
Isso incentiva o caminho mais fácil. O ideal seria default `""` (obrigando escolha) ou, no mínimo, uma validação visual.

---

### 3.2 App.tsx — rota `/mobile/falta`

#### A. Rota isolada, mas sem link direto no menu mobile
`/mobile/falta` não aparece nas abas de extras (`ExtrasPageWrapper`) nem no `Sidebar` para desktop. Só é acessível digitando URL ou por link externo. Isso pode gerar confusão entre `/extras/mobile` (`ExtrasPlantaoPage`) e `/mobile/falta`.

#### B. Dupla definição de "mobile"
- `/extras/mobile` → `ExtrasPlantaoPage`
- `/mobile/falta` → `MobileFaltaPage`
A nomenclatura sugere que são a mesma coisa. Isso é um risco de UX e de manutenção.

---

### 3.3 EmpresasPage.tsx

#### A. `type="submit"` + `onClick={handleSubmit}` é redundante
```tsx
<Button type="submit" ... onClick={handleSubmit}>
```
Funciona, mas gera dois handlers idênticos. Se futuramente `handleSubmit` evoluir (ex.: receber evento), pode haver double-fire em algum cenário de teste.

#### B. Botão não entra em estado de loading durante o submit
```tsx
disabled={!form.nome.trim()}
```
Não há `isSubmitting`. Clicks repetidos geram inserts duplicados.

#### C. CNPJ sem máscara/validação
O input CNPJ é livre. Usuário pode digitar `123`, `""` ou texto aleatório. O banco aceita `string | null`, mas relatórios e PDFs vão exibir lixo.

#### D. `handleSubmit` não retorna nada em caso de erro
O `catch` loga e mostra toast, mas o formulário continua em modo de edição sem indicar qual campo falhou. Se o erro for de constraint única no Supabase, o usuário não sabe.

#### E. Exclusão sem checagem de dependências
`remover(id)` é chamado diretamente. Se houver departamentos, colaboradores ou recibos vinculados, pode ocorrer violação de FK (se houver FK) ou registros órfãos (se não houver).

---

### 3.4 ExtrasRecibosPage.tsx

#### A. Marcar como pago em loop serial
```tsx
for (const extra of pendentes) {
  const ok = await atualizar(extra.id, { status: 'Pago' })
}
```
Isso faz N requisições ao Supabase. Além da performance, se uma falhar no meio, parte dos extras fica pago e parte não — inconsistência parcial. A função `useExtrasRecibos.assinar` já faz update em batch (`update(...).in('id', extrasIds)`), mas a função manual de pagamento não.

#### B. Segurança do pagamento depende só do frontend
A exigência de recibo assinado é verificada **apenas no frontend** (`marcarExtrasComoPago`). Qualquer chamada direta ao Supabase `update extras set status='Pago'` (via SQL/Postman) bypassa a regra. Deve haver RLS policy ou trigger no banco garantindo a mesma regra.

#### C. Select de empresa com UX enganosa
```tsx
<option value="">{empresas.length > 0 ? empresas[0].nome : 'Selecione uma empresa'}</option>
```
O `value=""` exibe o nome da primeira empresa, mas a lógica `empresaSelecionada` também usa `empresas[0]` quando `empresaId === ''`. Funciona, mas confunde o usuário (parece que nada está selecionado quando na verdade a primeira já é a ativa).

#### D. Comparação de período por string
```tsx
r.data_inicio === dataInicio && r.data_fim === dataFim
```
Funciona porque as strings estão no formato ISO (`YYYY-MM-DD`), mas é frágil. Espaços, timezone ou mudança de formato quebram a lógica.

#### E. Assinatura em papel gera status `assinado`
```tsx
status: modoPapel ? 'assinado' : 'pendente_assinatura',
data_assinatura: modoPapel ? new Date().toISOString() : null,
```
O sistema trata como "assinado", mas não há assinatura digital armazenada. Se o papel for perdido, não há como provar a assinatura. Recomenda-se status distinto (`assinado_papel`) ou campo indicando modo de assinatura.

#### F. `gerarReciboExtraPDF` não retorna erro tratado no modo papel
Se `gerarReciboExtraPDF` falhar no modo papel, o recibo já foi criado como `assinado` no banco, mas o PDF não foi gerado. O usuário pode achar que concluiu.

#### G. `recibosAssinados` não considera recibos cancelados
```tsx
const recibosAssinados = useMemo(() => recibos.filter(r => r.status === 'assinado'), [recibos])
```
Correto hoje porque só há três status, mas se surgir `arquivado` ou `assinado_papel`, pode precisar de ajuste.

---

### 3.5 AssinaturaCanvas.tsx

#### A. Não lida com `devicePixelRatio`
Em telas retina/HDPI, o canvas fica borrado porque `width`/`height` são fixos em pixels lógicos. A assinatura digital pode perder qualidade em PDF.

#### B. `isEmpty()` depende de estado React
```tsx
const isEmpty = () => !temAssinatura
```
Se algum evento de toque disparar sem chamar `setTemAssinatura`, a flag fica desatualizada. É aceitável, mas menos robusto que verificação de pixels (`getImageData`).

#### C. `toDataURL` pode retornar PNG grande
A assinatura é salva em base64 PNG full-resolution. Em volume, isso pesa no banco (`assinatura_colaborador TEXT`). Não há compressão JPEG ou truncamento de canvas.

#### D. Não reseta ao redimensionar
Se o usuário girar o celular, o canvas redimensiona via CSS, mas o desenho antigo fica distorcido ou cortado.

#### E. Acessibilidade
O canvas não possui rótulo ARIA nem fallback para usuários que navegam por teclado/screen reader.

---

### 3.6 lib/permissoes.ts

#### A. Dupla seção "OCORRÊNCIAS"
Há duas seções comentadas `// ================= OCORRÊNCIAS =================` (linhas 59 e 123). Isso é só organização, mas indica crescimento desordenado.

#### B. `isAdm` permite `'adm'` e `'admin'`
```tsx
const isAdm = (p: NivelAcesso) => p === 'adm' || p === 'admin'
```
Manter `'admin'` legado aumenta a superfície de perfis. Idealmente haveria migration/normalização para um único perfil.

#### C. Nível mínimo no `ProtectedRoute` é array literal
Cada rota repete arrays grandes de strings. Erro de digitação em uma rota é fácil. Não há constante centralizada por módulo.

---

## 4. Sugestões concretas de melhoria

### 4.1 MobileFaltaPage.tsx

#### a) Confirmação ao sair com dados preenchidos
```tsx
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (passo > 1 || departamentoId || valorInput) {
      e.preventDefault()
      e.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [passo, departamentoId, valorInput])
```

#### b) Validar ausente ≠ substituto
```tsx
if (passo === 2) {
  if (!ausenteNaoAplica && !ausenteId) return 'Selecione quem faltou ou marque "Não se aplica"'
  if (!substitutoId) return 'Selecione o substituto'
  if (!ausenteNaoAplica && ausenteId === substitutoId) return 'O substituto não pode ser o mesmo colaborador que faltou'
}
```

#### c) Persistir categoria de valor "acordado"
Adicionar uma categoria real no banco com `nome: 'Valor acordado'` e `valor_padrao: 0`, ou armazenar explicitamente no payload:
```tsx
categoria_valor_id: catValor?.id || 'acordado',
categoria_valor_nome: catValor?.nome || 'Valor acordado',
```
(Verificar se o schema aceita string livre para `categoria_valor_id`; se não, ajustar migration.)

#### d) Limitar data ao passado/recente
```tsx
const hoje = new Date().toISOString().split('T')[0]
// no input:
max={hoje}
```

#### e) Loading inicial
Adicionar `loading` nos hooks de listagem ou criar estado local `carregandoListas` até que todas as promessas resolvam.

#### f) Usar empresa do departamento ou do usuário
```tsx
empresa_id: dept?.empresa_id || user?.empresa_id || null,
```
em vez de `null` fixo.

---

### 4.2 App.tsx

#### a) Centralizar níveis por módulo em constantes
```ts
// lib/permissoes.ts
export const NIVEIS_EXTRAS_EDICAO: NivelAcesso[] = ['admin','adm','mesa','inspetoria']
export const NIVEIS_EXTRAS_VISUALIZACAO: NivelAcesso[] = [...NIVEIS_EXTRAS_EDICAO, 'financeiro']
```

#### b) Renomear rotas para evitar ambiguidade
- `/mobile/falta` → `/extras/falta-mobile` ou `/operacao/falta`
- Atualizar `ExtrasPageWrapper` para incluir o link quando o perfil permitir.

---

### 4.3 EmpresasPage.tsx

#### a) Estado de submit e double-click protection
```tsx
const [salvando, setSalvando] = useState(false)

const handleSubmit = async (e?: React.FormEvent) => {
  e?.preventDefault()
  if (!form.nome.trim() || salvando) return
  setSalvando(true)
  try { ... } finally { setSalvando(false) }
}
```

#### b) Máscara e validação de CNPJ
```tsx
import { formatarCNPJ, validarCNPJ } from '@/lib/utils' // ou instalar lib

<Input
  value={form.cnpj}
  onChange={e => setForm(f => ({ ...f, cnpj: formatarCNPJ(e.target.value) }))}
/>
```

#### c) Remover `onClick` redundante
```tsx
<Button type="submit" disabled={!form.nome.trim() || salvando}>
```

---

### 4.4 ExtrasRecibosPage.tsx

#### a) Batch update para marcar como pago
```tsx
const ids = pendentes.map(e => e.id)
const { error } = await supabase.from('extras').update({ status: 'Pago' }).in('id', ids)
```
Criar no `useExtras` um método `atualizarEmLote` para evitar tocar Supabase direto na página.

#### b) Indicador visual de recibo pendente vs pago
Adicionar badge na tabela de recibos assinados mostrando se todos os extras já estão pagos.

#### c) Status específico para papel
```tsx
status: modoPapel ? 'assinado_papel' : 'pendente_assinatura'
```
E ajustar `marcarExtrasComoPago` para aceitar `'assinado' || 'assinado_papel'`.

#### d) Reforçar regra no banco
Criar RLS policy ou trigger que impeça `UPDATE extras SET status='Pago'` sem recibo assinado no período. Exemplo conceitual:
```sql
CREATE OR REPLACE FUNCTION verifica_recibo_antes_pagar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Pago' AND OLD.status <> 'Pago' THEN
    IF NOT EXISTS (
      SELECT 1 FROM recibos_extras r
      WHERE NEW.substituto_id = r.colaborador_id
        AND NEW.data_ocorrencia BETWEEN r.data_inicio AND r.data_fim
        AND r.status = 'assinado'
    ) THEN
      RAISE EXCEPTION 'Necessario recibo assinado antes de marcar como pago';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### e) UX do select de empresa
```tsx
<option value="">Selecione uma empresa</option>
{empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
```
E não defaultar para `empresas[0]` — force o usuário a escolher ou salve empresa padrão no perfil.

---

### 4.5 AssinaturaCanvas.tsx

#### a) Suporte a devicePixelRatio
```tsx
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  // ... resto
}, [width, height])
```
Ajustar `getPos` para dividir por `dpr`.

#### b) Verificação de pixels para `isEmpty`
```tsx
const isEmpty = () => {
  const canvas = canvasRef.current
  if (!canvas) return true
  const ctx = canvas.getContext('2d')
  if (!ctx) return true
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return !data.some(channel => channel !== 0)
}
```

#### c) Resetar ao redimensionar
```tsx
useEffect(() => {
  const handleResize = () => limpar()
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])
```

---

## 5. Lista de verificação para testar amanhã

### 5.1 MobileFaltaPage
- [ ] Abrir `/mobile/falta` em celular Android e iOS (Safari/Chrome).
- [ ] Preencher passo 1, mudar de departamento e confirmar que ausente/substituto são zerados.
- [ ] Tentar selecionar o mesmo colaborador como ausente e substituto (deve ser impedido ou avisado).
- [ ] Selecionar "Não se aplica" para ausente e salvar; verificar payload no Supabase (`colaborador_ausente_id` = null).
- [ ] Preencher data futura e verificar se é permitida; se sim, levantar bug.
- [ ] Preencher valor com `mascaraMoedaInput` e verificar se `parseMoeda` converte corretamente para número.
- [ ] Clicar em X com dados preenchidos e verificar se há confirmação (esperado: não há hoje).
- [ ] Salvar e verificar se `categoria_valor_id` fica null quando "Valor acordado" está selecionado.
- [ ] Verificar se `empresa_id` é null no banco (risco multi-empresa).
- [ ] Testar touch: assinatura funciona, mas aqui não há canvas; testar apenas inputs e botões de opção.

### 5.2 App.tsx / Rotas
- [ ] Acessar `/mobile/falta` como `visualizador` → deve redirecionar para `/`.
- [ ] Acessar `/mobile/falta` como `mesa` → deve entrar.
- [ ] Confirmar que `/extras/mobile` e `/mobile/falta` são páginas diferentes e documentar isso para usuários.

### 5.3 EmpresasPage
- [ ] Testar cadastro com Enter no formulário (deve submeter via `type="submit"`).
- [ ] Testar clique duplo no botão Cadastrar — verificar se cria duplicata.
- [ ] Testar CNPJ com caracteres inválidos e vazio.
- [ ] Testar edição e cancelar edição.
- [ ] Logar como `visualizador` e confirmar que form e botões de ação somem.
- [ ] Logar como `gestor` e confirmar que pode editar mas não excluir.

### 5.4 ExtrasRecibosPage
- [ ] Criar extras para um colaborador sem gerar recibo; tentar "Marcar como pago" → deve bloquear.
- [ ] Gerar recibo em modo papel e depois marcar como pago → deve permitir.
- [ ] Gerar recibo digital, assinar e marcar como pago → deve permitir.
- [ ] Marcar como pago com 5+ extras e medir tempo (hoje é serial).
- [ ] Verificar se ao marcar como pago a tabela atualiza corretamente (chamadas `await listar` + `listarRecibos`).
- [ ] Selecionar empresa no select e verificar se PDF usa CNPJ correto.
- [ ] Testar modo papel com falha no PDF (ex.: bloquear popup) e verificar estado do recibo no banco.
- [ ] Testar exclusão de recibo como `financeiro` e como `mesa` (mesa não deve ver botão).

### 5.5 AssinaturaCanvas
- [ ] Assinar em desktop com mouse; salvar PDF e verificar cor preta.
- [ ] Assinar em celular com dedo; verificar se scroll não interfere.
- [ ] Girar celular após assinar; verificar se assinatura se mantém.
- [ ] Limpar assinatura e tentar confirmar → deve bloquear.
- [ ] Comparar tamanho do base64 gerado antes/depois (preocupação storage).

### 5.6 Geral / Segurança
- [ ] Verificar se existe RLS no Supabase impedindo update direto de `extras.status` para `'Pago'` sem recibo.
- [ ] Revisar se as permissões de `lib/permissoes.ts` espelham as RLS policies.
- [ ] Rodar `npm run build` e `npm run lint` para garantir que não há erros de tipo introduzidos pelas mudanças.

---

## Conclusão

As alterações de hoje representam **avanços claros em UX mobile, compliance financeiro e RBAC**. As correções na tela de recibos (exigência de recibo assinado antes do pagamento) e na tela de empresas (permissões e tratamento de erro) são especialmente bem-vindas.

No entanto, **há riscos operacionais e de segurança que precisam de atenção imediata**:
1. Regras de negócio críticas (pagamento só com recibo) estão apenas no frontend.
2. MobileFaltaPage permite cenários inconsistentes (mesma pessoa como ausente/substituto, data futura, empresa nula).
3. EmpresasPage ainda é vulnerável a double-submit e CNPJ inválido.
4. A arquitetura de rotas mobile (`/mobile/falta` vs `/extras/mobile`) precisa de uniformização.

**Recomendação geral:** priorizar a criação de RLS/trigger no banco para o pagamento de extras e a padronização das constantes de permissão antes de novas features.
