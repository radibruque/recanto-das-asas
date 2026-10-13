# Atualizar o Recanto das Asas — 0.2.1

Esta atualização aplica o conceito B no Windows e o conceito C no Android, com temas Claro, Escuro e Sistema. Início e Aves apresentam linhas horizontais com foto. A ficha mantém os dados existentes e apresenta o histórico recente de saúde e manejo. Foram corrigidas pausas no processamento de fotos, históricos e backups.

## Download

Entre no GitHub com a conta que tem acesso ao repositório privado. Abra a [entrega 0.2.1 B/C](https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.1-bc-avaliacao) e, em **Assets**, baixe **Source code (zip)**. O ZIP dessa entrega reúne o APK, as três partes do instalador Windows, os scripts de preparação, o código-fonte e as capturas da interface implementada.

Se estiver na página dos arquivos em vez da entrega, use **Code → Download ZIP**. Extraia todas as pastas antes de executar os arquivos. Não execute scripts de dentro da visualização do ZIP.

## Antes da instalação

1. Em cada aparelho, abra **Sistema → Backup e recuperação** e use **Criar e baixar backup completo**. Guarde os arquivos `.ra-backup` fora do aplicativo e preserve a senha da base.
2. Feche o aplicativo no Windows e no Android. Mantenha a instalação atual: a atualização não exige desinstalar, limpar dados ou criar outra base.
3. O servidor local e o Tailscale mantêm a configuração existente. Não é necessário reinstalá-los.

## Windows 10/11 de 64 bits

1. Extraia o ZIP, por exemplo em `C:\Recanto-Atualizacao`. Mantenha juntas `Windows.parte01`, `Windows.parte02`, `Windows.parte03`, `Preparar-Windows.ps1` e `01-Preparar-Windows.cmd`.
2. Execute **01-Preparar-Windows.cmd**. Ele reúne as partes e verifica SHA-256. Aguarde a mensagem de integridade confirmada.
3. Execute **Recanto-das-Asas-0.2.1-x64-Setup.exe** e instale sobre a versão anterior, usando o mesmo usuário Windows e a mesma pasta da instalação atual.
4. Abra o aplicativo com a senha existente e confirme **0.2.1** no rodapé. Confira as aves, fotografias, históricos e anexos.

O instalador continua sem assinatura comercial Authenticode, como as entregas anteriores; o Windows pode apresentar aviso de origem.

## Android 10 ou superior

1. Transfira **Recanto-das-Asas-0.2.1-debug.apk** para o telefone e abra pelo aplicativo **Arquivos**.
2. Se necessário, permita que o aplicativo Arquivos instale esse APK. Confirme **Atualizar**.
3. Abra com a senha existente e confirme **0.2.1** no rodapé. O pacote mantém o identificador e a mesma assinatura do APK de avaliação anterior; o código de atualização é **2002**, posterior ao **2001** da entrega visual.
4. Se o Android informar conflito de assinatura ou não oferecer atualização sobre a instalação existente, guarde a mensagem e confira o pacote antes de continuar. Não apague os dados para contornar o erro.

O APK é uma entrega de avaliação privada com a identidade debug já utilizada. A instalação e o desempenho no telefone físico precisam ser confirmados no aparelho.

## Conferência após atualizar

- No menu Aves, confira a lista horizontal, a busca e os filtros; toque numa linha para abrir a ficha.
- Na ficha, confira foto, peso atualizado, histórico recente, abas, edição e anexos. Os dados completos permanecem acessíveis abaixo do resumo e nas abas.
- No Windows, use os menus superiores; **Comercial**, **Documentos** e **Sistema** abrem os módulos já existentes. O cadeado abre os controles da base, situação da sincronização e Bloquear.
- No Android, abra o menu pelo botão de três linhas. Os mesmos controles e módulos permanecem no menu.
- Escolha Claro, Escuro ou Sistema no menu de aparência. A preferência continua local a cada instalação, separada da base e da sincronização.
- Confira a sincronização entre os aparelhos, mantendo o endereço, identificador, chave de serviço e senha atuais.
- Percorra a lista de aves com fotos e digite nos campos em que havia congelamento. As correções reduziram os bloqueios nos testes; esta conferência no seu telefone confirma o efeito no WebView, teclado e memória reais.

O guia técnico e os resultados estão em `RELATORIO-REDESIGN-BC.md`. As imagens da pasta `Interface-Implementada` foram capturadas do aplicativo compilado usando registros fictícios em bases isoladas de teste; eles não são incluídos na base do usuário.
