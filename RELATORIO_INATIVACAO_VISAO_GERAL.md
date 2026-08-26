# Inativação de servidores e renomeação da tela principal

## Comportamento implementado

A exclusão definitiva continua protegida e não é usada para resolver duplicidades com histórico ou lotações. Para esse caso, a edição agora oferece a ação **Inativar**. Ela atualiza somente `servidores.status` para `Inativo`, preservando as lotações, os vínculos históricos, a efetividade e as demais informações do cadastro.

O registro inativado continua disponível no módulo **Servidores** quando o filtro de status `Inativo` for selecionado. O filtro padrão permanece em `Ativo`.

## Indicadores e quadros

O indicador principal passa a contar todos os servidores cujo status seja diferente de `Inativo`. Servidores `Afastado` continuam incluídos, pois seguem sendo servidores cadastrados; somente o status `Inativo` deixa de compor o total. O quadro atual das unidades e o módulo de efetividade também deixam de exibir inativados.

## Nomenclatura

A antiga área `Dashboard` passou a ser apresentada como **Visão Geral** na navegação desktop e mobile. O nome descreve melhor uma tela que resume escolas, servidores e lotações.

## Validação

A cópia limpa do projeto foi validada com `npm ci`, `npm run build` e `npm run audit:prod`, todos com código de saída zero.

## Publicação

Substitua os arquivos do pacote no repositório, faça commit e publique na Vercel. Após o deploy, faça hard refresh e teste: editar um duplicado, clicar em **Inativar**, conferir a saída do total na **Visão Geral**, verificar que ele não aparece no quadro ativo e localizá-lo pelo filtro `Inativo`.
