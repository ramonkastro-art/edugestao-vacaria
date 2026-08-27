# Primeiro acesso por escola — EMEI Erlina Portela Gervino

## Objetivo

Preparar um teste controlado com uma conta de diretora limitada à **EMEI Erlina Portela Gervino**, mantendo o perfil `rh` da SMED com acesso total à rede.

## Modelo de acesso

| Perfil | Escopo |
| --- | --- |
| Diretora | Consulta a lista municipal de servidores; edição, cadastro, inativação e reativação somente de servidores vinculados à própria escola; lançamento mensal de efetividade da unidade. |
| RH/Secretaria | Acesso administrativo completo, incluindo escolas, servidores, lotações, histórico, efetividade e exclusão protegida. |
| Viewer | Consulta conforme o escopo configurado. |

A proteção efetiva está no RLS e nas RPCs do Supabase; esconder botões no frontend é apenas uma camada de usabilidade.

## Ordem do teste

1. Fazer backup do projeto Supabase.
2. Executar `migration_acesso_por_escola.sql`.
3. Executar `migration_acesso_escola_teste.sql`.
4. Em **Authentication > Users**, convidar a conta usando o e-mail real da diretora. Não registrar senha no projeto.
5. Depois de o usuário existir, executar no SQL Editor administrativo a função privada `configurar_diretora_escola` com o e-mail real, o nome exato da escola e o nome que aparecerá no sistema.
6. Publicar o frontend atualizado.
7. A diretora acessa o link do convite, define uma senha pessoal e passa pela tela de troca obrigatória.

## Testes de aceitação

A conta da diretora deve visualizar somente a própria escola nos seletores de unidades e efetividade. Na lista geral de servidores, pode consultar os registros municipais, conforme decisão funcional, mas o botão Editar somente aparece para servidores com lotação atual na unidade do perfil. Deve conseguir cadastrar um servidor novo, editar os dados cadastrais permitidos, inativar/reativar seus servidores e marcar Tudo OK, Atestado ou Falta sem atestado.

A conta não deve conseguir alterar escolas, lotações, histórico ou excluir definitivamente servidores. A diretora não vê o seletor de outras lotações no editor; o banco bloqueia escritas fora da unidade mesmo que alguém tente chamar a API diretamente. O RH deve continuar visualizando e administrando todas as unidades. A Visão Geral conta 30 escolas e exclui a unidade administrativa SMED.

## Senhas e e-mails

O endereço precisa existir e conseguir receber o convite ou a recuperação de senha. Senhas temporárias devem ser individuais e trocadas no primeiro acesso. Não usar senha compartilhada, endereço inventado ou senha previsível.

## Correção do erro publicado

Os erros `ReferenceError: useServidoresByEscola is not defined` e `ReferenceError: useEfetividade is not defined` foram causados pela ausência dos imports desses hooks no `App.jsx`, embora o quadro das unidades os utilizasse. Os imports foram corrigidos e os hooks foram confirmados no bundle de produção.

## Validação técnica

O frontend foi compilado após a integração das permissões, da troca obrigatória de senha, da reativação e da correção do import. A instalação limpa passou em `npm ci`, `npm run build` e `npm run audit:prod`; a checagem de código não encontrou chaves administrativas ou arquivos `.env` reais. O cartão **Escolas** da Visão Geral agora exclui unidades do tipo `SMED` e conta somente as 30 escolas da rede.
