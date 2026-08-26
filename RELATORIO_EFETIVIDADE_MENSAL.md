# Efetividade mensal — conferência por unidade

## Decisão funcional

Após a clarificação do fluxo de trabalho, a efetividade foi mantida como uma **conferência mensal por servidor e escola**, e não como um relógio de ponto eletrônico com marcações diárias.

A diretora ou gestora seleciona a unidade e a competência. Para cada servidor ativo da escola, pode marcar **Tudo OK** ou registrar uma ocorrência, com destaque para **Atestado**. Também estão disponíveis Falta, Licença, Abono e Outro, com observação opcional para período, protocolo ou referência administrativa.

## Comportamento

| Situação | Resultado |
| --- | --- |
| Sem lançamento | Permanece como pendente. |
| Tudo OK | Registra `status = ok` e limpa ocorrência/observação anterior. |
| Atestado ou outra ocorrência | Registra `status = ocorrencia`, o tipo selecionado e a observação. |
| Correção | O mesmo botão pode ser usado novamente durante o mês. |
| Filtro | Permite localizar todos, Tudo OK, com ocorrência ou pendentes. |
| Diretora | A interface e as políticas existentes devem limitar o lançamento à escola vinculada ao perfil. |

O módulo utiliza a tabela mensal existente `efetividade`, portanto não exige uma nova migração SQL. O histórico é atualizado por `upsert` e não apaga lotações, servidores ou documentos externos.

## Limite de uso

Este módulo é uma ferramenta administrativa de conferência e comunicação com a Secretaria/RH. Ele não foi apresentado como substituto automático de um sistema formal de ponto, folha ou controle de jornada. Antes do uso oficial, a Secretaria/RH deve confirmar se os tipos de ocorrência e a guarda de atestados atendem às normas municipais e ao procedimento interno.

## Validação técnica

A implementação final passou em instalação limpa com `npm ci`, `npm run build`, `npm run audit:prod` e verificação de que não restaram referências ao protótipo diário removido.
