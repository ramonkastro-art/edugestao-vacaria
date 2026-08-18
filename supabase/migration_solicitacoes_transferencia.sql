-- EDUGESTÃO VACARIA — Solicitações de transferência
-- Execute depois do schema base e das migrações de histórico.
-- Solicitações são administrativas e não alteram lotações automaticamente.

CREATE TABLE IF NOT EXISTS public.solicitacoes_transferencia (
  id                  BIGSERIAL PRIMARY KEY,
  servidor_id         UUID NOT NULL REFERENCES public.servidores(id) ON DELETE CASCADE,
  escola_origem_id   INTEGER REFERENCES public.escolas(id) ON DELETE SET NULL,
  escola_destino_id  INTEGER NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
  data_pedido        DATE NOT NULL DEFAULT CURRENT_DATE,
  status             TEXT NOT NULL DEFAULT 'Pendente'
                       CHECK (status IN ('Pendente', 'Aprovado', 'Atendido', 'Cancelado')),
  data_atendimento   DATE,
  observacoes        TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_transferencia_servidor
  ON public.solicitacoes_transferencia(servidor_id, data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_transferencia_status
  ON public.solicitacoes_transferencia(status, data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_transferencia_destino
  ON public.solicitacoes_transferencia(escola_destino_id);

ALTER TABLE public.solicitacoes_transferencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitacoes_transferencia_admin" ON public.solicitacoes_transferencia;
CREATE POLICY "solicitacoes_transferencia_admin"
  ON public.solicitacoes_transferencia
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('secretaria', 'rh')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('secretaria', 'rh')
  ));

DROP TRIGGER IF EXISTS solicitacoes_transferencia_updated_at ON public.solicitacoes_transferencia;
CREATE TRIGGER solicitacoes_transferencia_updated_at
  BEFORE UPDATE ON public.solicitacoes_transferencia
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
