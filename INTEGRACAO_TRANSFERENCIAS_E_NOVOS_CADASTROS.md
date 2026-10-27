# EduGestão — integração de transferências e novos cadastros

## Alterações desta etapa

- O frontend chama `bright-task`, nome publicado confirmado pelo teste CORS do projeto. O modo continua `PREVIEW_LOTE_CADASTRO_QUADRO`, com `grupos_incluir: ["ei", "ef"]` e `aba_quadro: "Quadro Geral"`.
- No quadro de cada escola, a prévia pode exibir **Possíveis transferências para conferência**, lendo `correcoes_a_fazer`. A seção pode aparecer tanto na escola da lotação atual quanto na escola que aparece na fonte.
- O atalho de transferência só está disponível para `POSSIVEL_TRANSFERENCIA_OU_LOTACAO_DESATUALIZADA` quando o servidor é identificado por ID, existe uma lotação de origem explicitamente ativa e existe exatamente uma escola de destino com correspondência de nome normalizado exata. O atalho só abre o modal e pré-preenche origem/destino; a gravação exige confirmação manual. Casos ambíguos permanecem como pendência sem atalho.
- No quadro da escola, a prévia pode exibir **Novos nomes para conferência** a partir de `novos_cadastros_candidatos`, mas apenas com `reconciliacao_global_completa_no_escopo === true`. O nome, a escola e a origem da linha são pré-preenchidos no modal existente de novo servidor; não há criação automática. Função, vínculo e demais dados continuam para conferência humana.
- Depois de concluir uma transferência ou um novo cadastro, a prévia em memória é descartada para não exibir recomendações antigas. A próxima varredura continua sendo manual.
- Incluídos testes das regras de candidatos, transferências e fail-closed em casos ambíguos.

## Corrigir o erro `permission denied for sequence lotacoes_id_seq`

A RPC `transferir_servidor_escola` está definida como `SECURITY INVOKER`. O erro observado é consistente com a falta de permissão `USAGE` para o papel `authenticated` utilizar a sequência que gera o ID de `lotacoes`.

1. Abra o SQL Editor do projeto Supabase correto.
2. Revise e execute o arquivo `supabase/migration_grant_lotacoes_sequence_usage.sql`.
3. A migração localiza a sequência vinculada a `public.lotacoes.id` e concede somente `USAGE` ao papel `authenticated`.
4. Ela não concede INSERT/UPDATE na tabela `lotacoes`, não altera dados e não contorna RLS. As policies atuais continuam sendo responsáveis por restringir a escrita à Secretaria/RH.
5. Reteste uma transferência real de teste com origem, destino e data corretos. Se surgir outro erro, não amplie privilégios: examine a mensagem nova e as policies específicas.

## Testes

Na raiz do frontend:

```bash
npm ci
npm test
npm run build
```

Os testes automatizados não confirmam o comportamento real do Supabase nem substituem o teste manual. A publicação só pode ser considerada concluída depois de aplicar a migração, passar o build, validar os quadros de origem/destino e testar candidatos novos numa sessão autenticada.

## Observações de segurança

- Nenhuma parte desta etapa grava cadastros/transferências a partir da prévia.
- A transferência continua sendo a RPC existente iniciada por um operador, depois de revisão humana.
- Não inclua `service_role` no frontend.
- A proteção do botão de prévia no frontend não substitui autorização dentro da Edge Function. Antes de ampliar a disponibilidade da prévia, valide o papel do chamador no servidor para dados globais e credenciais privilegiadas.
