-- DIAGNÓSTICO SOMENTE LEITURA
-- Execute no Supabase SQL Editor. Não altera nenhum dado.

-- 1) Verifique o servidor da captura e todos os seus vínculos.
SELECT
  s.id AS servidor_id,
  s.nome,
  l.id AS lotacao_id,
  e.name AS escola,
  l.principal,
  l.data_inicio,
  l.data_fim,
  l.motivo_saida,
  l.created_at
FROM public.servidores AS s
LEFT JOIN public.lotacoes AS l ON l.servidor_id = s.id
LEFT JOIN public.escolas AS e ON e.id = l.escola_id
WHERE lower(s.nome) LIKE lower('%Denilson Jucir de Moraes Vieira%')
ORDER BY l.data_fim NULLS FIRST, l.data_inicio DESC NULLS LAST, l.id;

-- 2) Resumo: quantos vínculos ativos e encerrados existem por servidor.
SELECT
  s.id AS servidor_id,
  s.nome,
  COUNT(l.id) AS total_vinculos,
  COUNT(*) FILTER (WHERE l.data_fim IS NULL) AS vinculos_ativos,
  COUNT(*) FILTER (WHERE l.data_fim IS NOT NULL) AS vinculos_encerrados
FROM public.servidores AS s
LEFT JOIN public.lotacoes AS l ON l.servidor_id = s.id
GROUP BY s.id, s.nome
ORDER BY s.nome;

-- 3) Confirme se as funções de preservação estão instaladas.
SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('sincronizar_lotacoes', 'transferir_servidor_escola', 'adicionar_historico_lotacao', 'editar_historico_lotacao')
ORDER BY p.proname;
