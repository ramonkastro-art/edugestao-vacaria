-- Proteção não destrutiva do histórico de lotações.
-- Execute com uma conta administrativa após migration_historico_lotacoes.sql.
-- A partir desta migração, servidores e escolas com lotações não podem ser
-- removidos fisicamente; a interface deve inativar servidores.

ALTER TABLE public.lotacoes
  DROP CONSTRAINT IF EXISTS lotacoes_servidor_id_fkey;

ALTER TABLE public.lotacoes
  ADD CONSTRAINT lotacoes_servidor_id_fkey
  FOREIGN KEY (servidor_id) REFERENCES public.servidores(id) ON DELETE RESTRICT;

ALTER TABLE public.lotacoes
  DROP CONSTRAINT IF EXISTS lotacoes_escola_id_fkey;

ALTER TABLE public.lotacoes
  ADD CONSTRAINT lotacoes_escola_id_fkey
  FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE RESTRICT;
