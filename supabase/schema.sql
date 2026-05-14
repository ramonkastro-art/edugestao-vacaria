-- ─── TABELAS PRINCIPAIS ───────────────────────────────────────────────────────

create table if not exists escolas (
  id          serial primary key,
  name        text not null,
  tipo        text not null check (tipo in ('EMEF', 'EMEI', 'EMEF Campo')),
  created_at  timestamptz default now()
);

create table if not exists professores (
  id          serial primary key,
  nome        text not null,
  status      text not null default 'Ativo' check (status in ('Ativo', 'Afastado')),
  email       text unique,
  telefone    text,
  formacao    text,
  regencia_h  integer default 0,
  htp_h       integer default 0,
  hti_h       integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists nomeacoes (
  id          serial primary key,
  professor_id integer not null references professores(id) on delete cascade,
  escola_id    integer not null references escolas(id) on delete cascade,
  matricula    text,
  cargo        text,
  tipo_vinculo text default 'Efetivo' check (tipo_vinculo in ('Efetivo', 'Designação', 'Contratado')),
  observacoes  text,
  ativa        boolean default true,
  created_at   timestamptz default now()
);

create table if not exists efetividade (
  id           serial primary key,
  professor_id integer not null references professores(id) on delete cascade,
  escola_id    integer not null references escolas(id) on delete cascade,
  mes_ano      text not null,  -- formato: '2025-05'
  status       text not null default 'pendente' check (status in ('ok', 'ocorrencia', 'pendente')),
  ocorrencia   text,
  observacoes  text,
  registrado_por text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(professor_id, escola_id, mes_ano)
);

-- ─── PERFIS DE USUÁRIO ────────────────────────────────────────────────────────

create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  role        text not null default 'professor' check (role in ('secretaria', 'rh', 'diretor', 'professor')),
  escola_id   integer references escolas(id),   -- apenas para diretores
  professor_id integer references professores(id), -- apenas para professores
  created_at  timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

alter table escolas         enable row level security;
alter table professores     enable row level security;
alter table nomeacoes       enable row level security;
alter table efetividade     enable row level security;
alter table user_profiles   enable row level security;

-- Escolas: todos autenticados podem ler
create policy "escolas_read" on escolas
  for select to authenticated using (true);

-- Professores: secretaria/rh vê todos; diretor vê os da escola; professor vê só ele
create policy "professores_secretaria_read" on professores
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role in ('secretaria', 'rh')
    )
  );

create policy "professores_diretor_read" on professores
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join nomeacoes n on n.professor_id = professores.id
      where up.id = auth.uid()
        and up.role = 'diretor'
        and n.escola_id = up.escola_id
    )
  );

create policy "professores_self_read" on professores
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and professor_id = professores.id
    )
  );

-- Nomeações: mesma lógica
create policy "nomeacoes_secretaria_read" on nomeacoes
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role in ('secretaria', 'rh')
    )
  );

create policy "nomeacoes_diretor_read" on nomeacoes
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      where up.id = auth.uid()
        and up.role = 'diretor'
        and nomeacoes.escola_id = up.escola_id
    )
  );

-- Efetividade: secretaria vê tudo; diretor vê sua escola; professor vê a própria
create policy "efe_secretaria" on efetividade
  for all to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role in ('secretaria', 'rh')
    )
  );

create policy "efe_diretor" on efetividade
  for all to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'diretor' and escola_id = efetividade.escola_id
    )
  );

-- User profiles: cada um lê o próprio
create policy "profiles_self" on user_profiles
  for select to authenticated using (id = auth.uid());

-- ─── FUNÇÃO: auto-criar perfil ao cadastrar usuário ──────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, nome, role)
  values (new.id, new.raw_user_meta_data->>'nome', 'secretaria');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── ÍNDICES ─────────────────────────────────────────────────────────────────

create index if not exists idx_nomeacoes_professor on nomeacoes(professor_id);
create index if not exists idx_nomeacoes_escola    on nomeacoes(escola_id);
create index if not exists idx_efe_mes             on efetividade(mes_ano);
create index if not exists idx_efe_professor       on efetividade(professor_id);
