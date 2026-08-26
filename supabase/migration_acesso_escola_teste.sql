-- Acesso individual por escola — primeiro teste.
-- Execute com o usuário administrador no Supabase SQL Editor.
-- Não contém senha, service_role ou e-mail pessoal.
-- Pré-requisito: migration_acesso_por_escola.sql aplicada.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS exigir_troca_senha BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.concluir_troca_senha()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  UPDATE public.user_profiles
  SET exigir_troca_senha = FALSE
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de acesso não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.concluir_troca_senha() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.concluir_troca_senha() TO authenticated;

-- Função administrativa usada somente no SQL Editor para vincular uma conta
-- já existente à escola. Não é concedida a authenticated nem a anon.
CREATE OR REPLACE FUNCTION public.configurar_diretora_escola(
  p_email TEXT,
  p_escola_nome TEXT,
  p_nome TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_escola_id INTEGER;
  v_escola_nome TEXT;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado no Auth. Crie ou convide a conta antes de vincular.';
  END IF;

  SELECT id, name INTO v_escola_id, v_escola_nome
  FROM public.escolas
  WHERE upper(trim(name)) = upper(trim(p_escola_nome))
  LIMIT 1;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'Escola não encontrada: %', p_escola_nome;
  END IF;

  INSERT INTO public.user_profiles (id, nome, role, escola_id, exigir_troca_senha)
  VALUES (
    v_user_id,
    COALESCE(NULLIF(trim(p_nome), ''), 'Diretora — ' || v_escola_nome),
    'diretor',
    v_escola_id,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome,
      role = 'diretor',
      escola_id = EXCLUDED.escola_id,
      exigir_troca_senha = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.configurar_diretora_escola(TEXT, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
