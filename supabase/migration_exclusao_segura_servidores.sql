-- Exclusão definitiva protegida de servidores.
-- Execute depois de migration_security_hardening.sql e
-- migration_solicitacoes_transferencia.sql.
-- A função não apaga registros com vínculos, histórico, efetividade ou pedidos.

CREATE TABLE IF NOT EXISTS public.auditoria_exclusao_servidores (
  id            BIGSERIAL PRIMARY KEY,
  servidor_id   UUID NOT NULL,
  servidor_nome TEXT NOT NULL,
  excluido_por  UUID NOT NULL,
  excluido_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_exclusao_servidor
  ON public.auditoria_exclusao_servidores(servidor_id, excluido_em DESC);

ALTER TABLE public.auditoria_exclusao_servidores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_exclusao_admin_read" ON public.auditoria_exclusao_servidores;
CREATE POLICY "auditoria_exclusao_admin_read"
  ON public.auditoria_exclusao_servidores
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.auditoria_exclusao_servidores FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.auditoria_exclusao_servidores TO authenticated;

CREATE OR REPLACE FUNCTION public.excluir_servidor_definitivo(p_servidor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servidor public.servidores%ROWTYPE;
  v_lotacoes INTEGER;
  v_efetividade INTEGER;
  v_solicitacoes INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas Secretaria ou RH podem excluir servidores';
  END IF;

  SELECT *
  INTO v_servidor
  FROM public.servidores
  WHERE id = p_servidor_id
  FOR UPDATE;

  IF v_servidor.id IS NULL THEN
    RAISE EXCEPTION 'Servidor não encontrado';
  END IF;

  SELECT COUNT(*) INTO v_lotacoes
  FROM public.lotacoes
  WHERE servidor_id = p_servidor_id;

  SELECT COUNT(*) INTO v_efetividade
  FROM public.efetividade
  WHERE servidor_id = p_servidor_id;

  IF to_regclass('public.solicitacoes_transferencia') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.solicitacoes_transferencia WHERE servidor_id = $1'
      INTO v_solicitacoes
      USING p_servidor_id;
  END IF;

  IF v_lotacoes > 0 OR v_efetividade > 0 OR v_solicitacoes > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir: o servidor possui % lotação(ões), % registro(s) de efetividade e % solicitação(ões). Preserve o histórico e use Inativar.', v_lotacoes, v_efetividade, v_solicitacoes;
  END IF;

  INSERT INTO public.auditoria_exclusao_servidores (
    servidor_id, servidor_nome, excluido_por
  )
  VALUES (
    v_servidor.id, v_servidor.nome, auth.uid()
  );

  DELETE FROM public.servidores
  WHERE id = p_servidor_id;

  RETURN jsonb_build_object(
    'id', v_servidor.id,
    'nome', v_servidor.nome,
    'excluido_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_servidor_definitivo(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_servidor_definitivo(UUID) TO authenticated;

-- Impede exclusão direta pelo cliente. A única rota é a RPC acima, que valida
-- permissão, dependências e grava auditoria antes de excluir.
REVOKE DELETE ON public.servidores FROM authenticated, anon, PUBLIC;
