# Roteiro de Testes — CORH (para os usuários do piloto)

> **O que é isso?** Um roteiro simples para você testar o sistema CORH no dia a dia, antes da liberação geral.
> **Quanto tempo leva?** Cerca de 30 a 45 minutos, no seu ritmo. Não precisa fazer tudo de uma vez.
> **Importante:** este é um ambiente de teste. Pode clicar, criar e editar à vontade — se algo quebrar, é exatamente isso que queremos descobrir.

---

## 1. Acesso

- **Endereço:** https://plena-corh.netlify.app/
- **Seu usuário:** o e-mail e a senha que você recebeu.
- **Primeiro acesso:** ao entrar pela primeira vez, o sistema pede o **consentimento LGPD**. Leia e clique em aceitar — sem isso não é possível usar o sistema.

---

## 2. O que queremos saber

Ao final do teste, responda (pode ser por mensagem mesmo):

1. O que funcionou bem?
2. O que não funcionou ou deu erro?
3. O que ficou confuso ou difícil de encontrar?
4. O tamanho das letras e das telas está confortável?

**Como reportar um problema:** anote a tela onde estava, o que você fez, o que aconteceu e, se possível, tire um print da tela. Não precisa de termo técnico — descreva com suas palavras.

---

## 3. Testes que todos devem fazer

### 3.1 Login e tela inicial

- [ ] Entrar com e-mail e senha.
- [ ] Aceitar o consentimento LGPD (primeiro acesso).
- [ ] Ver a tela inicial (dashboard) com saudação e cartões de resumo.
- [ ] Conferir se o menu lateral mostra **apenas** as opções da sua função. Se aparecer algo que você não deveria ver (ou faltar algo que você precisa), anote.

### 3.2 Dashboard

- [ ] Os números fazem sentido (colaboradores ativos, ocorrências, alertas)?
- [ ] A seção de aniversariantes do mês está correta?
- [ ] A seção de admissões recentes está correta?
- [ ] Ao clicar em um colaborador, abre a ficha dele?

### 3.3 Colaboradores

- [ ] Abrir o menu **Colaboradores** e buscar alguém pelo nome.
- [ ] Abrir a ficha de um colaborador e conferir se os dados estão certos.
- [ ] Colaboradores inativos aparecem com o status correto?

### 3.4 Teste no celular

- [ ] Abrir o sistema no navegador do celular e fazer login.
- [ ] Navegar por duas ou três telas: está legível? Dá para usar sem ficar "esticando" a tela?
- [ ] Se aparecer a opção **"Adicionar à tela inicial"**, instale e abra pelo ícone.

---

## 4. Testes por função

Faça **apenas a seção da sua função**, além dos testes comuns acima. Se tentar fazer algo e o sistema bloquear, **isso pode ser o comportamento esperado** — anote mesmo assim.

### 4.1 RH / Gestor — Ocorrências

- [ ] Abrir **RH → Ocorrências** e usar a busca por nome de colaborador.
- [ ] Testar os filtros (tipo, status, datas) com o botão **Aplicar** e depois o botão **Limpar**.
- [ ] Criar uma ocorrência nova (preencha título e descrição, que são obrigatórios).
- [ ] Anexar um arquivo (PDF ou foto) e depois abrir o anexo na tela de detalhes.
- [ ] Editar uma ocorrência existente e salvar.
- [ ] Verificar se ocorrências antigas (históricas) aparecem na busca, mesmo de colaboradores que não estão mais na empresa.

### 4.2 DP — Benefícios (VR) e e-Contador

- [ ] Abrir **Benefícios (VR)** e criar um projeto de VR.
- [ ] Fazer upload dos arquivos do projeto (PDFs e planilha de escala).
- [ ] Rodar o cálculo e conferir se os resultados fazem sentido.
- [ ] Salvar os resultados.
- [ ] Abrir **Importar e-Contador**, listar empresas e importar um colaborador de teste.
- [ ] Conferir se o colaborador importado aparece na lista de Colaboradores.

### 4.3 Mesa / Inspetoria — Extras e CEU

- [ ] Abrir **Extras → Lançamentos** e lançar um extra para um colaborador (departamento e valor são obrigatórios).
- [ ] Abrir **Extras → Recibos**, gerar um recibo e assinar.
- [ ] Abrir **CEU → Movimentações** e registrar uma entrega de item (uniforme, crachá ou EPI).
- [ ] Abrir **CEU → Relatórios** e conferir se a entrega aparece.
- [ ] Testar o **Lançamento rápido** do CEU.

### 4.4 Financeiro — Extras

- [ ] Abrir **Extras → Lançamentos** e conferir os valores.
- [ ] Abrir **Extras → Recibos** e marcar um extra como pago.
- [ ] Conferir o **Balanço** e o **Relatório** de extras.

### 4.5 Escalas

- [ ] Abrir **Escalas** e importar uma planilha de escala (formato FLIT).
- [ ] Conferir se os dias e locais de trabalho aparecem corretos.
- [ ] Confirmar o local de trabalho de um colaborador no modal de confirmação.
- [ ] Exportar a escala em Excel ou PDF.

### 4.6 Visualizador

- [ ] Navegar pelas telas disponíveis e conferir se **não aparece nenhum botão** de criar, editar ou excluir.
- [ ] Tentar acessar Configurações ou Auditoria pelo menu — não deve aparecer.

### 4.7 Administrador

- [ ] Acessar **Configurações**, **Auditoria** e **Permissões** (só o admin vê).
- [ ] Na tela **Permissões**, ligar/desligar uma permissão de teste e confirmar que o menu do usuário muda.
- [ ] Criar, editar e excluir um registro de teste em cada módulo.

---

## 5. Regras do teste

- **Não apague dados reais** (colaboradores, ocorrências históricas, contratos). Se precisar testar exclusão, crie um registro de teste e exclua o seu próprio registro.
- O colaborador **"OCORRENCIAS HISTORICAS - NAO IDENTIFICADO"** (matrícula 999999) é um registro do sistema — não edite nem exclua.
- Se algo travar, recarregue a página (F5) e tente de novo. Se travar de novo, anote e reporte.

---

## 6. Devolutiva

Envie suas anotações até **___/___/______** para:

- **Responsável:** _________________________
- **Canal (e-mail/WhatsApp):** _________________________

Formato livre — pode ser texto, lista ou prints. O importante é dizer: **onde estava, o que fez, o que aconteceu**.

---

*CORH — Controle Operacional e de RH · Roteiro de testes piloto · Versão 1.0 — julho/2026*
