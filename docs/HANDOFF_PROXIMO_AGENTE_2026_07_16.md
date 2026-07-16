# Handoff para o Próximo Agente — 16/07/2026

> Último trabalho: importação de ocorrências históricas do sistema antigo, importação de ocorrências da inspetoria e ajustes de UX na tela de Ocorrências
> Estado: ✅ importações concluídas (973 ocorrências no banco), busca e detalhes ajustados para ocorrências do placeholder

---

## ✅ O que foi feito

### 1. Importação de ocorrências históricas do sistema antigo

Arquivo fonte: `public/Ocorrências de advertência e suspensão para CORH em sem cpf 15jul26.xlsx`

Script principal: `scripts/importar-ocorrencias-antigas.py`

- **Total importado:** 961 ocorrências históricas
  - 465 vinculadas a colaboradores existentes no CORH
  - 496 vinculadas ao colaborador placeholder
  - 9 casos de múltiplos matches (vinculados ao primeiro encontrado)
- Criado colaborador placeholder: `OCORRENCIAS HISTORICAS - NAO IDENTIFICADO` (matrícula `999999`, status `Inativo`)
- Nome original do colaborador na planilha preservado no campo `colaborador_nome`
- Número original da ocorrência preservado no `titulo` (ex: `[24898] Falta ao serviço sem justificativa`) e na `descricao`
- Status de todas as ocorrências importadas: `Ativa`
- Correções aplicadas no script:
  - Encoding e acentuação
  - Limpeza de locais (removido `PORTARIA`, `LIMPEZA`, `ENCARREGADO`, etc.)
  - Correção ortográfica com `pyspellchecker` + dicionário customizado pt-BR

Registro detalhado: `docs/agentes/registro_2026-07-16_importacao_ocorrencias_antigas.md`

### 2. Importação de ocorrências da inspetoria

Arquivo fonte: `public/ocorrencias_inspetoria_classificado.xlsx` (aba `Ocorrências`)

Script principal: `scripts/importar-ocorrencias-inspetoria.py`

- **Total importado:** 12 ocorrências da inspetoria
  - 3 vinculadas a colaboradores existentes no CORH
  - 9 vinculadas ao colaborador placeholder
- Número original da ocorrência preservado no `titulo` (ex: `[30853] Atraso no posto de trabalho`)
- Macro grupo e tipo mapeados para o formato do sistema (`1. Jornada e Ponto`, `8. Administrativas`, etc.)
- Status de todas as ocorrências importadas: `Ativa`

Registro detalhado: `docs/agentes/registro_2026-07-16_importacao_ocorrencias_inspetoria.md`

### 3. Reassociação de ocorrências do placeholder

Após varredura dos 496 nomes não identificados da importação de 15/07/2026, foram reassociadas ao cadastro as ocorrências do placeholder com match exato ou alto-token.

- **Ocorrências no placeholder analisadas:** 505
- **Reassociadas:** 1
  - `PAULO JOSE DA SILVA` → `JOSE PAULO SILVA DE ARAUJO` (matrícula `000658`, status `Inativo`)
- **Planilha de revisão gerada:** `dados-locais/revisao_496_nomes.xlsx`
  - Contém matches sugeridos organizados por nível de confiança (Exato, Alto - Tokens, Alto - Primeiro+Último, Médio - Substring, Médio - Similaridade, Não encontrado)
  - Colunas `acao` e `observacao` em branco para revisão manual

Registro detalhado: `docs/agentes/registro_2026-07-16_reassociacao_placeholder.md`

### 4. Ajustes na tela de Ocorrências

Arquivos alterados:
- `src/hooks/useOcorrencias.ts`
- `src/pages/rh/OcorrenciasPage.tsx`
- `src/pages/rh/OcorrenciaDetailPage.tsx`

Mudanças:
- A busca textual agora procura também em `colaborador_nome` e `descricao`, permitindo encontrar ocorrências históricas vinculadas ao placeholder.
- Reorganização dos filtros em 3 linhas:
  - **1ª linha:** campo de busca textual (destacado em âmbar) + filtro por colaborador cadastrado
  - **Dica informativa** abaixo da 1ª linha explicando a diferença entre os dois campos
  - **2ª linha:** tipo, status, empresa, grupo e gravidade
  - **3ª linha:** período + botão Aplicar
- Página de detalhes ajustada para exibir o nome original (`colaborador_nome`) e um aviso quando a ocorrência pertence ao placeholder.

### 5. Limpeza de ocorrências de teste

Deletadas 4 ocorrências de teste:
- JOAO BATISTA DA SILVA — "BRIGOU KKKKKKKKKKKK"
- LUCIANO SANTANA DA FONSECA PEREIRA — "ddddddddd"
- MARIA IZABEL DA ROCHA OLIVEIRA ARAUJO — "jjjjjjjjjjjjjjjj"
- MARCELO DE OLIVEIRA NOYA — "dddddddd"

Total de ocorrências no banco após as importações e reassociação: **973**
- Ocorrências vinculadas ao placeholder após reassociação: **504**

### 6. Ajuste na tela de Ocorrências para colaboradores inativos/não cadastrados

Problema: a lista de ocorrências mostrava **N/A** no nome do colaborador quando ele estava inativo ou não cadastrado no CORH, mesmo com o nome salvo na ocorrência.

Solução aplicada:
- `src/pages/rh/OcorrenciasPage.tsx`: a coluna "Colaborador" agora usa `o.colaborador?.nome_completo || o.colaborador_nome || 'N/A'`, e mostra "Colaborador inativo/não cadastrado" quando o join não trouxe o colaborador.
- `src/pages/rh/OcorrenciaDetailPage.tsx`: a página de detalhes não exige mais que o colaborador exista no banco para abrir; exibe o nome salvo na ocorrência e um aviso amarelo quando o colaborador não é encontrado ou é o placeholder.
- Botão "Gerar PDF" só aparece quando há um colaborador carregado no banco.

Arquivos alterados:
- `src/pages/rh/OcorrenciasPage.tsx`
- `src/pages/rh/OcorrenciaDetailPage.tsx`

### 7. Importação de ocorrências de faltas

Arquivo fonte: `public/OCO_Funcionarios_160726 FALTAS tratada_final.xlsx`

Script principal: `scripts/importar-ocorrencias-faltas.py`

- **Total na planilha:** 4.378 ocorrências
- **Inseridas no banco:** 4.372 ocorrências
  - 1.907 vinculadas a colaboradores existentes no CORH
  - 2.465 vinculadas ao colaborador placeholder (`OCORRENCIAS HISTORICAS - NAO IDENTIFICADO`)
  - 6 ignoradas por múltiplo match (não importadas para evitar vinculação errada)
- Mapeamento de Macro/Tipo:
  - `Falta Injustificada`, `Falta Justificada (atestado)`, `Falta Abonada` → `1. Jornada e Ponto`
  - `Licença Luto`, `Licença Casamento`, `Licença Médica (acima 15 dias é INSS)`, `Licença Paternidade` → `4. Afastamentos e Licenças`
- Coluna `Matrícula` ignorada conforme orientação
- `data_ocorrencia` = `data_hora_ocorrido` = data da planilha
- Número original da ocorrência (`Seq`) preservado no `titulo` e na `descricao`
- Origem: `sistema antigo`
- Inconsistências Macro/Tipo: 0

### 8. Backup do banco de dados (Supabase)

- Planilha de Free Plan não inclui backups agendados — será necessário upgrade para Pro para backups automáticos.
- Foi criado um script de backup manual: `scripts/backup_supabase_free.sql`
- O script foi executado com sucesso e gerou tabelas `_backup_2026_07_16` no banco.

### 9. Build

- `npm run build` ✅ executado com sucesso após todos os ajustes.

**Total de ocorrências no banco ao final do dia:** **5.345**
- Vinculadas ao placeholder: **2.969**

---

## 🚀 Próximos passos sugeridos

1. **Reassociação futura de ocorrências do placeholder:**
   - Planilha de revisão disponível: `dados-locais/revisao_496_nomes.xlsx`
   - Após revisão, aplicar reassociações com o script `scripts/reassociar-placeholder-exato-token.py` (ajustar conforme os níveis de confiança aprovados) ou criar um script específico para os matches aprovados.
   - Instruções nos registros `docs/agentes/registro_2026-07-16_importacao_ocorrencias_antigas.md`, `docs/agentes/registro_2026-07-16_importacao_ocorrencias_inspetoria.md` e `docs/agentes/registro_2026-07-16_reassociacao_placeholder.md`.
2. **Revisar os 9 casos de múltiplos matches** (mais de um colaborador com o mesmo nome) para garantir que foram vinculados ao colaborador correto.
3. **Verificar no sistema** se a busca e os detalhes das ocorrências históricas estão funcionando corretamente.
4. Continuar a aplicação do design system nas páginas restantes (ver handoff anterior).

---

## ⚠️ Atenções

- O Vite dev server pode apresentar erro 504 ao carregar módulos lazy em desenvolvimento. Se isso ocorrer, reiniciar o servidor com `npm run dev` geralmente resolve.
- O colaborador placeholder (`OCORRENCIAS HISTORICAS - NAO IDENTIFICADO`, matrícula `999999`) não deve ser excluído enquanto houver ocorrências históricas vinculadas a ele.
- Regras de negócio validadas estão em `docs/REGRAS_NEGOCIO.md`.

---

## 📁 Arquivos importantes desta tarefa

- `scripts/importar-ocorrencias-antigas.py`
- `scripts/importar-ocorrencias-inspetoria.py`
- `scripts/varredura-496-nomes.py`
- `scripts/gerar-planilha-revisao-496.py`
- `scripts/reassociar-placeholder-exato-token.py`
- `src/hooks/useOcorrencias.ts`
- `src/pages/rh/OcorrenciasPage.tsx`
- `src/pages/rh/OcorrenciaDetailPage.tsx`
- `docs/agentes/registro_2026-07-16_importacao_ocorrencias_antigas.md`
- `docs/agentes/registro_2026-07-16_importacao_ocorrencias_inspetoria.md`
- `docs/agentes/registro_2026-07-16_reassociacao_placeholder.md`
- `docs/agentes/relatorio_varredura_496_nomes.md`
- `docs/HANDOFF_PROXIMO_AGENTE_2026_07_16.md` (este arquivo)
