-- Execute no Supabase SQL Editor para bancos criados antes do campo CPF.
-- A operação é idempotente e não altera os registros existentes.

ALTER TABLE public.servidores
  ADD COLUMN IF NOT EXISTS cpf TEXT;
