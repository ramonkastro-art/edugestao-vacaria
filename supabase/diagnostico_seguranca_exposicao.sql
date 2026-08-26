-- Diagnóstico somente leitura da exposição do schema public.
-- Não executa ALTER, GRANT, REVOKE, INSERT, UPDATE ou DELETE.
-- Execute no SQL Editor do Supabase e salve todos os resultados.

-- 1) Tabelas public e status de RLS.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

-- 2) Políticas RLS efetivamente cadastradas.
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) Privilégios concedidos a anon, authenticated e PUBLIC.
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY table_name, grantee, privilege_type;

-- 4) Tabelas sem RLS que possuem privilégio para anon ou PUBLIC.
WITH tabelas AS (
  SELECT c.oid, c.relname AS table_name, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
), grants AS (
  SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'public')
)
SELECT t.table_name, t.rls_enabled, g.grantee, g.privilege_type
FROM tabelas t
JOIN grants g ON g.table_name = t.table_name
WHERE NOT t.rls_enabled
ORDER BY t.table_name, g.grantee, g.privilege_type;

-- 5) Funções SECURITY DEFINER e execução concedida a anon/PUBLIC.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, arguments;

-- 6) Views public sem RLS próprio e privilégios públicos.
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  )
  AND grantee IN ('anon', 'public')
ORDER BY table_name, grantee, privilege_type;
