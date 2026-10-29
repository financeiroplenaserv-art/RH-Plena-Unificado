-- 165_vt_bilhetes_cartao_integracao.sql
-- Decisão da gestora em 27/10/2026: no VT, além do valor do dia, é preciso
-- saber QUAL CARTÃO a pessoa precisa ter (a carga é feita naquele cartão) e
-- SE O TRAJETO DEPENDE DE INTEGRAÇÃO (se depende e o cartão dela não tem
-- integração, o valor carregado não basta na prática). Regras de tarifa
-- ensinadas por ela: BUN Niterói R$ 5,60/perna com integração 2 conduções/1h
-- (R$ 11,20/dia); BUI R$ 9,40/perna, teto mesmo com 2 ônibus, entre cidades,
-- cartão precisa ser validado (R$ 18,80/dia); "Passagem São Gonçalo" R$ 7,10/
-- perna linha direta SG→Niterói (R$ 14,20/dia, sem integração); "Sem
-- integração BU" R$ 32,00/dia = paga tudo cheio (sem cartão validado); RJ
-- varia (CENTRO RJ R$ 10,00; CARTÃO JAE RJ R$ 14,00; TREM R$ 15,80; ÔNIBUS E
-- VLT R$ 16,00; ÔNIBUS+TREM+METRÔ R$ 28,80).
--
-- **Preparada, NÃO aplicada** — a gestora aplica via Management API (script
-- de ARQUIVO, nunca inline — regra da migration 131: SQL com acento só via
-- arquivo UTF-8). **Aplicar ANTES do deploy do frontend desta mudança** — o
-- form "Nova vigência" da aba Bilhetes passa a gravar as colunas novas.
--
--  A) vt_bilhetes ganha cartao_necessario ('bun'/'bui'/'jae'/'comum'; NULL =
--     bilhete ainda não classificado — sem aviso na tela) e usa_integracao
--     (boolean, padrão false). NULL é dado válido: a classificação é
--     preenchida aqui para os 9 bilhetes do catálogo e, nos bilhetes novos,
--     pelo form da aba Bilhetes.
--  B) Seeds por NOME EXATO do bilhete (o catálogo é nomeado — plano §2d), com
--     contagem de segurança: o bloco aborta se algum UPDATE não achar
--     exatamente 1 linha (protege contra nome divergente ou vigência
--     duplicada no momento da aplicação).
--  C) colaboradores.vt_tipo_cartao: o CHECK da migration 155 aceita
--     'bun'/'bui'/'comum' — recriado incluindo 'jae' (cartão do RJ), que já
--     entra no select da aba Colaboradores. Drop/add idempotente.
--
-- Sem tabela nova — sem GRANT. Idempotente: colunas com IF NOT EXISTS,
-- constraints com DROP IF EXISTS + ADD, seeds por UPDATE (rodar 2× grava os
-- mesmos valores).

begin;

-- ============================================================
-- A) Colunas novas em vt_bilhetes
-- ============================================================
ALTER TABLE public.vt_bilhetes
  ADD COLUMN IF NOT EXISTS cartao_necessario text;
ALTER TABLE public.vt_bilhetes
  DROP CONSTRAINT IF EXISTS vt_bilhetes_cartao_necessario_check;
ALTER TABLE public.vt_bilhetes
  ADD CONSTRAINT vt_bilhetes_cartao_necessario_check
  CHECK (cartao_necessario IS NULL OR cartao_necessario IN ('bun', 'bui', 'jae', 'comum'));
ALTER TABLE public.vt_bilhetes
  ADD COLUMN IF NOT EXISTS usa_integracao boolean NOT NULL DEFAULT false;

-- ============================================================
-- B) Seeds: classificação dos 9 bilhetes do catálogo (nome exato da 155).
--    Aborta se algum UPDATE não casar com exatamente 1 linha.
-- ============================================================
DO $$
DECLARE
  r record;
  afetadas integer;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('BU NITERÓI', 'bun', true),
      ('BILHETE ÚNICO INTERMUNICIPAL', 'bui', true),
      ('PASSAGEM SÃO GONÇALO', 'comum', false),
      ('SEM INTEGRAÇÃO BU', 'comum', false),
      ('TREM', 'comum', false),
      ('CENTRO RJ', 'jae', false),
      ('CARTÃO JAE RJ', 'jae', true),
      ('ÔNIBUS E VLT - INTEGRAÇÃO RJ', 'jae', true),
      ('ÔNIBUS, TREM E METRÔ', 'comum', false)
    ) AS s(nome, cartao, integracao)
  LOOP
    UPDATE public.vt_bilhetes
       SET cartao_necessario = r.cartao,
           usa_integracao = r.integracao
     WHERE nome = r.nome;
    GET DIAGNOSTICS afetadas = ROW_COUNT;
    IF afetadas <> 1 THEN
      RAISE EXCEPTION 'Seed do bilhete "%" casou com % linha(s) — esperado exatamente 1', r.nome, afetadas;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- C) colaboradores.vt_tipo_cartao passa a aceitar 'jae' (cartão do RJ)
-- ============================================================
ALTER TABLE public.colaboradores
  DROP CONSTRAINT IF EXISTS colaboradores_vt_tipo_cartao_check;
ALTER TABLE public.colaboradores
  ADD CONSTRAINT colaboradores_vt_tipo_cartao_check
  CHECK (vt_tipo_cartao IS NULL OR vt_tipo_cartao IN ('bun', 'bui', 'jae', 'comum'));

commit;
