# Recanto das Asas — correção do menu e atalhos web 0.2.2

O menu Android volta a funcionar em uma única coluna com rolagem vertical. No navegador, miniaturas maiores e atalhos fixos para Cadastrar ave, Aves, Casais, Financeiro e todos os menus, usando os módulos existentes.

**[Baixe o pacote completo](https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.2-menu-atalhos-avaliacao): Assets → Source code (zip).** Extraia todas as pastas.

1. Faça backup em cada aparelho e feche o aplicativo.
2. Android: instale [Recanto-das-Asas-0.2.2-debug.apk](Recanto-das-Asas-0.2.2-debug.apk) sobre a versão atual. Mesma assinatura, código 2003.
3. Windows: execute [01-Preparar-Windows.cmd](01-Preparar-Windows.cmd), aguarde a integridade e abra o instalador gerado.
4. Confira 0.2.2 e o menu ao rolar. Mantenha os dados, senha, servidor e Tailscale atuais.

[Passo a passo e análise da causa](LEIA-PRIMEIRO.md) · [Comparativo e resultados](Comparativo-e-validacao) · [Hashes dos instaladores](ARTEFATOS_0.2.2.json) · [Código-fonte completo](Codigo-fonte-0.2.2.zip) · [Commit](https://github.com/radibruque/recanto-das-asas/commit/df86ae54dcccf6d2e9dbd87a39734c0d495ac0ad).

`Recanto-das-Asas-Web-0.2.2.zip` contém os 94 arquivos do build web em dist para quem já possui uma publicação de navegador. Preserve a origem HTTPS existente para conservar a base do navegador. Não foi configurada hospedagem nova.

Passaram o build, 269 testes unitários e 61 testes de navegador. Instaladores, assinatura Android, recursos, cache offline, PNGs e CRC NSIS conferidos. A instalação e a confirmação no aparelho físico precisam ser verificadas pelo usuário. As capturas usam bases isoladas de teste; a gravação e os registros reais não integram o pacote.
