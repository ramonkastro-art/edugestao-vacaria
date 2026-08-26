-- Execute depois de migration_historico_lotacoes.sql.
-- Reaplicar esta migração atualiza a função existente sem apagar lotações.
-- Permite editar o início de vínculos atuais e históricos e, quando necessário,
-- encerrar ou reabrir um vínculo individual.

CREATE OR REPLACE FUNCTION public.editar_historico_lotacao(
  p_lotacao_id INTEGER,
  p_data_inicio DATE,
  p_data_fim DATE DEFAULT NULL,
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

  IF p_data_inicio IS NULL THEN
    RAISE EXCEPTION 'Informe o início do vínculo';
  END IF;

  IF p_data_inicio > CURRENT_DATE THEN
    RAISE EXCEPTION 'A data de início não pode estar no futuro';
  END IF;

  IF p_data_fim IS NOT NULL AND p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'A data de início não pode ser posterior ao fim do vínculo';
  END IF;

  IF p_data_fim IS NOT NULL AND p_data_fim > CURRENT_DATE THEN
    RAISE EXCEPTION 'O fim do vínculo não pode estar no futuro';
  END IF;

  -- A mesma pessoa pode atuar em escolas diferentes no mesmo período.
  -- A sobreposição inválida é somente na mesma escola.
  IF EXISTS (
    SELECT 1
    FROM public.lotacoes l
    WHERE l.servidor_id = v_lotacao.servidor_id
      AND l.escola_id = v_lotacao.escola_id
      AND l.id <> p_lotacao_id
      AND daterange(l.data_inicio, COALESCE(l.data_fim + 1, 'infinity'::date), '[)')
          && daterange(p_data_inicio, COALESCE(p_data_fim + 1, 'infinity'::date), '[)')
  ) THEN
    RAISE EXCEPTION 'O período informado se sobrepõe a outro vínculo deste servidor nesta escola';
  END IF;

  SELECT name INTO v_escola_nome
  FROM public.escolas
  WHERE id = v_lotacao.escola_id;

  UPDATE public.lotacoes
  SET
    data_inicio = p_data_inicio,
    data_fim = p_data_fim,
    principal = CASE
      WHEN p_data_fim IS NULL THEN COALESCE(v_lotacao.principal, false)
      ELSE false
    END,
    motivo_saida = CASE
      WHEN p_data_fim IS NULL THEN NULL
      ELSE COALESCE(NULLIF(trim(p_motivo), ''), v_lotacao.motivo_saida, 'Vínculo histórico encerrado')
    END
  WHERE id = p_lotacao_id;

  RETURN jsonb_build_object(
    'id', p_lotacao_id,
    'servidor_id', v_lotacao.servidor_id,
    'escola_id', v_lotacao.escola_id,
    'escola_nome', v_escola_nome,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim,
    'ativo', p_data_fim IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_historico_lotacao(INTEGER, DATE, DATE, TEXT) TO authenticated;
