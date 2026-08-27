-- Substituição "sem adicional" (controle interno — decisão da gestão, 27/08/2026):
-- permite registrar um substituto que cobre o posto mas NÃO recebe o adicional
-- (ex.: pago via extra "por fora"). O dia continua saindo da conta do titular
-- (a transferência acontece normalmente), mas não é pago a ninguém — os dias se
-- perdem para ambos. O substituto marcado assim não aparece no relatório final.
-- O flag é definido apenas na criação da substituição (para mudar, remove-se e
-- recria). Sem backfill: registros existentes ficam com false (comportamento atual).
alter table public.calendario_adicionais
  add column if not exists substituto_sem_adicional boolean not null default false;
