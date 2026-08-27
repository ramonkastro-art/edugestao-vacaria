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
| 7 | `migration_exclusao_segura_servidores.sql` | Habilita exclusão definitiva com aprovação, senha, auditoria e bloqueio por dependências. |
| 8 | `migration_rpc_security_hardening.sql` | Remove execução anônima das RPCs de negócio e mantém acesso autenticado. |
| 9 | `migration_acesso_por_escola.sql` | Permite operação da diretora somente na própria unidade e cadastro atômico por escola. |
| 10 | `migration_acesso_escola_teste.sql` | Adiciona troca obrigatória de senha e função administrativa para vincular o primeiro usuário. |
| 11 | `migration_admin_policies.sql` | Opcional: completa permissões somente se as tabelas legadas existirem. |

Não execute `migration_admin_policies.sql` em uma instalação v2 que não tenha as tabelas `professores` e `nomeacoes`. A migração `migration_historico_manual.sql` só é necessária quando o banco recebeu anteriormente uma versão antiga de `migration_historico_lotacoes.sql` que ainda não possuía a função de inclusão manual.

Uma lotação sem `data_fim` é atual. Uma lotação encerrada permanece no banco com `data_fim` e `motivo_saida`; ela não deve ser excluída para alterar a escola atual. Os RPCs de sincronização e transferência encerram o vínculo anterior e criam o novo registro dentro da mesma operação.

A exclusão definitiva de um servidor é reservada a duplicidades sem qualquer lotação, histórico, efetividade ou solicitação associada. Ela exige digitação exata do nome e reautenticação com a senha do usuário atual. Quando houver dependências, a operação é recusada e o cadastro deve ser mantido ou inativado, preservando a rastreabilidade. A migração `migration_rpc_security_hardening.sql` deve ser aplicada para impedir chamadas anônimas às RPCs de negócio.

Ao abrir a edição ou a confirmação, o detalhe do servidor permanece no contexto. Cliques dentro dos formulários não fecham a edição; cancelar restaura o mesmo servidor e o mesmo estado de navegação. A ação **Inativar** altera somente o status do servidor, preserva suas lotações e o histórico, e faz com que ele deixe de aparecer nos indicadores e quadros de servidores ativos. O registro continua acessível pelo filtro `Inativo`.

A antiga área `Dashboard` é apresentada na interface como **Visão Geral**, pois funciona como a tela de resumo da rede. O cartão **Escolas** contabiliza somente unidades escolares (`EMEF`, `EMEI` e `EMEF Campo`); a unidade administrativa `SMED` fica fora desse total, que corresponde a 30 escolas.

## Segurança e dados pessoais

As tabelas de negócio usam RLS. A autorização administrativa depende de uma linha correspondente em `user_profiles`, com role `secretaria` ou `rh`. A função `public.is_admin()` é `SECURITY DEFINER`, possui `search_path` fixado e substitui a política recursiva anterior do próprio perfil. O role `diretor` deve possuir `escola_id` preenchido; após `migration_acesso_por_escola.sql`, a diretora consulta a rede municipal de servidores, mas a edição, inativação e reativação ficam restritas aos servidores vinculados à própria unidade. Ela também cadastra novos servidores pela RPC atômica `criar_servidor_na_escola` e registra a efetividade da escola. A interface não permite à diretora alterar lotações, histórico ou excluir definitivamente; essas operações permanecem administrativas.

O JSON legado com nomes e lotações foi removido de `src/` porque não era importado pela aplicação e continha dados pessoais. Os dados de produção devem permanecer no Supabase. Os arquivos `seed.sql` e `seed_v2.sql` são apenas referências de inicialização; revise e redija os dados antes de armazená-los em repositório público ou executar em produção.

## Acesso por escola

Para criar um acesso escolar, primeiro convide o usuário em **Supabase > Authentication > Users > Invite user**. Depois que o usuário existir, execute, no SQL Editor administrativo, a função privada abaixo, sem colocar senha no banco ou no repositório:

```sql
SELECT public.configurar_diretora_escola(
  'email-real-da-diretora@exemplo.com',
  'Nome exato da escola',
  'Nome da diretora'
);
```

O usuário receberá o convite, definirá a própria senha e será direcionado à troca obrigatória da senha temporária. Para o primeiro teste da **EMEI Erlina Portela Gervino**, use o e-mail real informado pela diretora apenas no painel do Supabase e na chamada administrativa; não use endereço inventado nem senha compartilhada. Uma conta de e-mail só deve ficar vinculada a uma escola, salvo se o modelo de perfis for ampliado para múltiplas unidades.

O RH da SMED continua com acesso total quando o perfil possui role `rh`; Secretaria mantém o mesmo acesso administrativo com role `secretaria`. O frontend apenas melhora a experiência, enquanto as políticas RLS e a RPC são a proteção efetiva no banco. A correção do bundle inclui a importação de `useServidoresByEscola`, necessária para o quadro de cada unidade.

## Identidade visual

A interface utiliza uma paleta inspirada na identidade visual institucional da referência, sem reproduzir seu layout: azul-marinho para marca e navegação, azul-petróleo para ações principais, laranja para assinatura e atenção, verde para estados positivos e um fundo marfim para suavizar a área de trabalho. Os tokens ficam centralizados em `src/index.css`, nas classes `brand-*`, para que novas telas mantenham o mesmo padrão.

A aplicação usa a identidade nos cartões da **Visão Geral**, nos estados ativos da navegação, no cabeçalho, no login, nos perfis de servidores e nos botões principais de edição, histórico, transferência e relatórios.

## Funcionalidades

- **Visão Geral** com escolas, servidores não inativos e duplas de lotação ativa;
- **Unidades** com filtro por modalidade e quadro atual;
- **Servidores** com busca, filtro de escola e status;
- **Perfil do servidor** com dados, vínculos atuais e histórico de escolas;
- **Edição cadastral** sem alterar vínculos de outras escolas;
- **Edição individual de lotações** atuais e históricas, com correção de início, fim e motivo;
- **Transferência** e inclusão manual de passagem histórica;
- **Efetividade mensal** por unidade e servidor, com marcação Tudo OK, registro de atestado, falta sem atestado ou outra ocorrência e observação opcional;
- **Solicitações de transferência** com filtros e exportação;
- **Busca global** por servidor ou unidade;
- **PWA** instalável, sem cachear sessões ou respostas do Supabase.

## Efetividade mensal

A aba **Efetividade** foi desenhada como uma conferência mensal da unidade, e não como um relógio de ponto eletrônico. A diretora ou gestora seleciona a escola e a competência, localiza cada servidor e escolhe **Tudo OK** quando não há ocorrência ou registra **Atestado**, **Falta sem atestado**, **Licença**, **Abono** ou **Outro motivo de ausência** quando necessário. A observação pode receber o período, protocolo ou uma breve referência para facilitar a conferência pela Secretaria/RH.

O status fica associado ao servidor, à escola e ao mês. Ele pode ser corrigido durante a competência, e os filtros permitem localizar rapidamente registros pendentes, conferidos ou com ocorrência. Perfis administrativos continuam com visão de todas as escolas; o perfil de diretora deve ficar vinculado à sua unidade por meio de `user_profiles.escola_id`. O módulo não substitui o controle formal exigido pelas normas municipais ou pelo estatuto local; antes de uso oficial, a Secretaria/RH deve confirmar os tipos de ocorrência e o procedimento de guarda documental.

## Edição individual de lotações

Na aba **Histórico**, cada vínculo possui a ação **Editar vínculo atual** ou **Editar histórico**. É possível corrigir a data de início de uma lotação atual, encerrá-la informando data de fim e motivo, ou corrigir um vínculo já encerrado. Escolher **Atual** envia `data_fim = NULL`; escolher **Encerrada** exige uma data de saída. A alteração é individual, não apaga o registro e não altera os demais vínculos do servidor.

A RPC `editar_historico_lotacao` deve ser reaplicada após o deploy do frontend para habilitar a edição de vínculos atuais. Ela impede datas futuras, períodos invertidos e sobreposição na mesma escola, mas permite que o servidor mantenha vínculos simultâneos em escolas diferentes.

## Progressive Web App

O service worker usa o cache versionado `edugestao-vacaria-shell-v3`. Navegações e `index.html` usam rede primeiro; apenas assets estáticos são armazenados localmente. Respostas do Supabase, sessões e APIs externas nunca são cacheadas.

Se uma versão antiga continuar visível após um deploy, faça um hard refresh ou remova os dados do site no navegador. A aplicação registra o service worker com `updateViaCache: 'none'` e verifica atualização na inicialização.

## Diagnóstico rápido

Se a aba **Histórico** aparecer vazia, execute `supabase/diagnostico_historico.sql` no SQL Editor. Se houver linhas em `lotacoes`, publique a versão atual do frontend; se não houver linhas, não execute correções destrutivas antes de verificar backup, logs e histórico do projeto no Supabase.

Se listas ou métricas não carregarem, observe o banner de erro na própria tela e confirme RLS, existência de `user_profiles` e execução das migrações. A aplicação possui fallback somente para schemas antigos de leitura; operações de escrita dependem das migrações atuais.
