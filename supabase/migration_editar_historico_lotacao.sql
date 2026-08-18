-- EDUGESTÃO VACARIA — Edição segura do histórico de lotações
-- Execute depois de migration_historico_lotacoes.sql.
-- Esta função permite encerrar um vínculo que ainda aparece como Atual
-- sem apagar a escola do histórico.

CREATE OR REPLACE FUNCTION public.editar_historico_lotacao(
  p_lotacao_id INTEGER,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_lotacao public.lotacoes%ROWTYPE;
  v_escola_nome TEXT;
BEGIN
  SELECT *
  INTO v_lotacao
  FROM public.lotacoes
  WHERE id = p_lotacao_id
  FOR UPDATE;

  IF v_lotacao.id IS NULL THEN
    RAISE EXCEPTION 'Vínculo de lotação não encontrado';
  END IF;

  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    RAISE EXCEPTION 'Informe o início e o fim do vínculo';
  END IF;

  IF p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'A data de início não pode ser posterior ao fim do vínculo';
  END IF;

  IF p_data_fim > CURRENT_DATE THEN
    RAISE EXCEPTION 'O fim do vínculo não pode estar no futuro';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lotacoes l
    WHERE l.servidor_id = v_lotacao.servidor_id
      AND l.id <> p_lotacao_id
      AND daterange(l.data_inicio, COALESCE(l.data_fim + 1, 'infinity'::date), '[)')
          && daterange(p_data_inicio, p_data_fim + 1, '[)')
  ) THEN
    RAISE EXCEPTION 'O período informado se sobrepõe a outro vínculo deste servidor';
  END IF;

  SELECT name INTO v_escola_nome
  FROM public.escolas
  WHERE id = v_lotacao.escola_id;

  UPDATE public.lotacoes
  SET
    data_inicio = p_data_inicio,
    data_fim = p_data_fim,
    principal = false,
    motivo_saida = COALESCE(NULLIF(trim(p_motivo), ''), 'Vínculo histórico encerrado')
  WHERE id = p_lotacao_id;

  RETURN jsonb_build_object(
    'id', p_lotacao_id,
    'servidor_id', v_lotacao.servidor_id,
    'escola_id', v_lotacao.escola_id,
    'escola_nome', v_escola_nome,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_historico_lotacao(INTEGER, DATE, DATE, TEXT) TO authenticated;
