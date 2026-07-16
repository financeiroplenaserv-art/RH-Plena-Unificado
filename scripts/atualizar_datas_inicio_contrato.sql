-- Atualiza a data de início do contrato dos departamentos já cadastrados.
-- Substitua os exemplos abaixo pelos dados reais e adicione quantas linhas forem necessárias.
-- Formato da data: AAAA-MM-DD

UPDATE public.departamentos
SET data_inicio_contrato = '2024-01-15'
WHERE nome = 'Nome do departamento 1';

UPDATE public.departamentos
SET data_inicio_contrato = '2023-06-01'
WHERE nome = 'Nome do departamento 2';

-- Exemplo usando nome_curto:
UPDATE public.departamentos
SET data_inicio_contrato = '2025-03-10'
WHERE nome_curto = 'Nome curto do departamento 3';
