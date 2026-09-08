-- Estrutura adicional para detalhar a efetividade mensal.
-- Não remove nem altera registros existentes.

ALTER TABLE public.efetividade
  ADD COLUMN IF NOT EXISTS dias_ausencia integer;

ALTER TABLE public.efetividade
  ADD COLUMN IF NOT EXISTS detalhes_ocorrencia text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'efetividade_dias_ausencia_check'
      AND conrelid = 'public.efetividade'::regclass
  ) THEN
    ALTER TABLE public.efetividade
      ADD CONSTRAINT efetividade_dias_ausencia_check
      CHECK (dias_ausencia IS NULL OR dias_ausencia >= 0);
  END IF;
END $$;
