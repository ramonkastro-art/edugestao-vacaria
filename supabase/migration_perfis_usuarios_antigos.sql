-- EDUGESTÃO VACARIA — Sincronização de usuários antigos
-- Execute no SQL Editor do Supabase usando uma conta administrativa.
-- Esta migração não altera servidores, escolas, lotações ou efetividade.

-- 1) Cria perfil somente para usuários autenticados que ainda não possuem um.
-- O padrão é secretaria para reproduzir o comportamento do gatilho atual
-- e permitir que os usuários administrativos antigos voltem a editar.
INSERT INTO public.user_profiles (id, nome, role)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'nome', ''), split_part(u.email, '@', 1)),
  'secretaria'
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.id = u.id
WHERE up.id IS NULL;

-- 2) Conferência: deve retornar uma linha para cada usuário autenticado.
SELECT
  u.id,
  u.email,
  up.nome,
  up.role,
  up.escola_id
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.id = u.id
ORDER BY u.email;

-- 3) Se algum usuário antigo deve ser RH, ajuste pelo e-mail.
-- Troque os exemplos pelos e-mails reais antes de executar.
-- UPDATE public.user_profiles up
-- SET role = 'rh'
-- FROM auth.users u
-- WHERE up.id = u.id
--   AND u.email IN ('usuario-rh@exemplo.com');

-- 4) Se algum usuário deve ser diretor, ajuste role e escola_id.
-- O escola_id deve ser o ID da escola correspondente.
-- UPDATE public.user_profiles up
-- SET role = 'diretor', escola_id = 1
-- FROM auth.users u
-- WHERE up.id = u.id
--   AND u.email = 'diretor@exemplo.com';

-- 5) Validação específica por e-mail, útil para confirmar os dois usuários antigos.
-- Substitua os e-mails pelos valores reais.
-- SELECT u.email, up.id, up.nome, up.role, up.escola_id
-- FROM auth.users u
-- LEFT JOIN public.user_profiles up ON up.id = u.id
-- WHERE u.email IN ('usuario-antigo-1@exemplo.com', 'usuario-antigo-2@exemplo.com');
