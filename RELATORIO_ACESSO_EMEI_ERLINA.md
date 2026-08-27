# Primeiro acesso por escola — EMEI Erlina Portela Gervino

## Objetivo

Preparar um teste controlado com uma conta de diretora limitada à **EMEI Erlina Portela Gervino**, mantendo o perfil `rh` da SMED com acesso total à rede.

## Modelo de acesso

| Perfil | Escopo |
| --- | --- |
| Diretora | Consulta e edição dos servidores vinculados à própria escola, cadastro de novo servidor já vinculado à unidade, inativação e reativação de cadastro e lançamento mensal de efetividade da unidade. |
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

A conta da EMEI Erlina deve visualizar somente a própria escola na seleção, os servidores vinculados à unidade e a efetividade mensal da unidade. Deve conseguir cadastrar um servidor novo, editar os dados cadastrais permitidos e marcar Tudo OK, Atestado ou Falta sem atestado.

A conta não deve conseguir alterar escolas, lotações, histórico ou excluir definitivamente servidores. A diretora não vê o seletor de outras lotações no editor; o banco também bloqueia escritas fora da unidade. O RH deve continuar visualizando e administrando todas as unidades.

## Senhas e e-mails

O endereço precisa existir e conseguir receber o convite ou a recuperação de senha. Senhas temporárias devem ser individuais e trocadas no primeiro acesso. Não usar senha compartilhada, endereço inventado ou senha previsível.

## Correção do erro publicado

O erro `ReferenceError: useServidoresByEscola is not defined` foi causado pela ausência do import desse hook no `App.jsx`, embora o quadro das unidades o utilizasse. O import foi corrigido e o hook foi confirmado no bundle de produção.

## Validação técnica

O frontend foi compilado após a integração das permissões, da troca obrigatória de senha, da reativação e da correção do import. A instalação limpa passou em `npm ci`, `npm run build` e `npm run audit:prod`; a checagem de código não encontrou chaves administrativas ou arquivos `.env` reais.
