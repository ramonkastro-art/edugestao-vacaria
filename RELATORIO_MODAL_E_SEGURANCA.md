# Correção dos modais e endurecimento de segurança

## 1. Fechamento indevido

O fechamento acontecia porque o diálogo de confirmação estava dentro do wrapper da tela de edição, cujo `onClick` no fundo chama `onClose`. Como o diálogo não interrompia a propagação, um clique nos campos podia alcançar o wrapper externo e desmontar a edição.

A correção faz o diálogo interromper a propagação dos cliques internos. O clique no fundo cancela somente a confirmação e não fecha o cadastro. O modal de servidor permanece montado durante a edição, com uma camada superior definida, e o retorno é explícito: cancelar restaura o funcionário e o contexto anteriores; salvar recarrega os dados; exclusão bem-sucedida fecha o registro removido.

A opção escolhida foi uma **sobreposição controlada**, e não uma nova aba ou janela. Ela mantém o contexto, funciona melhor em dispositivos móveis, não depende de popup permitido pelo navegador e evita duplicar o estado do cadastro.

## 2. Segurança da exclusão

A exclusão definitiva exige nome digitado exatamente e senha do usuário atual. A senha é enviada somente à autenticação do Supabase e não é salva. A função administrativa valida role `secretaria` ou `rh`, bloqueia servidores com lotações, histórico, efetividade ou solicitações e grava auditoria antes de excluir.

A função também revoga `DELETE` direto na tabela para os papéis de cliente. Assim, a confirmação visual não é a única barreira; a operação é validada novamente no banco.

## 3. RPCs expostas

O diagnóstico recebido mostrou `anon_can_execute = true` para RPCs de negócio como adição/edição de histórico, sincronização, transferência e exclusão definitiva. Mesmo quando RLS impediria o acesso aos dados, essa exposição é desnecessária. A nova `migration_rpc_security_hardening.sql` revoga execução anônima dessas RPCs e concede execução somente a `authenticated`.

As funções de trigger e as funções `unaccent` não devem ser alteradas cegamente, pois não são operações de negócio invocadas pela interface. O diagnóstico das tabelas marcadas como `UNRESTRICTED` ainda precisa ser interpretado por objeto; essas tabelas podem pertencer à infraestrutura da plataforma e não devem receber RLS manual sem conhecer seus consumidores.

## 4. Arquivos alterados

| Arquivo | Finalidade |
| --- | --- |
| `src/App.jsx` | Mantém o servidor selecionado, restaura o retorno e aplica o estado de modal. |
| `src/pages/EditarServidor.jsx` | Impede propagação indevida e adiciona confirmação por nome e senha. |
| `src/hooks/useData.js` | Reautentica e chama a RPC protegida de exclusão. |
| `supabase/migration_rpc_security_hardening.sql` | Remove execução anônima das RPCs de negócio. |
| `README.md` | Documenta o fluxo e a nova migração. |

## 5. Validação

A instalação limpa, o build de produção e a auditoria de dependências passaram com código de saída zero. O pacote final não contém `.env`, `service_role`, `node_modules`, `dist` ou o JSON legado com dados pessoais.

## 6. Publicação

Com backup disponível, execute no Supabase:

```text
supabase/migration_rpc_security_hardening.sql
```

Depois publique o frontend, faça hard refresh se necessário e valide: clicar dentro da confirmação sem fechar, cancelar edição retornando ao funcionário, salvar mantendo o contexto, autenticação da exclusão e bloqueio de registros com dependências.
