# Integração da prévia de quadros do EduGestão

## O que foi integrado

- O quadro de cada escola possui a ação **Atualizar prévia**, disponível no frontend para perfis `secretaria` e `rh`.
- A ação chama a Edge Function `bright-task` (nome publicado confirmado no projeto) usando a sessão corrente do Supabase, no modo `PREVIEW_LOTE_CADASTRO_QUADRO`, limitado aos grupos `ei` e `ef` e à aba `Quadro Geral`.
- A consulta é explícita; não há varredura automática em renderizações ou ao navegar entre escolas. O resultado permanece em memória na sessão administrativa para que a mesma prévia possa ser consultada em mais de uma escola sem repetir a varredura.
- A tela só aceita a resposta se `ok`, `modo`, `resumo.gravacao_realizada === false` e `resumo.tabelas_alteradas` vazio confirmarem o contrato de prévia somente leitura.
- `quadros_com_revisao` é a fonte prioritária; `escolas[].linhas_com_marcador_revisao` é o fallback compatível.
- As linhas `LOTACAO_ATIVA_REGISTRADA_NO_EDUGESTAO` sinalizam a linha já existente no banco. As linhas `QUADRO_GERAL_ATUALIZADO` são mantidas como linhas individuais da fonte. A função de renderização não grava nem atualiza tabelas.
- Se uma atualização falhar depois de uma consulta bem-sucedida, a última prévia fica identificada com o horário anterior e a interface mostra o erro, evitando aparentar que os dados antigos foram atualizados.
- A seção **Possíveis transferências para conferência** lê `correcoes_a_fazer`. O atalho para abrir o modal só fica disponível quando há servidor identificado por ID, lotação de origem comprovadamente ativa e exatamente um destino com nome normalizado exato. A transferência continua exigindo confirmação no modal.
- A seção **Novos nomes para conferência** lê `novos_cadastros_candidatos` somente quando `resumo.reconciliacao_global_completa_no_escopo === true` (cobertura completa do escopo elegível desta prévia, que pode excluir escolas com exceção operacional). O formulário de novo servidor é pré-preenchido com nome, escola e rastreabilidade da linha de origem; nada é criado até o operador revisar e salvar manualmente. Depois de uma transferência ou novo cadastro, a prévia em memória é invalidada e precisa ser atualizada manualmente.

## Testes locais

Na raiz do projeto:

```bash
npm ci
npm test
npm run build
```

Os testes em `tests/quadroPreview.test.js` validam a normalização de nomes, a presença provisória na escola da lotação registrada, a preservação das duas linhas da fonte (linhas 30 e 31) no quadro de destino, o fallback de leitura, a exclusão de linhas explicitamente marcadas para não exibição, a exibição condicional de candidatos novos, a presença das pendências nos quadros de origem/destino e a validação segura do atalho de transferência.

## Teste funcional no ambiente

1. Entre com um perfil `secretaria` ou `rh`.
2. Abra **Unidades** e entre em uma escola.
3. Clique em **Atualizar prévia** e aguarde o resultado. A chamada do frontend deve utilizar `bright-task`, não `google-drive-batch-temporal`. Confirme que a tela informa o horário da última consulta e não apresenta erro.
4. Abra a EMEF Inácio de Souza Pires (ID 19): a pessoa com divergência deve continuar na lista da lotação ativa, com `⚠ Revisar lotação` e indicação de presença originada no EduGestão.
5. Abra a EMEF Coronel Avelino (ID 14), usando a mesma prévia em memória: as linhas do Quadro Geral 30 e 31 devem aparecer individualmente, com o marcador e as atuações correspondentes (`Ateliê` e `Matemática e Filosofia`).
6. Verifique que não houve transferência ou alteração de cadastro. A prévia só deve mostrar dados; ações funcionais existentes continuam separadas desse fluxo.
7. Se a prévia indicar transferência, a tela deve mostrar a lotação atual e a escola encontrada. O atalho deve preencher origem/destino no modal, mas nunca confirmar sozinho. Não ofereça atalho de transferência para nome apenas semelhante, origem não confirmada ou múltiplos destinos.
8. Se houver candidatos novos, confirme que só aparecem quando a reconciliação global está completa. O botão abre o formulário com nome/escola pré-preenchidos, sem salvar automaticamente; revise função, tipo de vínculo e dados pessoais antes de concluir.
9. Force uma falha de rede ou use um ambiente sem a função implantada: a interface deve exibir a mensagem de erro e, quando existir, identificar a prévia anterior como antiga.

## Publicação do frontend

1. Aplique as alterações no repositório principal e revise o diff.
2. Configure no ambiente de build apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Nunca use `service_role` ou `SUPABASE_SECRET_KEY` no frontend.
3. Execute `npm ci`, `npm test` e `npm run build` em uma máquina/CI com acesso ao registry npm.
4. Publique pelo fluxo já usado pelo projeto (por exemplo, commit/push para a branch conectada ao Vercel). A publicação só fica confirmada após o deploy concluir e o teste funcional acima passar no endereço de produção.

## Correção de permissão da sequência usada na transferência

A tentativa de transferência retornou `permission denied for sequence lotacoes_id_seq`. A migração `supabase/migration_grant_lotacoes_sequence_usage.sql` concede apenas `USAGE` na sequência de `public.lotacoes.id` ao papel `authenticated`, necessário para a RPC gerar o ID ao inserir uma nova lotação. Execute o SQL no Supabase SQL Editor como proprietário/admin do projeto antes de retestar. O grant não concede INSERT/UPDATE na tabela nem ignora RLS; as policies existentes continuam limitando a alteração de lotações à Secretaria/RH. Não mude a RPC para `SECURITY DEFINER` como atalho.

## Limite de segurança a resolver no backend

O botão está oculto para perfis diferentes de `secretaria`/`rh`, e o navegador não recebe chaves de serviço. Isso é uma restrição da interface, **não uma autorização server-side**. No código v7 fornecido para a função `bright-task`, não localizei validação explícita do papel de quem chamou a Edge Function. Antes de considerar a permissão administrativa protegida contra chamadas diretas à API, implemente e teste uma validação de papel no backend para os modos que acessam dados globais ou usam credenciais privilegiadas. Essa mudança não foi incluída aqui para manter esta entrega restrita à integração do frontend.
