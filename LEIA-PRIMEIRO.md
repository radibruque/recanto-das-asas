# Recanto das Asas — instalar o redesign visual

Esta entrega moderniza a interface e acrescenta os temas **Claro, Escuro e Sistema** sobre a versão 0.2.0. Os dados, regras, validações, integrações, dependências, relatórios e modelo da caderneta permanecem os mesmos. Não é necessário instalar ferramentas de desenvolvimento.

1. **Guarde um backup de cada aparelho.** Em **Backup e recuperação**, use **Criar e baixar backup completo** no Windows e no Android. Guarde os arquivos `.ra-backup` fora dos aplicativos e preserve a senha da base. Se houver alterações pendentes, mantenha os dois backups.

2. **Baixe o pacote completo.** Entre no GitHub com a conta que tem acesso ao repositório privado e abra [v0.2.0-visual-avaliacao](https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.0-visual-avaliacao). Em **Assets**, baixe **Source code (zip)**. Essa entrega contém os instaladores, o código-fonte e as comparações visuais.

3. **Extraia todas as pastas.** No Windows, use **Extrair tudo**, por exemplo em `C:\Recanto-Visual`. Execute os arquivos na pasta extraída, fora da visualização do ZIP. Mantenha juntas as três partes do instalador e os scripts de preparação.

4. **Feche os aplicativos antes de atualizar.** Use o mesmo usuário Windows da instalação atual. **Não desinstale, não limpe os dados e não crie outra base.** O servidor local e o Tailscale podem continuar funcionando com a configuração existente.

5. **Prepare o instalador Windows.** Execute **01-Preparar-Windows.cmd**. Ele usa **Preparar-Windows.ps1** para reunir as três partes e conferir a integridade. Aguarde a confirmação; se houver erro, extraia novamente o pacote completo antes de continuar.

6. **Atualize o Windows.** Execute o arquivo gerado **Recanto-das-Asas-0.2.0-visual-x64-Setup.exe** e instale sobre a versão existente. O pacote mantém a identidade do aplicativo e o perfil de dados usado anteriormente.

7. **Atualize o Android.** Transfira **Recanto-das-Asas-0.2.0-visual-debug.apk** para o telefone e abra-o pelo aplicativo **Arquivos**. Se necessário, autorize esse aplicativo a instalar o APK. Confirme **Atualizar**. Se aparecer conflito de assinatura ou “Aplicativo não instalado”, guarde a mensagem e interrompa a tentativa sem apagar a instalação atual.

8. **Confira seus registros.** Abra os aplicativos com a senha existente e confira aves, históricos e anexos. O rodapé continua mostrando **0.2.0**: esta entrega altera a apresentação, sem mudar a versão funcional. O APK visual usa o código de atualização **2001**, posterior ao **2000** da entrega anterior. Se surgir uma tela para criar uma base onde já havia registros, pare e confira a instalação e o usuário Windows.

9. **Escolha a aparência.** Na tela de desbloqueio ou no rodapé do menu lateral, use **Aparência → Claro, Escuro ou Sistema**. **Sistema** acompanha a preferência do aparelho. A escolha é guardada separadamente em cada instalação, não integra o backup e não é sincronizada entre telefone e computador. Se o armazenamento visual estiver bloqueado, a escolha funciona durante a sessão, mas poderá não permanecer após reabrir.

10. **Retome o uso e confirme nos aparelhos.** Mantenha o endereço, identificador da base e chave de sincronização atuais; o servidor e o Tailscale não precisam de reinstalação. Confira navegação, pesquisa, abertura de fichas, anexos e documentos nos dois aparelhos. Faça um novo backup depois da conferência. As ações de agenda, calendário, caderneta e relatórios continuam as mesmas.

O tema cobre a interface do aplicativo. Janelas de instalação, seletores do sistema, barra nativa da janela e tela inicial nativa do Android seguem a aparência do sistema operacional. PDFs e documentos emitidos mantêm sua apresentação original.

A instalação sobre a versão anterior e a apresentação nos seus aparelhos físicos precisam ser confirmadas por você; os resultados de validação disponíveis acompanham a entrega.
