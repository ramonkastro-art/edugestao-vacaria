# EduGestão Vacaria

Sistema de gestão do quadro de efetividade da Rede Municipal de Ensino de Vacaria–RS. O aplicativo utiliza o Supabase como fonte oficial dos dados de escolas, servidores, lotações, efetividade e solicitações de transferência.

## Tecnologias

- **React 18** com **Vite 5**;
- **Tailwind CSS 3** e **Lucide React**;
- **Supabase JS** para autenticação, consultas, RLS e funções transacionais;
- **PWA** com service worker limitado ao shell estático.

## Configuração local

Copie `.env.example` para `.env.local` e preencha somente as variáveis públicas do cliente Supabase:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). A chave `VITE_SUPABASE_ANON_KEY` é uma chave pública do cliente; nunca coloque no frontend uma `service_role` ou qualquer segredo administrativo.

## Validação e build

Use os mesmos comandos antes de publicar:

```bash
npm ci
npm run build
npm run audit:prod
```

O build produz `dist/`, que pode ser publicado na Vercel. O projeto declara Node `>=18.18.0`; recomenda-se usar a mesma faixa no desenvolvimento e na plataforma de deploy.

## Modelo de dados e migrações

O modelo ativo é o de `supabase/schema_v2.sql`, com um cadastro único em `servidores` e vínculos na tabela `lotacoes`. O arquivo `supabase/schema.sql` é **legado** e não deve ser usado para uma instalação nova, pois pertence ao modelo antigo de `professores` e `nomeacoes`.

Em um banco novo, execute o `schema_v2.sql` e depois as migrações necessárias. Em um banco existente, faça backup no Supabase e execute as migrações em ordem, sem executar seeds de produção:

| Ordem | Arquivo | Finalidade |
| --- | --- | --- |
| 1 | `migration_cpf_servidores.sql` | Adiciona o CPF sem apagar servidores. |
| 2 | `migration_historico_lotacoes.sql` | Adiciona períodos, índices e RPCs não destrutivas para o histórico. |
| 3 | `migration_editar_historico_lotacao.sql` | Permite corrigir períodos históricos com validação. |
| 4 | `migration_proteger_historico.sql` | Impede exclusões em cascata de servidores e escolas com histórico. |
| 5 | `migration_solicitacoes_transferencia.sql` | Cria solicitações administrativas e valida suas datas. |
| 6 | `migration_security_hardening.sql` | Corrige a política recursiva de `user_profiles`. |
| 7 | `migration_admin_policies.sql` | Opcional: completa permissões somente se as tabelas legadas existirem. |

Não execute `migration_admin_policies.sql` em uma instalação v2 que não tenha as tabelas `professores` e `nomeacoes`. A migração `migration_historico_manual.sql` só é necessária quando o banco recebeu anteriormente uma versão antiga de `migration_historico_lotacoes.sql` que ainda não possuía a função de inclusão manual.

Uma lotação sem `data_fim` é atual. Uma lotação encerrada permanece no banco com `data_fim` e `motivo_saida`; ela não deve ser excluída para alterar a escola atual. Os RPCs de sincronização e transferência encerram o vínculo anterior e criam o novo registro dentro da mesma operação.

## Segurança e dados pessoais

As tabelas de negócio usam RLS. A autorização de edição depende de uma linha correspondente em `user_profiles`, com role `secretaria` ou `rh`. A função `public.is_admin()` é `SECURITY DEFINER`, possui `search_path` fixado e substitui a política recursiva anterior do próprio perfil.

O JSON legado com nomes e lotações foi removido de `src/` porque não era importado pela aplicação e continha dados pessoais. Os dados de produção devem permanecer no Supabase. Os arquivos `seed.sql` e `seed_v2.sql` são apenas referências de inicialização; revise e redija os dados antes de armazená-los em repositório público ou executar em produção.

## Funcionalidades

- **Dashboard** com escolas, servidores e duplas de lotação ativa;
- **Unidades** com filtro por modalidade e quadro atual;
- **Servidores** com busca, filtro de escola e status;
- **Perfil do servidor** com dados, vínculos atuais e histórico de escolas;
- **Edição cadastral** sem alterar vínculos de outras escolas;
- **Edição individual de lotações** atuais e históricas, com correção de início, fim e motivo;
- **Transferência** e inclusão manual de passagem histórica;
- **Efetividade mensal** somente para lotações atuais;
- **Solicitações de transferência** com filtros e exportação;
- **Busca global** por servidor ou unidade;
- **PWA** instalável, sem cachear sessões ou respostas do Supabase.

## Edição individual de lotações

Na aba **Histórico**, cada vínculo possui a ação **Editar vínculo atual** ou **Editar histórico**. É possível corrigir a data de início de uma lotação atual, encerrá-la informando data de fim e motivo, ou corrigir um vínculo já encerrado. Escolher **Atual** envia `data_fim = NULL`; escolher **Encerrada** exige uma data de saída. A alteração é individual, não apaga o registro e não altera os demais vínculos do servidor.

A RPC `editar_historico_lotacao` deve ser reaplicada após o deploy do frontend para habilitar a edição de vínculos atuais. Ela impede datas futuras, períodos invertidos e sobreposição na mesma escola, mas permite que o servidor mantenha vínculos simultâneos em escolas diferentes.

## Progressive Web App

O service worker usa o cache versionado `edugestao-vacaria-shell-v3`. Navegações e `index.html` usam rede primeiro; apenas assets estáticos são armazenados localmente. Respostas do Supabase, sessões e APIs externas nunca são cacheadas.

Se uma versão antiga continuar visível após um deploy, faça um hard refresh ou remova os dados do site no navegador. A aplicação registra o service worker com `updateViaCache: 'none'` e verifica atualização na inicialização.

## Diagnóstico rápido

Se a aba **Histórico** aparecer vazia, execute `supabase/diagnostico_historico.sql` no SQL Editor. Se houver linhas em `lotacoes`, publique a versão atual do frontend; se não houver linhas, não execute correções destrutivas antes de verificar backup, logs e histórico do projeto no Supabase.

Se listas ou métricas não carregarem, observe o banner de erro na própria tela e confirme RLS, existência de `user_profiles` e execução das migrações. A aplicação possui fallback somente para schemas antigos de leitura; operações de escrita dependem das migrações atuais.
