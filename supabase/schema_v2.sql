-- ═══════════════════════════════════════════════════════════════════════════
-- EDUGESTÃO VACARIA — Schema V2 (banco unificado, limpo)
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensão para busca sem acento
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── 1. ESCOLAS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escolas (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('EMEF','EMEI','EMEF Campo','SMED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. SERVIDORES (tabela única — professores + pessoal T&A) ────────────────

CREATE TABLE IF NOT EXISTS servidores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             TEXT NOT NULL,
  nome_norm        TEXT GENERATED ALWAYS AS (
                     UPPER(unaccent(nome))
                   ) STORED,
  status           TEXT NOT NULL DEFAULT 'Ativo'
                     CHECK (status IN ('Ativo','Afastado','Inativo')),
  funcao           TEXT,
  tipo_vinculo     TEXT CHECK (tipo_vinculo IN
                     ('Efetivo','Designação','Contratado','Temporário','Estágio')),
  matricula        TEXT,
  email            TEXT,
  telefone         TEXT,
  data_nascimento  DATE,
  endereco         TEXT,
  formacao         TEXT,
  regencia_h       INTEGER,
  htp_h            INTEGER,
  hti_h            INTEGER,
  observacoes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servidores_nome_norm ON servidores(nome_norm);
CREATE INDEX IF NOT EXISTS idx_servidores_status    ON servidores(status);

-- ─── 3. LOTAÇÕES (escola de trabalho do servidor) ────────────────────────────

CREATE TABLE IF NOT EXISTS lotacoes (
  id           SERIAL PRIMARY KEY,
  servidor_id  UUID NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  escola_id    INTEGER NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  principal    BOOLEAN DEFAULT false,
  data_inicio  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim     DATE,
  motivo_saida TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lotacoes_servidor ON lotacoes(servidor_id);
CREATE INDEX IF NOT EXISTS idx_lotacoes_escola   ON lotacoes(escola_id);
CREATE INDEX IF NOT EXISTS idx_lotacoes_historico_servidor ON lotacoes(servidor_id, data_inicio DESC, data_fim DESC);
CREATE UNIQUE INDEX IF NOT EXISTS lotacoes_ativas_unicas_idx ON lotacoes(servidor_id, escola_id) WHERE data_fim IS NULL;

-- ─── 4. EFETIVIDADE ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS efetividade (
  id            SERIAL PRIMARY KEY,
  servidor_id   UUID NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  escola_id     INTEGER NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  mes_ano       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('ok','ocorrencia','pendente')),
  ocorrencia    TEXT,
  observacoes   TEXT,
  registrado_por TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (servidor_id, escola_id, mes_ano)
);

CREATE INDEX IF NOT EXISTS idx_efe_mes_escola ON efetividade(mes_ano, escola_id);

-- ─── 5. USER PROFILES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         TEXT,
  role         TEXT NOT NULL DEFAULT 'viewer'
                 CHECK (role IN ('secretaria','rh','diretor','viewer')),
  escola_id    INTEGER REFERENCES escolas(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE escolas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE servidores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotacoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE efetividade  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Escolas: todos autenticados lêem
DROP POLICY IF EXISTS "escolas_read" ON escolas;
CREATE POLICY "escolas_read" ON escolas
  FOR SELECT TO authenticated USING (true);

-- Escolas: só admin escreve
DROP POLICY IF EXISTS "escolas_write" ON escolas;
CREATE POLICY "escolas_write" ON escolas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('secretaria','rh')
  ));

-- Servidores: secretaria/rh vê todos
DROP POLICY IF EXISTS "servidores_admin_all" ON servidores;
CREATE POLICY "servidores_admin_all" ON servidores
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('secretaria','rh')
  ));

-- Servidores: diretor vê só da sua escola
DROP POLICY IF EXISTS "servidores_diretor_read" ON servidores;
CREATE POLICY "servidores_diretor_read" ON servidores
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN lotacoes l ON l.servidor_id = servidores.id
    WHERE up.id = auth.uid()
      AND up.role = 'diretor'
      AND l.escola_id = up.escola_id
  ));

-- Lotações: admin gerencia, diretor lê sua escola
DROP POLICY IF EXISTS "lotacoes_admin" ON lotacoes;
CREATE POLICY "lotacoes_admin" ON lotacoes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('secretaria','rh')
  ));

DROP POLICY IF EXISTS "lotacoes_diretor_read" ON lotacoes;
CREATE POLICY "lotacoes_diretor_read" ON lotacoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'diretor' AND escola_id = lotacoes.escola_id
  ));

-- Efetividade: admin e diretor da escola
DROP POLICY IF EXISTS "efe_admin" ON efetividade;
CREATE POLICY "efe_admin" ON efetividade
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('secretaria','rh')
  ));

DROP POLICY IF EXISTS "efe_diretor" ON efetividade;
CREATE POLICY "efe_diretor" ON efetividade
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'diretor' AND escola_id = efetividade.escola_id
  ));

-- User profiles: cada um lê o próprio
DROP POLICY IF EXISTS "profiles_self" ON user_profiles;
CREATE POLICY "profiles_self" ON user_profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin" ON user_profiles;
CREATE POLICY "profiles_admin" ON user_profiles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('secretaria','rh')
  ));

-- ─── 7. TRIGGER: auto-criar perfil ao registrar usuário ──────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, nome, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nome', 'secretaria')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── 8. FUNÇÃO: updated_at automático ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS servidores_updated_at ON servidores;
CREATE TRIGGER servidores_updated_at
  BEFORE UPDATE ON servidores
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

DROP TRIGGER IF EXISTS efe_updated_at ON efetividade;
CREATE TRIGGER efe_updated_at
  BEFORE UPDATE ON efetividade
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Confirma tabelas criadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
