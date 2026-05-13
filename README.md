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
