-- Corrige a permissão necessária para a RPC transferir_servidor_escola gerar
-- o ID da nova lotação com nextval().
--
-- Execute uma vez no Supabase SQL Editor como proprietário do projeto.
-- O GRANT é apenas para uso da sequência; não concede INSERT/UPDATE em lotacoes
-- nem ignora as policies RLS existentes (secretaria/RH continuam sendo exigidos).

DO $$
DECLARE
  v_sequence regclass;
BEGIN
  v_sequence := pg_get_serial_sequence('public.lotacoes', 'id')::regclass;

  IF v_sequence IS NULL THEN
    RAISE EXCEPTION 'Não foi encontrada uma sequência serial/identity para public.lotacoes.id';
  END IF;

  EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', v_sequence);
END
$$;
