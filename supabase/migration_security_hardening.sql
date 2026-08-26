-- Endurecimento das políticas RLS de user_profiles.
-- Execute no Supabase SQL Editor com uma conta administrativa.
-- A função SECURITY DEFINER evita que a política de administrador consulte
-- recursivamente a própria tabela sob RLS.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('secretaria', 'rh')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "profiles_admin" ON public.user_profiles;
CREATE POLICY "profiles_admin"
  ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- Novos usuários começam como viewer. Promoção para secretaria/rh deve ser explícita.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, nome, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nome', 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
