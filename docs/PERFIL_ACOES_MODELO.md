# Modelo de Perfis e Ações — RH Plena Unificado

> **Perfis definidos:** ADM, GESTOR, RH, DP1, DP2, MESA, INSPETORIA, FINANCEIRO
>
> ADM = direito total.

---

## 1. Core / Dados Mestres

### Dashboard
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 1.1 | Visualizar dashboard e KPIs | TODOS |

### Colaboradores
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 1.2 | Visualizar lista de colaboradores | TODOS |
| 1.3 | Visualizar detalhes do colaborador | TODOS |
| 1.4 | Editar dados básicos do colaborador (telefone, e-mail, departamento, cargo, status) | GESTOR, RH, DP1, DP2, MESA |
| 1.5 | Editar dados completos/sensíveis do colaborador | GESTOR, RH, DP1, DP2 |
| 1.6 | Cadastrar novo colaborador manualmente | RH, DP1, DP2 |
| 1.7 | Excluir colaborador | DP1, DP2 |
| 1.8 | Importar colaboradores do e-Contador | DP1, DP2 |
| 1.9 | Exportar dados de colaboradores (CSV/Excel/PDF) | GESTOR, RH, DP1, DP2, MESA |

### Empresas
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 1.10 | Visualizar empresas | TODOS |
| 1.11 | Cadastrar/editar empresa | GESTOR, DP, FINANCEIRO |
| 1.12 | Excluir empresa | ADM |

### Departamentos (Postos/Clientes)
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 1.13 | Visualizar departamentos | TODOS |
| 1.14 | Cadastrar/editar departamento | GESTOR, DP1, DP2, MESA, FINANCEIRO |
| 1.15 | Excluir departamento | GESTOR, FINANCEIRO |
| 1.16 | Importar departamentos via CSV | GESTOR, RH, DP1, DP2, MESA |

---

## 2. e-Contador / Integração Alterdata

| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 2.1 | Configurar token do e-Contador | DP1, DP2 |
| 2.2 | Visualizar tela de importação do e-Contador | DP1, DP2 |
| 2.3 | Executar importação de empresas/colaboradores/departamentos | DP1, DP2 |
| 2.4 | Visualizar histórico de importações | DP1, DP2 |

---

## 3. RH — Ocorrências Disciplinares

| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 3.1 | Visualizar lista de ocorrências | GESTOR, RH, DP1, DP2, MESA, INSPETORIA |
| 3.2 | Visualizar detalhes de uma ocorrência | GESTOR, RH, DP1, DP2, MESA |
| 3.3 | Criar nova ocorrência | GESTOR, RH, DP1, DP2, MESA |
| 3.4 | Editar ocorrência existente | GESTOR, RH, DP1, DP2, MESA |
| 3.5 | Cancelar ocorrência | GESTOR, RH, DP1, MESA |
| 3.6 | Anexar arquivos em ocorrência (documentos, vídeos, áudios) | GESTOR, RH, DP1, DP2, MESA, INSPETORIA |
| 3.7 | Adicionar testemunhas | GESTOR, RH, DP1, DP2, MESA, INSPETORIA |
| 3.8 | Gerar PDF da ocorrência para assinatura | GESTOR, RH, DP1, DP2, MESA, INSPETORIA |
| 3.9 | Registrar defesa do colaborador | GESTOR, RH, DP1, DP2, MESA, INSPETORIA |
| 3.10 | Aprovar ocorrência | GESTOR, RH, DP1, DP2 |
| 3.11 | Gerenciar modelos de ocorrência | GESTOR, RH, DP1, DP2 |

---

## 4. RH — Alertas de Conformidade

| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 4.1 | Visualizar alertas | DP1 |
| 4.2 | Marcar alerta como lido | DP1 |
| 4.3 | Arquivar alerta | DP1 |

---

## 5. CEU — Crachá, Equipamento e Uniforme

### Itens/Catálogo
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 5.1 | Visualizar itens do CEU | DP1, MESA |
| 5.2 | Cadastrar/editar item (crachá, uniforme, EPI) | DP1, MESA |
| 5.3 | Excluir item | DP1 |
| 5.4 | Importar itens em massa | DP1 |

### Fornecedores
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 5.5 | Visualizar fornecedores | GESTOR, DP1 |
| 5.6 | Cadastrar/editar fornecedor | GESTOR, DP1 |
| 5.7 | Excluir fornecedor | GESTOR, DP1 |

### Entregas / Movimentações
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 5.8 | Visualizar entregas | GESTOR, DP1, MESA, INSPETOR |
| 5.9 | Registrar nova entrega para colaborador | GESTOR, DP1 |
| 5.10 | Registrar devolução | GESTOR, DP1 |
| 5.11 | Gerar recibo de entrega em PDF | GESTOR, DP1, MESA |
| 5.12 | Lançamento rápido de entrega (tela simplificada) | GESTOR, DP1 |

### Relatórios CEU
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 5.13 | Visualizar relatórios de entregas/estoque | GESTOR, DP1, MESA |
| 5.14 | Exportar relatórios CEU | GESTOR, DP1, MESA |

---

## 6. VR — Vale Refeição

### Projetos VR
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 6.1 | Visualizar projetos VR | DP1, DP2 |
| 6.2 | Criar novo projeto VR | DP2 |
| 6.3 | Editar projeto VR | DP2 |
| 6.4 | Excluir projeto VR | DP2 |

### Cálculo VR
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 6.5 | Importar PDF de pontos | DP2 |
| 6.6 | Importar escala Excel | DP2 |
| 6.7 | Importar base de colaboradores (CPF/data nascimento) | DP2 |
| 6.8 | Executar cálculo de elegibilidade | DP2 |
| 6.9 | Editar resultado manualmente (dias, valor) | DP2 |
| 6.10 | Remover colaborador do cálculo | DP2 |
| 6.11 | Gerar arquivo PAT (350 posições) | DP2 |
| 6.12 | Gerar arquivo Alterdata (61 posições) | DP2 |
| 6.13 | Gerar Excel de conferência | DP2 |
| 6.14 | Fazer backup/restauração do projeto em JSON | DP2 |

---

## 7. Adicionais Contratuais

### Contratos
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 7.1 | Visualizar contratos | GESTOR, DP2, MESA |
| 7.2 | Criar/editar contrato | GESTOR, DP2, MESA, FINANCEIRO |
| 7.3 | Excluir contrato | GESTOR, DP2, MESA, FINANCEIRO |

### Vínculos
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 7.4 | Visualizar vínculos | GESTOR, DP2, MESA |
| 7.5 | Criar/editar vínculo (colaborador + contrato + período) | DP2, MESA |
| 7.6 | Excluir vínculo | DP2, MESA |

### Calendário
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 7.7 | Visualizar calendário mensal | MESA, DP2 |
| 7.8 | Preencher/editar dias do calendário (trabalhou, folga, falta, férias, etc.) | MESA, DP2 |
| 7.9 | Importar ponto via PDF | DP2, MESA |

### Relatório
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 7.10 | Visualizar relatório de adicionais | DP1, MESA, FINANCEIRO |
| 7.11 | Exportar relatório (Excel/CSV) | DP1, MESA, FINANCEIRO |

---

## 8. Extras (Cash / Coberturas / Pagamentos)

### Lançamentos
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 8.1 | Visualizar extras lançados | MESA, INSPETOR, FINANCEIRO |
| 8.2 | Criar novo extra (falta, substituição, reforço, etc.) | MESA, INSPETOR |
| 8.3 | Editar extra | MESA, INSPETOR |
| 8.4 | Cancelar extra | MESA, INSPETOR |
| 8.5 | Lançar falta via mobile (`/mobile/falta`) | MESA, INSPETOR |

### Categorias de Valor
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 8.6 | Visualizar categorias | MESA, INSPETOR, FINANCEIRO |
| 8.7 | Criar/editar categoria e valor padrão | MESA, INSPETOR, FINANCEIRO |
| 8.8 | Excluir categoria | MESA, FINANCEIRO |

### Recibos
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 8.9 | Visualizar recibos | MESA, DP1, FINANCEIRO |
| 8.10 | Gerar recibo com assinatura digital | MESA, DP1, FINANCEIRO |
| 8.11 | Gerar recibo em papel (modo papel) | MESA, DP1, FINANCEIRO |
| 8.12 | Assinar recibo digitalmente | MESA, DP1, FINANCEIRO |
| 8.13 | Marcar extras como "Pago" | FINANCEIRO |
| 8.14 | Cancelar/excluir recibo | FINANCEIRO |

### Balanço e Comunicação
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 8.15 | Visualizar balanço operacional | TODOS |
| 8.16 | Gerar mensagem de balanço para WhatsApp/e-mail | MESA, INSPETOR |
| 8.17 | Enviar comunicação ao cliente | MESA, INSPETOR |

### Relatórios Extras
| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 8.18 | Visualizar relatório de extras | MESA, FINANCEIRO |
| 8.19 | Exportar relatório de extras | MESA, FINANCEIRO |

---

## 9. Configurações

| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 9.1 | Visualizar configurações | GESTOR |
| 9.2 | Configurar token do e-Contador | DP2 |
| 9.3 | Gerenciar usuários e perfis de acesso | GESTOR |
| 9.4 | Visualizar logs de auditoria | GESTOR |

---

## 10. Módulos Futuros (Placeholders)

| # | Ação | Perfil(is) permitido(s) |
|---|------|-------------------------|
| 10.1 | Escalas de trabalho | |
| 10.2 | Controle de férias | |
| 10.3 | Relatórios gerenciais | |
