-- EDUGESTÃO VACARIA — Inclusão manual de histórico de lotações
-- Execute depois de migration_historico_lotacoes.sql.
-- Esta migração não altera nem remove lotações existentes.

CREATE OR REPLACE FUNCTION public.adicionar_historico_lotacao(
  p_servidor_id UUID,
  p_escola_id INTEGER,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_lotacao_id INTEGER;
  v_escola_nome TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.servidores WHERE id = p_servidor_id) THEN
    RAISE EXCEPTION 'Servidor não encontrado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.escolas WHERE id = p_escola_id) THEN
    RAISE EXCEPTION 'Escola não encontrada';
  END IF;

  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    RAISE EXCEPTION 'Informe o início e o fim do vínculo histórico';
  END IF;

  IF p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'A data de início não pode ser posterior ao fim do vínculo';
  END IF;

  IF p_data_fim > CURRENT_DATE THEN
    RAISE EXCEPTION 'O vínculo histórico deve estar encerrado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lotacoes l
    WHERE l.servidor_id = p_servidor_id
      AND daterange(l.data_inicio, COALESCE(l.data_fim + 1, 'infinity'::date), '[)')
          && daterange(p_data_inicio, p_data_fim + 1, '[)')
  ) THEN
    RAISE EXCEPTION 'O período informado se sobrepõe a outro vínculo deste servidor';
  END IF;

  SELECT name INTO v_escola_nome
  FROM public.escolas
  WHERE id = p_escola_id;

  INSERT INTO public.lotacoes (
    servidor_id, escola_id, principal, data_inicio, data_fim, motivo_saida
  )
  VALUES (
    p_servidor_id,
    p_escola_id,
    false,
    p_data_inicio,
    p_data_fim,
    COALESCE(NULLIF(trim(p_motivo), ''), 'Histórico informado manualmente')
  )
  RETURNING id INTO v_lotacao_id;

  RETURN jsonb_build_object(
    'id', v_lotacao_id,
    'servidor_id', p_servidor_id,
    'escola_id', p_escola_id,
    'escola_nome', v_escola_nome,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adicionar_historico_lotacao(UUID, INTEGER, DATE, DATE, TEXT) TO authenticated;
