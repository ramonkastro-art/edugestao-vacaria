# Aprimoramento da identidade visual

A interface do EduGestão Vacaria recebeu uma camada visual inspirada na referência fornecida, sem reproduzir diretamente seu layout ou elementos proprietários.

## Paleta aplicada

| Uso | Direção visual |
| --- | --- |
| Marca e navegação | Azul-marinho com variações de azul-petróleo. |
| Ações principais | Gradiente azul institucional, com contraste alto para texto branco. |
| Assinatura visual | Laranja vibrante usado na linha do cabeçalho e nos cartões de atenção. |
| Estados positivos | Verde suave para confirmação, sucesso e indicadores. |
| Base da aplicação | Fundo marfim/esverdeado muito claro, com gradiente discreto. |

## Componentes atualizados

Os tokens `brand-*` foram centralizados em `src/index.css`. A identidade foi aplicada ao fundo geral, cabeçalho, marca da barra lateral, navegação ativa, campo de busca, cartões da Visão Geral, login, perfil do servidor, edição cadastral, histórico, transferência e relatório PDF.

O objetivo foi criar uma aparência mais institucional e acolhedora, preservando a sobriedade de um sistema administrativo, a legibilidade dos dados e o contraste dos controles.

## Validação

O frontend foi compilado com `npm run build` após a aplicação das alterações. A validação final em cópia limpa deve repetir `npm ci`, `npm run build` e `npm run audit:prod` antes da publicação.
