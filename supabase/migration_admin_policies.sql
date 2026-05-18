-- ─── POLÍTICAS DE ADMIN PARA CADASTRO/EDIÇÃO ─────────────────────────────────
-- Permite que secretaria/rh criem e editem professores e servidores

-- Professores: INSERT/UPDATE/DELETE para secretaria e rh
create policy "professores_secretaria_write" on professores
  for insert to authenticated
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );

create policy "professores_secretaria_update" on professores
  for update to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );

create policy "professores_secretaria_delete" on professores
  for delete to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );

-- Nomeações: CRUD para secretaria/rh
create policy "nomeacoes_secretaria_write" on nomeacoes
  for insert to authenticated
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );

create policy "nomeacoes_secretaria_update" on nomeacoes
  for update to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );

create policy "nomeacoes_secretaria_delete" on nomeacoes
  for delete to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );

-- Servidores: CRUD para secretaria/rh
create policy "servidores_secretaria_write" on servidores
  for insert to authenticated
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );

create policy "servidores_secretaria_update" on servidores
  for update to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );

create policy "servidores_secretaria_delete" on servidores
  for delete to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('secretaria', 'rh'))
  );
