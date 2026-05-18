-- ─── SERVIDORES TÉCNICOS E ADMINISTRATIVOS (não professores) ─────────────────
-- Execute este SQL no Supabase → SQL Editor

create table if not exists servidores (
  id            serial primary key,
  nome          text not null,
  status        text not null default 'Ativo' check (status in ('Ativo', 'Afastado')),
  email         text unique,
  telefone      text,
  data_nascimento date,
  cargo         text,            -- merendeira, servente, secretário, etc.
  escola_id     integer references escolas(id),
  observacoes   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table servidores enable row level security;

create policy "servidores_secretaria_read" on servidores
  for all to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role in ('secretaria', 'rh')
    )
  );

create policy "servidores_diretor_read" on servidores
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      where up.id = auth.uid()
        and up.role = 'diretor'
        and servidores.escola_id = up.escola_id
    )
  );

create index if not exists idx_servidores_escola on servidores(escola_id);
create index if not exists idx_servidores_nome   on servidores(nome);
