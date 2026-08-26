-- Endurecimento das funções expostas pelo schema public.
-- Execute depois das migrações que criam as RPCs.
-- Não altera dados; apenas restringe quem pode executar funções.

DO $$
DECLARE
  v_funcao REGPROCEDURE;
  v_funcoes REGPROCEDURE[] := ARRAY[
    to_regprocedure('public.adicionar_historico_lotacao(uuid,integer,date,date,text)'),
    to_regprocedure('public.editar_historico_lotacao(integer,date,date,text)'),
    to_regprocedure('public.excluir_servidor_definitivo(uuid)'),
    to_regprocedure('public.is_admin()'),
    to_regprocedure('public.sincronizar_lotacoes(uuid,integer[],date)'),
    to_regprocedure('public.transferir_servidor_escola(uuid,integer,integer,date,text)')
  ];
BEGIN
  FOREACH v_funcao IN ARRAY v_funcoes LOOP
    IF v_funcao IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', v_funcao);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_funcao);
    END IF;
  END LOOP;
END
$$;

-- `handle_new_user`, `validar_periodo_lotacao` e `update_updated_at` são funções
-- de trigger; não são RPCs de negócio e permanecem intocadas para não afetar
-- o executor interno do Supabase.
