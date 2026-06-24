-- Migração 020: Atualiza valores padrão das categorias de extras

UPDATE public.categorias_extras
SET valor_padrao = 110.00
WHERE nome = 'ASG 7:20 hs';

UPDATE public.categorias_extras
SET valor_padrao = 130.00
WHERE nome = 'ASG 12×36';

UPDATE public.categorias_extras
SET valor_padrao = 145.00
WHERE nome = 'Porteiro 12×36';

UPDATE public.categorias_extras
SET valor_padrao = 140.00
WHERE nome = 'ASG Rio';
