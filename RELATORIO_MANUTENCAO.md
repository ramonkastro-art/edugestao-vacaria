# Relatório de manutenção corretiva e preventiva

**Sistema:** EduGestão Vacaria  
**Escopo:** frontend React/Vite, integração Supabase, persistência de lotações, autenticação, PWA, relatórios, acessibilidade e operação de deploy.  
**Resultado:** correções aplicadas localmente e validadas em instalação limpa; o pacote final foi gerado sem `node_modules`, `dist`, `.git` ou o JSON legado removido. O pacote ainda precisa ser publicado no repositório e as migrações SQL precisam ser executadas no Supabase de produção.

## Síntese executiva

A inspeção encontrou riscos relevantes não apenas na apresentação do histórico, mas também na consistência dos vínculos, na atualização do PWA, no tratamento de falhas e no controle de privilégios. A causa funcional mais importante era a distinção insuficiente entre **lotação atual** e **lotação histórica**: telas operacionais podiam considerar vínculos encerrados como atuais, enquanto operações de cadastro poderiam misturar o histórico no conjunto de escolas selecionadas.

Também foi identificado que o service worker referenciava uma constante de cache ausente e utilizava uma estratégia ampla demais para recursos same-origin. Isso podia gerar instalação quebrada ou interface antiga após um deploy. No banco, o histórico estava vulnerável a exclusões em cascata, e o gatilho de novos usuários atribuía `secretaria` como padrão, o que não é aceitável como política preventiva.

> **Importante:** não foi feita conexão nem escrita no banco Supabase de produção nesta auditoria. As alterações SQL são migrações idempotentes para execução administrativa, e o diagnóstico de integridade é somente leitura.

## Achados e correções aplicadas

| Prioridade | Área | Achado | Correção aplicada |
| --- | --- | --- | --- |
| Crítica | Histórico | Vínculos encerrados podiam aparecer como lotações atuais em listas, quadro escolar, efetividade e edição cadastral. | Todas as telas operacionais passaram a considerar `data_fim IS NULL`; o modal de servidor continua exibindo todos os períodos na aba Histórico. |
| Crítica | Persistência | Exclusões em cascata de servidor ou escola poderiam apagar lotações históricas. | A aplicação passou a **inativar** servidor em vez de executar `DELETE`; foi criada `migration_proteger_historico.sql` para trocar FKs de `lotacoes` para `ON DELETE RESTRICT`. |
| Alta | Segurança | O gatilho de novos usuários atribuía role `secretaria` por padrão. | Novo usuário passa a `viewer`; promoção para `secretaria` ou `rh` deve ser explícita. |
| Alta | RLS | A política de administrador de `user_profiles` consultava a própria tabela sob RLS e podia causar recursão/bloqueio. | Criada `public.is_admin()` como função `SECURITY DEFINER`, com `search_path` fixo e permissões explícitas. |
| Alta | Histórico | A regra de sobreposição bloqueava lotações simultâneas em escolas diferentes, embora o sistema aceite dupla lotação. | Inclusão e edição histórica agora verificam sobreposição somente para o mesmo servidor e a mesma escola. |
| Alta | PWA/deploy | O service worker não definia `CACHE_NAME` e cacheava recursos same-origin de forma ampla. | Cache versionado `shell-v3`, navegação/HTML em rede primeiro, cache restrito a assets estáticos e sem cache de Supabase/API. |
| Alta | Dados legados | `src/data/data.json` continha dados pessoais e não era importado pelo código ativo. | Arquivo removido do bundle; produção permanece no Supabase e o README foi corrigido. |
| Média | Robustez | Hooks ignoravam erros de rede e algumas telas poderiam mostrar vazio ou ficar em carregamento inconsistente. | Tratamento de erros, fallback compatível para schemas antigos, cancelamento de requisições e banners de erro foram consolidados em `useData.js`. |
| Média | Autenticação | Perfil antigo podia vencer uma consulta nova durante troca rápida de sessão; falhas de sessão/logout não tinham retorno. | Controle de request id, tratamento de exceções, seleção mínima de perfil e retornos de erro adicionados ao `AuthContext`. |
| Média | Busca | Resultado assíncrono de uma busca antiga podia substituir a pesquisa mais recente. | Busca global passou a cancelar atualizações obsoletas. |
| Média | Relatórios | Exportação CSV não protegia células iniciadas por `=`, `+`, `-` ou `@`; o objeto Blob era revogado imediatamente. | Fórmulas são neutralizadas e o link é anexado/removido com revogação atrasada. |
| Média | Acessibilidade | Modais não tinham semântica de diálogo e o botão iconográfico de inativação não tinha nome acessível. | `role="dialog"`, `aria-modal`, títulos associados, foco visível global e rótulos acessíveis adicionados. |
| Média | Operação | Exceções de runtime poderiam resultar em tela branca. | `ErrorBoundary` com mensagem amigável e ação de atualização adicionado ao entrypoint. |
| Baixa | Configuração | `.env.example` não declarava a URL do Supabase; a documentação apontava para o JSON legado. | Exemplo de ambiente e README atualizados; faixa mínima de Node declarada e comando `audit:prod` adicionado. |

## Integridade do banco

A rotina `supabase/diagnostico_integridade.sql` foi criada para ser executada antes de qualquer correção manual. Ela não altera dados e verifica duplicidades ativas, períodos impossíveis, sobreposição por servidor/escola, servidores ativos sem lotação, perfis inválidos ou ausentes e resumo de contagens.

As migrações de histórico validam datas futuras e períodos invertidos. A migração de solicitações impede pedido futuro, atendimento anterior ao pedido, atendimento futuro e status `Atendido` sem data de atendimento. Essas regras são executadas no banco para também proteger gravações feitas fora da interface.

A política de preservação depende da execução de `migration_proteger_historico.sql` em produção. Sem essa migração, a mudança de frontend reduz o risco, mas não impede um `DELETE` administrativo direto no Supabase.

## Procedimento de publicação

Primeiro, execute `supabase/diagnostico_integridade.sql` e salve o resultado. Depois, faça backup no Supabase e aplique as migrações descritas no README, especialmente `migration_historico_lotacoes.sql`, `migration_proteger_historico.sql` e `migration_security_hardening.sql`. Não execute `migration_admin_policies.sql` se as tabelas legadas `professores` e `nomeacoes` não existirem.

Em seguida, substitua os arquivos do repositório pelo conteúdo do pacote, confirme as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel e faça o commit/push. O deploy deve executar `npm ci` e `npm run build`. Após publicar, valide login, quadro atual, aba Histórico, edição de servidor, transferência, efetividade e relatórios.

Se o navegador mantiver uma versão antiga, faça hard refresh ou remova os dados do site uma única vez. A versão nova registra o service worker sem usar o cache do navegador para a atualização do arquivo `sw.js`.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` em cópia limpa | Passou; 144 pacotes instalados. |
| `npm run build` em cópia limpa | Passou; Vite transformou 1.553 módulos e gerou `dist/index.html`. |
| `npm run audit:prod` | Passou; `found 0 vulnerabilities`. |
| Checagem de SQL no banco de produção | Não executada; não houve conexão administrativa disponível. |
| Deploy/push no GitHub/Vercel | Não executado automaticamente; o pacote está pronto para publicação. |

## Arquivos principais entregues

| Arquivo | Finalidade |
| --- | --- |
| `src/hooks/useData.js` | Erros, fallback, lotações ativas, efetividade, CRUD e histórico. |
| `src/components/ServidorModal.jsx` | Histórico completo, carregamento seguro e semântica de diálogo. |
| `src/pages/EditarServidor.jsx` | Edição sem reabrir histórico e inativação sem exclusão física. |
| `public/sw.js` e `src/main.jsx` | Atualização segura do PWA e cache restrito. |
| `vercel.json` | CSP, cabeçalhos de segurança e HTML sem cache. |
| `supabase/migration_proteger_historico.sql` | Bloqueio de cascatas destrutivas. |
| `supabase/migration_security_hardening.sql` | RLS de perfil e role padrão segura. |
| `supabase/diagnostico_integridade.sql` | Auditoria somente leitura pós-publicação. |
| `RELATORIO_MANUTENCAO.md` | Registro auditável das alterações e validações. |

## Referências internas

[1]: src/hooks/useData.js "Hook de dados e operações do sistema"
[2]: src/components/ServidorModal.jsx "Modal de servidor e histórico"
[3]: src/App.jsx "Telas operacionais e filtros de lotação"
[4]: public/sw.js "Service worker versionado"
[5]: vercel.json "Cabeçalhos e política de cache da Vercel"
[6]: supabase/schema_v2.sql "Schema ativo e políticas RLS"
[7]: supabase/migration_historico_lotacoes.sql "RPCs e validações de lotação"
[8]: supabase/migration_proteger_historico.sql "Proteção de chaves estrangeiras"
[9]: supabase/migration_security_hardening.sql "Endurecimento de autenticação e RLS"
[10]: supabase/diagnostico_integridade.sql "Auditoria somente leitura"
[11]: README.md "Procedimentos de configuração e publicação"
[12]: build-auditoria-final.txt "Evidência do build final"
[13]: audit-auditoria-final.txt "Evidência da auditoria de dependências final"
