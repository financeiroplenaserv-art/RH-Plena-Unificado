# Guia de Testes Piloto — CORH

> Versão: 1.0  
> Data: 17/07/2026  
> Objetivo: validar o CORH com usuários reais antes de liberar o acesso em massa.

---

## 1. O que é este teste?

Um teste piloto é um período controlado em que **1 ou 2 usuários de cada perfil** usam o sistema no dia a dia. O objetivo não é encontrar bugs apenas, mas sim descobrir:

- O que está confuso ou difícil de usar.
- O que está lento ou travando.
- Se as permissões estão corretas (cada um vê só o que deve).
- Se os dados estão corretos.

---

## 2. Quem deve participar

Convide **no máximo 2 pessoas de cada perfil**:

| Perfil | Exemplo de usuário | O que observar |
|---|---|---|
| Administrador | Gestor da RH / TI | Consegue acessar tudo? Consegue corrigir erros? |
| Gestor / RH | Analista de RH | Cria e edita ocorrências? Importa dados? |
| DP1 / DP2 | Assistente de DP | Módulo de VR e e-Contador funcionam? |
| Mesa / Inspetoria | Operador de ponto | Módulo de Extras e lançamentos funcionam? |
| Financeiro | Analista financeiro | Consegue marcar extras como pagos? |
| Visualizador | Colaborador de outra área | Só vê o que deve? Não vê botões de editar? |

---

## 3. Antes de começar

1. **Faça backup dos dados** do Supabase.
2. **Crie os usuários de teste** no login do CORH.
3. **Confirme o nível de acesso** de cada um no menu "Permissões".
4. **Peça para cada participante anotar** o que funcionou, o que não funcionou e o que ficou confuso.

---

## 4. Cenários de teste

### 4.1 Login e primeira impressão

- [ ] Faz login com email e senha.
- [ ] Vê o dashboard com saudação, data e cards de resumo.
- [ ] O tamanho da letra está confortável para ler.
- [ ] A sidebar mostra apenas os menus permitidos.

### 4.2 Dashboard

- [ ] O número de colaboradores ativos está correto.
- [ ] O número de ocorrências pendentes está correto.
- [ ] A Central de Alertas mostra avisos relevantes.
- [ ] A seção "Contratos de experiência" mostra colaboradores em 30, 60 ou 90 dias.
- [ ] A seção "Aniversariantes" mostra quem faz aniversário no mês.
- [ ] A seção "Admissões recentes" mostra quem entrou nos últimos 30 dias.
- [ ] Ao clicar em um colaborador, abre a ficha dele.

### 4.3 Colaboradores

- [ ] Lista de colaboradores carrega e permite buscar por nome.
- [ ] Ficha do colaborador exibe dados corretos.
- [ ] Permissão de edição respeita o perfil do usuário.
- [ ] Colaboradores inativos ou afastados aparecem com o status correto.

### 4.4 Ocorrências

- [ ] Criar uma nova ocorrência.
- [ ] Anexar um arquivo (PDF, imagem, áudio ou vídeo).
- [ ] Visualizar o anexo na tela de detalhes.
- [ ] Editar uma ocorrência existente.
- [ ] Filtrar ocorrências por tipo, status e colaborador.
- [ ] Usuário sem permissão não vê botão de criar/editar.

### 4.5 Escalas e importações

- [ ] Importar uma planilha de escala (formato CORH/FLIT).
- [ ] Verificar se as batidas dos colaboradores aparecem corretas.
- [ ] Verificar se colaboradores com 5 dias trabalhados aparecem com 5 batidas.
- [ ] Exportar a escala filtrada em Excel/PDF.

### 4.6 e-Contador

- [ ] Acessar "Importar e-Contador" (somente perfis liberados).
- [ ] Listar empresas e colaboradores.
- [ ] Importar colaboradores selecionados.
- [ ] Verificar se os dados importados aparecem na lista de colaboradores.

### 4.7 VR, Extras e CEU

- [ ] Acessar os módulos permitidos ao perfil.
- [ ] Criar/editar registros conforme a permissão.
- [ ] Verificar se botões de exclusão aparecem apenas para quem pode deletar.

### 4.8 Permissões e segurança

- [ ] Visualizador não consegue acessar Configurações, Auditoria ou e-Contador.
- [ ] Visualizador não vê botões de criar/editar/excluir.
- [ ] Usuário não-admin tenta excluir algo e é bloqueado.
- [ ] Não é possível acessar o sistema sem login.

---

## 5. Como reportar um problema

Peça para cada participante anotar:

1. **Perfil usado** (ex: gestor, visualizador).
2. **Tela / rota** (ex: Dashboard, Colaboradores, Ocorrências).
3. **O que fez** (passo a passo).
4. **O que aconteceu** (mensagem de erro, tela em branco, dado errado).
5. **Print da tela** (se possível).
6. **Console do navegador** (F12 → Console, se houver mensagem vermelha).

---

## 6. Checklist de aprovação do piloto

Antes de liberar para mais usuários, confirme:

- [ ] Nenhum erro crítico foi encontrado (impede uso).
- [ ] Login funciona para todos os perfis testados.
- [ ] Dashboard exibe dados corretos e úteis.
- [ ] Importação de escalas funciona sem perder batidas.
- [ ] Permissões estão corretas (cada perfil vê só o que deve).
- [ ] O tamanho da fonte é aceitável para a maioria.
- [ ] Os problemas encontrados foram corrigidos ou registrados para correção.

---

## 7. Após o piloto

1. Reúna os feedbacks.
2. Priorize: erros críticos → confusões frequentes → ajustes visuais.
3. Corrija o que for necessário.
4. Refaça o teste piloto se houver correções grandes.
5. Somente então libere o acesso para mais pessoas.

---

## 8. Contato para dúvidas

- Responsável técnico: _________________________
- Canal de suporte: _________________________
