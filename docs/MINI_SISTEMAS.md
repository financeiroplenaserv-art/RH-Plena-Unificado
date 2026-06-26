# Relatório de Mini-Sistemas — RH Plena Unificado

> **Objetivo deste documento:** servir de referência rápida para agentes e desenvolvedores entenderem o que cada módulo faz, quais regras de negócio aplicam e como se relacionam.

---

## 1. Visão Geral da Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Roteamento | React Router v7 (`BrowserRouter`) |
| UI | Tailwind CSS + Radix UI + componentes customizados (`@/components/ui/*`) |
| Auth / Backend | Supabase (Auth + Postgres) |
| Geração de documentos | jsPDF + jspdf-autotable |
| Planilhas | `@e965/xlsx` |
| Parsing de PDF | `pdfjs-dist` |

Padrão predominante: **hooks de domínio** (`use*.ts`) encapsulam CRUD/integração com Supabase; páginas em `src/pages/` consomem esses hooks. As páginas são lazy-loaded a partir de `src/routes/lazyPages.ts`.

---

## 2. Hierarquia de Permissões

```
visualizador (1) < gestor (2) < rh (3) < admin (4)
```

- **`visualizador`**: apenas leitura.
- **`gestor` / `rh`**: leitura + inserção + atualização.
- **`admin`**: todas as operações, incluindo delete.

A verificação ocorre em `ProtectedRoute` (`src/components/layout/ProtectedRoute.tsx`) e em `useAuth().temAcesso()`.

No banco, a migration `014` implementa:
- `is_admin()` → DELETE.
- `is_editor()` → INSERT/UPDATE (`admin`, `rh`, `gestor`).
- `is_rh_ou_admin()` → proteção do token e-Contador.

---

## 3. Mini-Sistemas / Módulos

### 3.1 Core / Master Data

#### 3.1.1 Dashboard
- **Página**: `DashboardPage` (`src/pages/DashboardPage.tsx`)
- **Descrição**: Visão geral do sistema (resumo não detalhado no escopo atual).
- **Permissão**: Todos os níveis autenticados.

#### 3.1.2 Colaboradores
- **Página**: `ColaboradoresPage` (`src/pages/ColaboradoresPage.tsx`)
- **Funcionalidades**:
  - Listagem paginada com filtros por nome, departamento, cargo, status, empresa.
  - Visualização em cards com iniciais.
  - Modal de detalhes com edição limitada (nome, cargo, departamento, telefone, celular, e-mail, status).
- **Regras de negócio**:
  - Dados mestres importados principalmente do e-Contador.
  - Status possíveis: `Ativo`, `Inativo`, `Afastado`.
- **Permissão**: Leitura para todos; edição restrita implicitamente à UI (não há guarda específica na rota `/colaboradores`, mas o formulário de edição avançada `/rh/colaboradores/:id/editar` exige `admin` ou `rh`).
- **Tabelas**: `colaboradores`

#### 3.1.3 Empresas
- **Página**: `EmpresasPage` (`src/pages/EmpresasPage.tsx`)
- **Funcionalidades**: CRUD de empresas.
- **Permissão**: Leitura para `visualizador`; edição requer `admin`/`rh`/`gestor` via RLS.
- **Tabelas**: `empresas`

#### 3.1.4 Departamentos
- **Página**: `DepartamentosPage` (`src/pages/DepartamentosPage.tsx`)
- **Funcionalidades**: CRUD de departamentos, usados como “postos/clientes”.
- **Campos relevantes**: `nome_curto`, `endereco`, `bairro`, `cidade`, `estado`, `cep`, contatos, `status`.
- **Permissão**: Leitura para todos; insert/update para editores; delete apenas admin.
- **Tabelas**: `departamentos`

---

### 3.2 Integração — e-Contador (Alterdata)

- **Páginas**:
  - `ImportarEContadorPage` (`/importar/econtador`)
  - `ConfiguracoesPage` (`/configuracoes`) — configuração do token
- **Serviço**: `src/services/econtadorApi.ts`
- **Hook**: `useEContador`
- **Regras de negócio**:
  - Consome API Alterdata (`https://dp.pack.alterdata.com.br/api/v1`).
  - Lista apenas empresas cujo nome contenha “plena ea” ou “plena tech”.
  - Carrega funcionários paginados (até 5.000 registros).
  - Mapeia status: demissão → `Inativo`; status `Inativo`; afastamento não-férias com data futura → `Afastado`; demais → `Ativo`.
  - Cria empresa automaticamente no banco local se não existir.
  - Sincroniza departamentos por nome.
  - Mantém histórico de importações.
- **Integrações**: API REST Alterdata e-Contador.
- **Permissão**: `/importar/econtador` sem guarda explícita (apenas autenticado). `/configuracoes` exige `admin` ou `rh`.
- **Tabelas**: `colaboradores`, `empresas`, `departamentos`, `configuracoes`, `historico_importacoes_econtador`

---

### 3.3 RH — Ocorrências Disciplinares / Registro de RH

- **Páginas**:
  - `OcorrenciasPage` (`/rh/ocorrencias`)
  - `OcorrenciaFormPage` (`/rh/ocorrencias/novo`, `/rh/ocorrencias/colaborador/:colaboradorId`)
  - `OcorrenciaDetailPage` (`/rh/ocorrencias/:id`)
  - `ModelosPage` (`/rh/modelos`)
  - `ImportarRhPage` (`/rh/importar`)
- **Hook**: `useOcorrencias`
- **Regras de negócio**:
  - 46 tipos de ocorrência agrupados em 9 macro grupos (Jornada/Ponto, Conduta/Disciplina, SST, Afastamentos, Desempenho, Relacionamento, Patrimonial, Administrativas, Registro do RH).
  - Alguns tipos exigem anexo obrigatório. Se exigir, status inicial = `Pendente`; senão = `Ativa`.
  - Status: `Pendente`, `Ativa`, `Resolvida`, `Cancelada`.
  - Pré-preenche descrição baseada em modelo/tipo selecionado.
  - Permite anexar documentos, vídeos, áudios.
  - Permite adicionar testemunhas.
  - Gera PDF do registro para assinatura do colaborador.
- **Integrações**: Supabase Storage (bucket `ocorrencia-anexos`).
- **Permissão**: `admin`, `rh` ou `gestor`.
- **Tabelas**: `ocorrencias`, `ocorrencia_anexos`, `ocorrencia_testemunhas`, `ocorrencia_aprovacoes`, `ocorrencia_defesas`, `modelos_ocorrencia`, `auditoria`/`log_auditoria`

---

### 3.4 Alertas de Conformidade Legal

- **Página**: `AlertasPage` (`/rh/alertas`)
- **Hook**: `useAlertas`
- **Regras de negócio**:
  - Gera alertas automaticamente com base em ocorrências ativas/pendentes.
  - Tipos: `SUSPENSAO_LIMITE`, `ESTABILIDADE`, `FALTAS_EXCESSIVAS`, `PRAZO_DEFESA`, `OCORRENCIA_PENDENTE`, `PROGRESSAO_DISCIPLINAR`, `HOMOLOGACAO_NECESSARIA`.
  - Progressão disciplinar: 3+ ocorrências ativas geram alerta crítico.
  - Severidades: `critica`, `alta`, `media`, `baixa`.
  - Status: `ativo`, `lido`, `arquivado`.
  - Referências legais na UI: Arts. 482, 474, 853, 211 CLT.
- **Permissão**: `admin`, `rh` ou `gestor`.
- **Tabelas**: `alertas`

---

### 3.5 CEU — Crachá, Equipamento e Uniforme

- **Páginas**:
  - `CeuDashboardPage` (`/ceu/dashboard`)
  - `CeuItensPage` (`/ceu/itens`)
  - `CeuItemFormPage` (`/ceu/itens/novo`, `/ceu/itens/:id/editar`)
  - `CeuFornecedoresPage` (`/ceu/fornecedores`)
  - `CeuMovimentacoesPage` (`/ceu/movimentacoes`)
  - `CeuEntregaFormPage` (`/ceu/movimentacoes/novo`)
  - `CeuLancamentoRapidoPage` (`/ceu/lancamento-rapido`)
  - `CeuRelatoriosPage` (`/ceu/relatorios`)
  - `CeuImportarPage` (`/ceu/importar`)
- **Hooks**: `useCEUItens`, `useCEUEntregas`, `useCEUFornecedores`
- **Regras de negócio**:
  - Catálogo de itens: Crachá, Uniforme, EPI.
  - Controle de estoque (`estoque`, `estoque_minimo`), validade de CA, prazo de uso.
  - Registro de entregas e devoluções por colaborador.
  - Alertas de estoque baixo, CA vencendo (≤30 dias), prazo de uso expirando (≤7 dias).
  - Geração de recibo de entrega em PDF.
  - Tamanhos de uniforme/calçado salvos no cadastro do colaborador.
- **Integrações**: Geração de PDF via `gerarReciboEntregaCEU`.
- **Permissão**: Leitura para `visualizador`; edição/entregas para `admin`/`rh`/`gestor`; importação e cadastro de itens apenas `admin`/`rh`.
- **Tabelas**: `itens`, `entregas`, `fornecedores`, `colaboradores`

---

### 3.6 VR — Vale Refeição

- **Páginas**:
  - `VrProjetosPage` (`/vr/projetos`)
  - `VrProjetoFormPage` (`/vr/projetos/novo`, `/vr/projetos/:id/editar`)
  - `VrProjetoDetailPage` (`/vr/projetos/:id`)
- **Hooks**: `useProjetosVR`, `useCalculoVR`, `useConfiguracaoVR`
- **Regras de negócio**:
  - Projeto define data de corte, data de efetivação, valor VR, % desconto, produto, CNPJ cliente, empresa Alterdata, local de entrega.
  - Cálculo compara PDF de pontos (mês atual e anterior) com escala Excel.
  - Elegibilidade: dias trabalhados no PDF + dias a trabalhar na escala − abatimentos (faltas do mês anterior).
  - Exporta arquivo VR PAT (layout 350 posições), arquivo Alterdata (61 posições) e Excel de conferência.
  - Importa base de colaboradores (matrícula, nome, CPF, data nascimento) para enriquecer CPF/matricula.
  - Backup/restauração de projetos em JSON.
- **Integrações**: Supabase Storage (`vr-arquivos`), parsing de PDF, parsing de Excel.
- **Permissão**: Leitura/criação para `admin`/`rh`/`gestor`; edição/exclusão apenas `admin`/`rh`.
- **Tabelas**: `projetos_vr`, `resultados_vr`, `configuracoes`

---

### 3.7 Adicionais Contratuais

- **Páginas**:
  - `AdicionaisContratosPage` (`/adicionais/contratos`)
  - `AdicionaisVinculosPage` (`/adicionais/vinculos`)
  - `AdicionaisCalendarioPage` (`/adicionais/calendario`)
  - `AdicionaisRelatorioPage` (`/adicionais/relatorio`)
  - `ImportarPontoPage` (`/adicionais/importar-ponto`)
- **Hook**: `useAdicionaisContratuais`
- **Regras de negócio**:
  - Contratos definem adicionais (`insalubridade`, `noturno`, `periculosidade`, `feriado`, `intrajornada`) e regime de trabalho (`12x36`, `6x1`, `5x2`, `personalizado`).
  - Vínculos ligam colaboradores a contratos por período.
  - Calendário mensal registra status diário (`trabalhou`, `falta`, `ferias`, `afastado`, `folga`, `folga_substituicao`) e substitutos.
  - Regime aplica fallback automático de dias trabalhados/folga.
  - Relatório agrega dias trabalhados por adicional; insalubridade/periculosidade assumem 30 dias se não houver faltas, senão descontam faltas.
  - Exporta relatório para Excel/CSV.
  - Modo mock via `VITE_MODO_MOCK=true` usa localStorage.
- **Permissão**: Leitura para `visualizador`; edição para `admin`/`rh`/`gestor`.
- **Tabelas**: `contratos_adicionais`, `vinculos_adicionais`, `calendario_adicionais`

---

### 3.8 Extras (Cash / Coberturas / Pagamentos)

- **Páginas**:
  - `ExtrasLancamentosPage` (`/extras/lancamentos`)
  - `ExtrasFormPage` (`/extras/novo`, `/extras/:id/editar`)
  - `ExtrasBalancoPage` (`/extras/balanco`)
  - `ExtrasRelatorioPage` (`/extras/relatorio`)
  - `ExtrasRecibosPage` (`/extras/recibos`)
  - `ExtrasCategoriasPage` (`/extras/categorias`)
  - `ExtrasPlantaoPage` (`/extras/mobile`)
  - `MobileFaltaPage` (`/mobile/falta`)
- **Hooks**: `useExtras`, `useExtrasRecibos`
- **Regras de negócio**:
  - Registro de ausências, substituições, extras, faltas, férias, reforços faturados/estratégicos.
  - Campos: data, turno, categoria, posto, departamento, colaborador ausente, substituto, motivo, valor, categoria de valor, comunicação com cliente, flag `extra_faturado`, status (`Pendente`, `Pago`, `Cancelado`).
  - Categorias de valor configuráveis (`categorias_extras`) com valores padrão.
  - Balanço operacional gera mensagem formatada para WhatsApp.
  - Recibos de pagamento com assinatura digital do colaborador (ou em papel) e geração de PDF.
  - Assinatura do recibo pode marcar os extras vinculados como `Pago`.
  - Página mobile para lançamento rápido de faltas.
- **Integrações**: Geração de PDF via `gerarReciboExtraPDF`.
- **Permissão**: Leitura/relatórios/balanço para `visualizador`; lançamentos/recibos/categorias para `admin`/`rh`/`gestor`.
- **Tabelas**: `extras`, `categorias_extras`, `recibos_extras`

---

### 3.9 Configurações

- **Página**: `ConfiguracoesPage` (`/configuracoes`)
- **Funcionalidades**:
  - Cadastro/alteração do token JWT do e-Contador Alterdata.
- **Regras de segurança**:
  - A chave `econtador_token` em `configuracoes` só pode ser lida/escrita por `admin` ou `rh` (RLS migration `015`).
- **Permissão**: `admin` ou `rh`.
- **Tabelas**: `configuracoes`

---

### 3.10 Módulos Placeholders

- **Páginas**:
  - `/escalas` — Escalas de trabalho
  - `/ferias` — Controle de férias
  - `/relatorios` — Relatórios gerenciais
- **Status**: Telas de placeholder sem funcionalidade implementada.

---

## 4. Resumo de RLS / Políticas de Segurança

| Tabela | SELECT | INSERT/UPDATE | DELETE | Observação |
|---|---|---|---|---|
| `empresas`, `colaboradores`, `departamentos`, `perfis`, `ocorrencias*`, `alertas`, `modelos_ocorrencia`, `auditoria`, `projetos_vr`, `resultados_vr`, `fornecedores`, `itens`, `entregas`, `contratos_adicionais`, `vinculos_adicionais`, `calendario_adicionais`, `log_auditoria` | autenticados | editores (`admin`/`rh`/`gestor`) | apenas `admin` | via `014` |
| `configuracoes` | geral, exceto `econtador_token` | editores, exceto token | admin | token apenas `admin`/`rh` |
| `historico_importacoes_econtador` | próprio usuário | próprio usuário | próprio ou admin | — |
| Storage `ocorrencia-anexos` / `vr-arquivos` | autenticados | autenticados | apenas `admin` | via `011` |

---

## 5. Principais Dependências e Integrações Externas

| Integração | Tecnologia | Onde usada |
|---|---|---|
| Supabase Auth + Postgres | `@supabase/supabase-js` | Todo o app |
| Alterdata e-Contador | REST API (`dp.pack.alterdata.com.br`) | Importação de colaboradores/empresas/departamentos |
| Geração de PDF | `jspdf`, `jspdf-autotable` | Ocorrências, recibos CEU, recibos de extras, fichas |
| Planilhas | `@e965/xlsx` | Importação de escalas/pontos, exportação de relatórios |
| Parsing de PDF | `pdfjs-dist` | VR (pontos) |

---

## 6. Observações Finais

- O sistema é multi-empresa, mas a mesma equipe gerencia todas as empresas do grupo (RLS não isola por empresa).
- Departamentos são tratados como “postos/clientes” e possuem processo de consolidação/controle de duplicatas via migrations 021–025.
- Existe mecanismo de “primeiro acesso”: se não houver perfis, o primeiro login criado se torna `admin`.
- Vários módulos possuem fallback/mock local (`useAdicionaisContratuais` usa `VITE_MODO_MOCK`).

---

*Documento gerado em: 2026-06-25*
