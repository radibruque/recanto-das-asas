# Recanto das Asas — atualização 0.2.1 B/C

Aves apresenta uma **lista horizontal com foto**, também disponível no início. O Windows usa o conceito B e o Android o conceito C, nos temas claro e escuro. Inclui correções de processamento para reduzir pausas em fotografias, históricos e backups.

**[Baixar o pacote completo](https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.1-bc-avaliacao):** na entrega, abra **Assets → Source code (zip)**. Extraia tudo antes de executar os arquivos.

- **Android:** instale [Recanto-das-Asas-0.2.1-debug.apk](Recanto-das-Asas-0.2.1-debug.apk) sobre a versão existente. Código 2002 e a mesma assinatura do APK anterior.
- **Windows:** execute [01-Preparar-Windows.cmd](01-Preparar-Windows.cmd) para reunir as três partes e conferir a integridade; depois execute o instalador gerado.
- **[Passo a passo completo](LEIA-PRIMEIRO.md).** Faça backup em cada aparelho e mantenha a instalação atual, o servidor e o Tailscale.
- **[Ver a interface implementada](Interface-Implementada)**, com 12 capturas reais do aplicativo compilado. Os dados das capturas são fictícios, em bases isoladas.
- **[Relatório](RELATORIO-REDESIGN-BC.md)** e [integridade dos instaladores](ARTEFATOS_0.2.1.json).
- **[Código-fonte](Codigo-fonte-0.2.1.zip)**: contém todos os originais recebidos, o app e a validação. [Commit de implementação](https://github.com/radibruque/recanto-das-asas/commit/c08438d26a0468b45c079f313107e1cd506bf244).

**Validação:** build, 269 testes unitários e 49 testes de navegador passaram. Os 94 recursos do build coincidem no APK e no pacote Windows. A instalação e o desempenho nos aparelhos físicos precisam ser confirmados. O Windows permanece sem assinatura comercial e o APK mantém a identidade debug de avaliação já utilizada.
