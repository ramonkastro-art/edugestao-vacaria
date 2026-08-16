-- EDUGESTÃO VACARIA — Histórico de lotações
-- Migração não destrutiva. Execute no Supabase SQL Editor após realizar o backup
-- recomendado do banco. Nenhum registro existente de lotação é apagado.

ALTER TABLE public.lotacoes
  ADD COLUMN IF NOT EXISTS data_inicio DATE;

ALTER TABLE public.lotacoes
  ADD COLUMN IF NOT EXISTS data_fim DATE;

ALTER TABLE public.lotacoes
  ADD COLUMN IF NOT EXISTS motivo_saida TEXT;

-- Vínculos existentes passam a ter como início a data de criação original.
UPDATE public.lotacoes
SET data_inicio = COALESCE(data_inicio, created_at::date, CURRENT_DATE)
WHERE data_inicio IS NULL;

ALTER TABLE public.lotacoes
  ALTER COLUMN data_inicio SET DEFAULT CURRENT_DATE;

ALTER TABLE public.lotacoes
  ALTER COLUMN data_inicio SET NOT NULL;

-- Permite que o mesmo servidor retorne a uma escola em outro período,
-- mantendo o histórico encerrado e garantindo apenas um vínculo ativo por escola.
ALTER TABLE public.lotacoes
  DROP CONSTRAINT IF EXISTS lotacoes_servidor_id_escola_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS lotacoes_ativas_unicas_idx
  ON public.lotacoes (servidor_id, escola_id)
  WHERE data_fim IS NULL;

CREATE INDEX IF NOT EXISTS idx_lotacoes_historico_servidor
  ON public.lotacoes (servidor_id, data_inicio DESC, data_fim DESC);

-- Mantém o carimbo de atualização dos vínculos quando a lotação é encerrada.
CREATE OR REPLACE FUNCTION public.touch_lotacao_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.lotacoes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DROP TRIGGER IF EXISTS lotacoes_updated_at ON public.lotacoes;
CREATE TRIGGER lotacoes_updated_at
  BEFORE UPDATE ON public.lotacoes
  FOR EACH ROW EXECUTE PROCEDURE public.touch_lotacao_updated_at();

-- Sincroniza o formulário de lotações sem apagar vínculos antigos.
CREATE OR REPLACE FUNCTION public.sincronizar_lotacoes(
  p_servidor_id UUID,
  p_escola_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  p_data_referencia DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_escola_ids INTEGER[] := COALESCE(p_escola_ids, ARRAY[]::INTEGER[]);
  v_atualizadas INTEGER := 0;
  v_inseridas INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.servidores WHERE id = p_servidor_id
  ) THEN
    RAISE EXCEPTION 'Servidor não encontrado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_escola_ids) AS pedido(escola_id)
    LEFT JOIN public.escolas e ON e.id = pedido.escola_id
    WHERE e.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Uma ou mais escolas informadas não existem';
  END IF;

  IF p_data_referencia IS NULL THEN
    RAISE EXCEPTION 'A data de referência é obrigatória';
  END IF;

  UPDATE public.lotacoes l
  SET
    data_fim = p_data_referencia,
    motivo_saida = COALESCE(l.motivo_saida, 'Alteração de lotação'),
    principal = false
  WHERE l.servidor_id = p_servidor_id
    AND l.data_fim IS NULL
    AND NOT (l.escola_id = ANY(v_escola_ids));

  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;

  INSERT INTO public.lotacoes (servidor_id, escola_id, principal, data_inicio)
  SELECT p_servidor_id, pedido.escola_id,
         pedido.ordem = 1,
         p_data_referencia
  FROM unnest(v_escola_ids) WITH ORDINALITY AS pedido(escola_id, ordem)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.lotacoes l
    WHERE l.servidor_id = p_servidor_id
      AND l.escola_id = pedido.escola_id
      AND l.data_fim IS NULL
  );

  GET DIAGNOSTICS v_inseridas = ROW_COUNT;

  UPDATE public.lotacoes l
  SET principal = (l.escola_id = v_escola_ids[1])
  WHERE l.servidor_id = p_servidor_id
    AND l.data_fim IS NULL
    AND l.escola_id = ANY(v_escola_ids);

  RETURN jsonb_build_object(
    'servidor_id', p_servidor_id,
    'encerradas', v_atualizadas,
    'incluidas', v_inseridas,
    'data_referencia', p_data_referencia
  );
END;
$$;

-- Transfere uma lotação atual para outra escola em uma operação única.
CREATE OR REPLACE FUNCTION public.transferir_servidor_escola(
  p_servidor_id UUID,
  p_escola_origem_id INTEGER,
  p_escola_destino_id INTEGER,
  p_data_transferencia DATE DEFAULT CURRENT_DATE,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_origem public.lotacoes%ROWTYPE;
  v_destino_nome TEXT;
  v_destino_principal BOOLEAN;
BEGIN
  IF p_escola_origem_id = p_escola_destino_id THEN
    RAISE EXCEPTION 'A escola de destino deve ser diferente da escola atual';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.escolas WHERE id = p_escola_origem_id)
     OR NOT EXISTS (SELECT 1 FROM public.escolas WHERE id = p_escola_destino_id) THEN
    RAISE EXCEPTION 'Escola de origem ou destino não encontrada';
  END IF;

  SELECT l.*
  INTO v_origem
  FROM public.lotacoes l
  WHERE l.servidor_id = p_servidor_id
    AND l.escola_id = p_escola_origem_id
    AND l.data_fim IS NULL
  FOR UPDATE;

  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'O servidor não possui vínculo ativo com a escola de origem';
  END IF;

  IF v_origem.data_inicio > p_data_transferencia THEN
    RAISE EXCEPTION 'A data da transferência não pode ser anterior ao início do vínculo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lotacoes
    WHERE servidor_id = p_servidor_id
      AND escola_id = p_escola_destino_id
      AND data_fim IS NULL
  ) THEN
    RAISE EXCEPTION 'O servidor já possui vínculo ativo com a escola de destino';
  END IF;

  SELECT name INTO v_destino_nome FROM public.escolas WHERE id = p_escola_destino_id;
  v_destino_principal := COALESCE(v_origem.principal, false);

  UPDATE public.lotacoes
  SET
    data_fim = p_data_transferencia,
    principal = false,
    motivo_saida = COALESCE(NULLIF(trim(p_motivo), ''), 'Transferência de escola')
  WHERE id = v_origem.id;

  IF v_destino_principal THEN
    UPDATE public.lotacoes
    SET principal = false
    WHERE servidor_id = p_servidor_id
      AND data_fim IS NULL;
  END IF;

  INSERT INTO public.lotacoes (servidor_id, escola_id, principal, data_inicio)
  VALUES (p_servidor_id, p_escola_destino_id, v_destino_principal, p_data_transferencia);

  RETURN jsonb_build_object(
    'servidor_id', p_servidor_id,
    'origem_id', p_escola_origem_id,
    'destino_id', p_escola_destino_id,
    'destino_nome', v_destino_nome,
    'data_transferencia', p_data_transferencia
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_lotacoes(UUID, INTEGER[], DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transferir_servidor_escola(UUID, INTEGER, INTEGER, DATE, TEXT) TO authenticated;


-- Adiciona uma passagem histórica informada manualmente, sem alterar a lotação atual.
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
