# EduGestão · Vacaria–RS

Sistema de gestão do Quadro de Efetividade da Rede Municipal de Ensino de Vacaria–RS.

## Tecnologias

- **React 18** + **Vite**
- **Tailwind CSS** (design limpo, estilo Apple/Notion)
- **Lucide React** (ícones)

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173) no navegador.

## Build para produção

```bash
npm run build
```

Os arquivos ficam em `/dist` — prontos para publicar no GitHub Pages, Vercel ou Netlify.

## Deploy no GitHub Pages (opcional)

```bash
npm install --save-dev gh-pages
```

No `package.json`, adicione em `scripts`:
```json
"deploy": "gh-pages -d dist"
```

E em `vite.config.js`, adicione o `base`:
```js
base: '/nome-do-repositorio/',
```

Então:
```bash
npm run build && npm run deploy
```

## Dados

Os dados reais estão em `src/data/data.json` — 614 professores e 30 escolas da rede municipal.

## Funcionalidades

- **Dashboard** — métricas consolidadas (professores, escolas, duplas nomeações)
- **Unidades** — grid das 30 escolas com filtro por modalidade
- **Quadro por Escola** — lista de professores com badges de dupla nomeação
- **Perfil do Professor** — modal com nomeações, carga horária e EFE
- **Módulo EFE** — marcar OK ou ocorrência para cada servidor
- **Busca Global** (⌘K) — por professor ou escola

## Regra de negócio crítica

Professores com 2 nomeações (mesma ou escolas diferentes) possuem **um único cadastro** — a duplicidade está nos vínculos, não na pessoa.


## Histórico de lotações e transferência

O sistema mantém um único cadastro por servidor e agora registra a trajetória escolar na própria tabela `lotacoes`. Uma lotação ativa possui `data_fim` nula; quando o vínculo é encerrado ou transferido, ele permanece no banco com `data_fim` e `motivo_saida`, enquanto a nova escola é registrada como uma nova lotação ativa. O botão **Transferir** fica disponível no detalhe do servidor para usuários com permissão de Secretaria ou RH e abre um fluxo com escola de origem, destino, data e motivo opcional.

Para atualizar um banco existente, faça primeiro o backup habitual do projeto no Supabase e execute o arquivo `supabase/migration_historico_lotacoes.sql` no SQL Editor. A migração adiciona colunas, índices e funções transacionais sem apagar lotações existentes. O arquivo `supabase/schema_v2.sql` também foi atualizado para que instalações novas já nasçam com o modelo histórico.

| Operação | Resultado no histórico |
| --- | --- |
| Transferir para outra escola | Encerra o vínculo atual e cria o novo vínculo com a data informada. |
| Remover uma escola no cadastro | Encerra a lotação preservando o registro anterior. |
| Adicionar outra escola | Cria uma nova lotação ativa sem duplicar o cadastro do servidor. |
| Consultar o perfil | A aba **Histórico** mostra vínculos atuais e encerrados do mais recente ao mais antigo. |

## Progressive Web App

A aplicação inclui `public/manifest.webmanifest`, service worker e ícones PNG em 192 e 512 pixels. Em produção, o navegador poderá oferecer a instalação como aplicativo na tela inicial; o cache offline fica limitado ao shell estático da aplicação e não armazena respostas, sessões ou dados do Supabase. As consultas e o login continuam dependendo da conectividade com o backend.

Depois de publicar uma nova versão, o service worker atualiza o shell automaticamente. Em ambientes com subcaminho, como GitHub Pages, ajuste `base` no `vite.config.js`, `start_url` e `scope` no manifesto para o caminho do repositório antes do deploy.


## Edição cadastral e inclusão manual no histórico

Usuários com perfil de Secretaria ou RH encontram o botão **Editar** diretamente em cada linha da tela de Servidores. A mesma ação continua disponível no detalhe, no cabeçalho, na aba Dados e no rodapé do modal. A edição altera somente os dados cadastrais informados e mantém o cadastro único do servidor.

Na aba **Histórico**, o botão **Adicionar escola** registra uma passagem anterior informando escola, início, fim e motivo opcional. O vínculo é criado já encerrado, não altera a escola atual e não permite períodos sobrepostos ou duplicados. Se `migration_historico_lotacoes.sql` já tiver sido executada anteriormente, execute também `supabase/migration_historico_manual.sql`; se ainda não tiver, a função também está presente na migração principal atualizada.
