# Alteração: edição de vínculos atuais e históricos

A aba **Histórico** agora apresenta uma ação de edição em cada vínculo. Para a lotação atual, a ação aparece como **Editar vínculo atual**; para uma lotação encerrada, aparece como **Editar histórico**.

## Como usar

Para corrigir a data de início do vínculo do Coronel, abra o servidor, entre em **Histórico**, clique em **Editar vínculo atual**, mantenha a situação **Atual**, ajuste o início e salve.

Para registrar que o servidor já saiu do Nabor, clique em **Editar vínculo atual** no cartão do Nabor, selecione **Encerrada**, informe a data de fim e, opcionalmente, o motivo de saída. Salvar essa alteração não modifica o vínculo do Coronel.

A escola do vínculo não é alterada nessa tela. Transferências entre escolas continuam usando a ação **Transferir**, pois ela encerra a origem e cria o destino dentro de uma operação própria.

## Regras de segurança

A edição é individual e não exclui registros. `data_fim = NULL` representa vínculo atual; uma data de fim representa vínculo encerrado. A API do banco rejeita início ou fim no futuro, período invertido e sobreposição na mesma escola para o mesmo servidor. Períodos simultâneos em escolas diferentes continuam permitidos para dupla lotação.

Ao transformar um vínculo encerrado em atual, o motivo de saída é limpo. Ao encerrar um vínculo atual, o sistema grava o motivo informado ou preserva o motivo existente quando disponível. O campo `principal` é preservado ao editar um vínculo atual e fica falso em vínculos encerrados.

## Atualização obrigatória no Supabase

Como a função antiga já foi aplicada anteriormente, execute novamente no SQL Editor apenas:

```text
supabase/migration_editar_historico_lotacao.sql
```

A função é `CREATE OR REPLACE`, portanto a reaplicação atualiza o contrato sem recriar ou apagar lotações. Faça isso depois de publicar o frontend ou imediatamente antes; o frontend só conseguirá editar vínculos atuais quando a nova função estiver instalada.

## Validação sugerida

Use primeiro um servidor de teste ou uma alteração conhecida. Confira que a data de início do cartão escolhido mudou, que a situação exibida corresponde ao valor salvo e que os demais cartões do servidor permaneceram iguais. Depois valide um vínculo atual convertido em encerrado e, por fim, uma correção de data em um vínculo já encerrado.

A validação de produção deve ser feita sem executar `DELETE`, seeds ou alterações diretas na tabela `lotacoes`.
