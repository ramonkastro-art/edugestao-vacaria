# Exclusão definitiva protegida de servidores

A ação que antes apenas alterava o status para `Inativo` agora pode excluir definitivamente um cadastro, mas somente quando a exclusão não causar perda de histórico ou de registros relacionados.

## Confirmação exigida

Ao clicar em **Excluir definitivamente**, o usuário precisa digitar exatamente o nome do funcionário e informar a própria senha atual. A senha é usada apenas para reautenticar na sessão do Supabase; não é armazenada nem registrada na auditoria.

A operação só fica habilitada quando o nome confere e a senha foi preenchida. Uma senha inválida cancela a operação e mantém o cadastro intacto.

## Bloqueios de segurança

A RPC administrativa recusa a exclusão se o servidor possuir qualquer registro em `lotacoes`, incluindo vínculos atuais e históricos, ou registros em `efetividade` ou `solicitacoes_transferencia`. Nesses casos, a ação correta continua sendo **Inativar**, pois o funcionário possui rastreabilidade relacionada.

A RPC também exige role `secretaria` ou `rh`, grava uma linha em `auditoria_exclusao_servidores` e só então executa a exclusão. A exclusão direta via cliente é revogada, de modo que a senha e a confirmação não podem ser contornadas por uma chamada simples à tabela.

## Migração obrigatória

Como a operação depende de uma RPC nova, execute no SQL Editor do Supabase, com backup já realizado:

```text
supabase/migration_exclusao_segura_servidores.sql
```

A migração é idempotente. Ela cria a tabela de auditoria, habilita sua leitura restrita para administradores, cria a função de exclusão e revoga `DELETE` direto para `authenticated`, `anon` e `PUBLIC`.

## Uso para duplicidades

Antes de excluir um duplicado, compare lotações, efetividade e solicitações. Se o duplicado tiver qualquer vínculo, o sistema bloqueará a exclusão para não apagar histórico. Nesse caso, mantenha o cadastro e inative-o, ou faça uma correção/mesclagem planejada antes de remover qualquer dado.

Se o cadastro duplicado não tiver dependências, a exclusão definitiva poderá ser concluída com a confirmação do nome e a senha. Depois, confira a tabela de auditoria e atualize a listagem.
