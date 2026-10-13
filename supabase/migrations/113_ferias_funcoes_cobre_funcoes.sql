-- Migração 113: matriz explícita de cobertura entre funções (ferias_funcoes.cobre_funcoes)
--
-- Decisão da gestão em 25/09/2026: a hierarquia numérica pura (nível maior
-- cobre menor) NÃO reflete a operação — ex.: ASG cobre ASG e Jardineiro,
-- "nenhuma outra mais"; Porteiro cobre Porteiro e Vigia. A elegibilidade
-- passa a ser explícita: a função A cobre a função B se B estiver em
-- A.cobre_funcoes (cobrir a própria função é sempre implícito).
-- O campo `nivel` permanece (desempate/score de "função superior" na
-- alocação e exibição), mas não decide mais elegibilidade sozinho.
--
-- Aplicada via Management API em 25/09/2026.

ALTER TABLE public.ferias_funcoes
  ADD COLUMN IF NOT EXISTS cobre_funcoes UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.ferias_funcoes.cobre_funcoes IS 'Matriz de cobertura explícita: ids das funções que esta função pode cobrir (além dela mesma, que é implícito). Fonte da elegibilidade RN-02.3.';

-- Seeds conforme regra informada pela gestão (25/09/2026):
-- ASG cobre Jardineiro; Porteiro cobre Vigia; Encarregado cobre Porteiro.
-- O restante é configurável pela aba Férias → Feristas → Catálogo de funções.
UPDATE public.ferias_funcoes f
SET cobre_funcoes = ARRAY(SELECT id FROM public.ferias_funcoes WHERE nome = 'Jardineiro')
WHERE f.nome = 'ASG';

UPDATE public.ferias_funcoes f
SET cobre_funcoes = ARRAY(SELECT id FROM public.ferias_funcoes WHERE nome = 'Vigia')
WHERE f.nome = 'Porteiro';

UPDATE public.ferias_funcoes f
SET cobre_funcoes = ARRAY(SELECT id FROM public.ferias_funcoes WHERE nome = 'Porteiro')
WHERE f.nome = 'Encarregado';
