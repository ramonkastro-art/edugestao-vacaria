-- Acesso descentralizado por unidade escolar.
-- Pré-requisitos: schema_v2.sql, migration_security_hardening.sql
-- e migration_rpc_security_hardening.sql já aplicados.
-- Não cria usuários no Auth; o usuário deve ser convidado pelo painel do Supabase.

-- A diretora pode consultar a rede de servidores, conforme decisão funcional.
-- A restrição de escola é aplicada às escritas, não à leitura.
-- Removemos todas as policies antigas de servidores para evitar que uma policy
-- permissiva esquecida se some às policies de escrita.
DO $$
DECLARE
  politica RECORD;
BEGIN
  FOR politica IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'servidores'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.servidores', politica.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "servidores_admin_all"
  ON public.servidores
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('secretaria', 'rh')
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('secretaria', 'rh')
  ));

-- Consulta ampla para diretora, conforme solicitado. As lotações retornadas
-- continuam filtradas pela policy de lotacoes da própria escola.
CREATE POLICY "servidores_diretor_read_rede"
  ON public.servidores
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'diretor'
  ));

-- Escrita exclusivamente em servidor que possua lotação atual na escola do perfil.
CREATE POLICY "servidores_diretor_update_propria_escola"
  ON public.servidores
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.lotacoes l ON l.servidor_id = servidores.id
    WHERE up.id = auth.uid()
      AND up.role = 'diretor'
      AND l.escola_id = up.escola_id
      AND l.data_fim IS NULL
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.lotacoes l ON l.servidor_id = servidores.id
    WHERE up.id = auth.uid()
      AND up.role = 'diretor'
      AND l.escola_id = up.escola_id
      AND l.data_fim IS NULL
  ));

-- Escolas: administradores e perfis não-diretora continuam vendo a rede;
-- uma diretora vê somente a escola vinculada ao próprio perfil.
DROP POLICY IF EXISTS "escolas_read" ON public.escolas;
CREATE POLICY "escolas_read"
  ON public.escolas
  FOR SELECT TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'diretor'
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'diretor'
        AND up.escola_id = escolas.id
    )
  );

-- Lotações: a diretora consulta somente vínculos da própria escola.
-- Inserção, alteração e exclusão permanecem administrativas.
DROP POLICY IF EXISTS "lotacoes_admin" ON public.lotacoes;
CREATE POLICY "lotacoes_admin"
  ON public.lotacoes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('secretaria', 'rh')
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('secretaria', 'rh')
  ));

DROP POLICY IF EXISTS "lotacoes_diretor_read" ON public.lotacoes;
CREATE POLICY "lotacoes_diretor_read"
  ON public.lotacoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'diretor'
      AND up.escola_id = lotacoes.escola_id
  ));

-- Efetividade: administradores e diretora da própria escola.
DROP POLICY IF EXISTS "efe_admin" ON public.efetividade;
CREATE POLICY "efe_admin"
  ON public.efetividade
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('secretaria', 'rh')
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('secretaria', 'rh')
  ));

DROP POLICY IF EXISTS "efe_diretor" ON public.efetividade;
CREATE POLICY "efe_diretor"
  ON public.efetividade
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'diretor'
      AND up.escola_id = efetividade.escola_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'diretor'
      AND up.escola_id = efetividade.escola_id
  ));

-- Relatórios podem mostrar solicitações que envolvam a escola da diretora,
-- mas criação, alteração e atendimento continuam administrativos.
DROP POLICY IF EXISTS "solicitacoes_transferencia_diretor_read" ON public.solicitacoes_transferencia;
CREATE POLICY "solicitacoes_transferencia_diretor_read"
  ON public.solicitacoes_transferencia
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'diretor'
      AND (
        solicitacoes_transferencia.escola_origem_id = up.escola_id
        OR solicitacoes_transferencia.escola_destino_id = up.escola_id
        OR EXISTS (
          SELECT 1
          FROM public.lotacoes l
          WHERE l.servidor_id = solicitacoes_transferencia.servidor_id
            AND l.escola_id = up.escola_id
        )
      )
  ));

-- Cadastro atômico de servidor + primeira lotação.
-- O cliente nunca recebe permissão para inserir diretamente em lotacoes.
CREATE OR REPLACE FUNCTION public.criar_servidor_na_escola(
  p_escola_id INTEGER,
  p_dados JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil public.user_profiles%ROWTYPE;
  v_servidor public.servidores%ROWTYPE;
BEGIN
  SELECT * INTO v_perfil
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR v_perfil.role NOT IN ('diretor', 'secretaria', 'rh') THEN
    RAISE EXCEPTION 'Você não possui permissão para cadastrar servidores';
  END IF;

  IF v_perfil.role = 'diretor' AND v_perfil.escola_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'A diretora só pode cadastrar servidores na própria escola';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.escolas WHERE id = p_escola_id) THEN
    RAISE EXCEPTION 'Escola não encontrada';
  END IF;

  IF NULLIF(trim(COALESCE(p_dados->>'nome', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do servidor é obrigatório';
  END IF;

  INSERT INTO public.servidores (
    nome, status, funcao, tipo_vinculo, matricula, email, telefone,
    data_nascimento, endereco, formacao, cpf, observacoes
  ) VALUES (
    trim(p_dados->>'nome'),
    COALESCE(NULLIF(trim(p_dados->>'status'), ''), 'Ativo'),
    NULLIF(trim(p_dados->>'funcao'), ''),
    NULLIF(trim(p_dados->>'tipo_vinculo'), ''),
    NULLIF(trim(p_dados->>'matricula'), ''),
    NULLIF(trim(p_dados->>'email'), ''),
    NULLIF(trim(p_dados->>'telefone'), ''),
    NULLIF(trim(p_dados->>'data_nascimento'), '')::DATE,
    NULLIF(trim(p_dados->>'endereco'), ''),
    NULLIF(trim(p_dados->>'formacao'), ''),
    NULLIF(trim(p_dados->>'cpf'), ''),
    NULLIF(trim(p_dados->>'observacoes'), '')
  )
  RETURNING * INTO v_servidor;

  INSERT INTO public.lotacoes (servidor_id, escola_id, principal, data_inicio)
  VALUES (v_servidor.id, p_escola_id, true, CURRENT_DATE);

  RETURN jsonb_build_object(
    'id', v_servidor.id,
    'nome', v_servidor.nome,
    'status', v_servidor.status,
    'escola_id', p_escola_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_servidor_na_escola(INTEGER, JSONB) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_servidor_na_escola(INTEGER, JSONB) TO authenticated;
