-- Auditoria somente leitura. Não executa INSERT, UPDATE ou DELETE.
-- Rode no SQL Editor do Supabase e salve o resultado antes de corrigir dados.

-- 1) Lotação ativa duplicada para a mesma pessoa e escola.
SELECT servidor_id, escola_id, COUNT(*) AS quantidade
FROM public.lotacoes
WHERE data_fim IS NULL
GROUP BY servidor_id, escola_id
HAVING COUNT(*) > 1;

-- 2) Períodos impossíveis ou futuros.
SELECT id, servidor_id, escola_id, data_inicio, data_fim, motivo_saida
FROM public.lotacoes
WHERE data_inicio IS NULL
   OR data_inicio > CURRENT_DATE
   OR (data_fim IS NOT NULL AND data_fim < data_inicio)
   OR (data_fim IS NOT NULL AND data_fim > CURRENT_DATE)
ORDER BY servidor_id, data_inicio;

-- 3) Sobreposição de períodos na mesma escola para o mesmo servidor.
SELECT
  a.id AS lotacao_a,
  b.id AS lotacao_b,
  a.servidor_id,
  a.escola_id,
  a.data_inicio AS inicio_a,
  a.data_fim AS fim_a,
  b.data_inicio AS inicio_b,
  b.data_fim AS fim_b
FROM public.lotacoes a
JOIN public.lotacoes b
  ON b.servidor_id = a.servidor_id
 AND b.escola_id = a.escola_id
 AND a.id < b.id
 AND daterange(a.data_inicio, COALESCE(a.data_fim + 1, 'infinity'::date), '[)')
     && daterange(b.data_inicio, COALESCE(b.data_fim + 1, 'infinity'::date), '[)')
ORDER BY a.servidor_id, a.escola_id, a.data_inicio;

-- 4) Servidores ativos sem lotação ativa.
SELECT s.id, s.nome, s.status
FROM public.servidores s
LEFT JOIN public.lotacoes l
  ON l.servidor_id = s.id
 AND l.data_fim IS NULL
WHERE s.status = 'Ativo'
  AND l.id IS NULL
ORDER BY s.nome;

-- 5) Perfis sem role válida ou sem perfil para usuários autenticados.
SELECT id, nome, role, escola_id
FROM public.user_profiles
WHERE role NOT IN ('secretaria', 'rh', 'diretor', 'viewer')
   OR role IS NULL
ORDER BY nome;

SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.email;

-- 6) Resumo para acompanhamento preventivo.
SELECT 'servidores' AS entidade, COUNT(*) AS total FROM public.servidores
UNION ALL
SELECT 'lotacoes_ativas', COUNT(*) FROM public.lotacoes WHERE data_fim IS NULL
UNION ALL
SELECT 'lotacoes_historicas', COUNT(*) FROM public.lotacoes WHERE data_fim IS NOT NULL
UNION ALL
SELECT 'escolas', COUNT(*) FROM public.escolas
UNION ALL
SELECT 'perfis', COUNT(*) FROM public.user_profiles;
