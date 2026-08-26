# Correção dos modais: scroll e retorno contextual

## Problemas corrigidos

Quando um modal de servidor estava aberto, a página de fundo continuava recebendo a rolagem do mouse. Também, ao abrir **Editar cadastro** a partir do modal do servidor e cancelar, o detalhe era desmontado e o usuário retornava à tela principal.

## Solução aplicada

O `App` agora identifica quando qualquer modal está aberto e bloqueia a rolagem simultaneamente em `body` e `document.documentElement`, preservando a largura da barra de rolagem para evitar deslocamento visual. O bloqueio é removido ao fechar o último modal.

O modal do servidor permanece montado quando a edição cadastral é aberta a partir dele. A edição recebe uma camada superior (`z-[55]`), e o modal inferior deixa de responder ao Escape durante a sobreposição. Ao cancelar pelo botão, o estado de edição é removido e o detalhe do mesmo servidor reaparece na aba em que estava.

Quando a edição é aberta diretamente pela lista de servidores, o comportamento continua retornando à lista, pois não existe um modal de detalhe anterior para restaurar. Após salvar ou inativar um cadastro, o detalhe é fechado e a listagem é recarregada.

## Arquivos alterados

| Arquivo | Alteração |
| --- | --- |
| `src/App.jsx` | Scroll lock global, sobreposição do modal e preservação do servidor selecionado. |
| `src/components/ServidorModal.jsx` | Edição sem desmontar o detalhe e suspensão do Escape durante sobreposição. |
| `src/pages/EditarServidor.jsx` | Camada visual superior para a edição cadastral. |

## Validação

A instalação limpa com `npm ci`, o build de produção com `npm run build` e a auditoria com `npm run audit:prod` passaram. A checagem estática confirmou `modalAberto`, o bloqueio de `body`/raiz, a propriedade `suspended` e a manutenção de `selectedServidor` enquanto a edição está aberta.

## Publicação

Copie os arquivos do pacote para a raiz do repositório, execute novamente `npm ci` e `npm run build`, faça commit/push e aguarde a Vercel. Depois valide: rolagem sobre o conteúdo do modal, cancelamento da edição retornando ao servidor, salvamento do cadastro e abertura direta da edição pela lista.
