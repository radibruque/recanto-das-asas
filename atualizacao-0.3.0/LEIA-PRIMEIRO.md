# Atualização local e recuperação — 0.3.0

Esta entrega utiliza o aplicativo existente, sem mudar sua identidade de instalação. Os instaladores são arquivos locais de avaliação; não há publicação em loja, hospedagem ou release externa nesta entrega.

## Ordem de atualização

1. **Antes de instalar:** em Android e Windows, abra Configurações → Backup e recuperação, gere um backup completo `.ra-backup` e confira a prévia com a senha atual. Guarde uma cópia fora do computador. Preserve os backups de ambos quando houver alterações pendentes ou conflito. Sincronização não substitui backup.
2. **Servidor privado primeiro:** extraia o ZIP do servidor 0.3.0 em pasta nova. Com o mesmo usuário Windows da instalação original, use `%LOCALAPPDATA%\RecantoDasAsasSync\program\05-Parar.cmd` e aguarde a parada. Execute `01-Instalar.cmd` do ZIP novo. Ele confere os hashes, atualiza a subpasta `program` e retoma o servidor. Preserve `data`, `config.json` e `token.dpapi` em `%LOCALAPPDATA%\RecantoDasAsasSync`. Não recrie a rede Tailscale, chave ou configuração do serviço. Confira `03-Conectar-Tailscale.cmd` da pasta instalada. O [manual do servidor](SERVIDOR_WINDOWS.md) explica as mensagens e a conexão privada.
3. **Windows:** feche o Recanto das Asas e abra `Recanto-das-Asas-0.3.0-x64-Setup.exe`. Instale sobre a pasta atual, usando o mesmo usuário. Dados continuam em `%APPDATA%\RecantoDasAsas`; não apague essa pasta. O instalador de avaliação não possui assinatura comercial Authenticode. Confirme a origem local e o checksum antes de executar.
4. **Android:** transfira `Recanto-das-Asas-0.3.0-debug.apk` e abra pelo aplicativo Arquivos. Confirme **Atualizar**, preservando a instalação atual. Não desinstale nem limpe armazenamento. Este APK mantém `br.com.recantodasasas.app.debug`, a assinatura de avaliação existente e código de versão **3000**, superior ao 2004 da versão 0.2.3. Requer Android 10 ou superior.
5. **Navegador:** utilize o build web 0.3.0 na mesma origem anterior. Uma origem diferente possui armazenamento separado. Esta entrega não publica o build em um site. O pipeline web gera a versão local e seu cache offline; atualizar um site requer a autorização e a configuração próprias dessa hospedagem.
6. Abra ambos os aplicativos com a senha atual, confira seus registros e versão 0.3.0. Atualize ambos antes de editar ou sincronizar a base migrada. Use a mesma URL privada, identificador da base e chave do serviço. Revise conflitos sem substituir uma base preenchida por uma vazia.

## Dados, sincronização e retorno

A migração versionada transforma o esquema 1/2 em **3**, preservando registros, IDs, vínculos, anexos e documentos emitidos. Espécies mantêm a grafia original; novas estimativas não são inventadas. Movimentos antigos de estoque não viram despesas automaticamente. Tarefas derivadas ficam desativadas até a configuração consciente dos parâmetros e regras.

O servidor conserva envelopes criptografados e protocolo 1. A verificação de versão impede escrita por aplicativo antigo quando a primeira gravação compatível com o esquema 3 é aceita. Um servidor anterior deve ser atualizado antes de receber essa base. Em uma recusa de compatibilidade, as alterações ficam locais; não force substituições para contornar o aviso.

Preserve cópias prévias e posteriores. Um aplicativo antigo não deve abrir ou escrever a base do esquema 3. Se houver necessidade de retorno, mantenha os novos dados separados e restaure um backup anterior **de esquema compatível**, em uma instalação compatível e isolada. O Android pode recusar uma instalação com código de versão inferior; não use desinstalação ou limpeza de dados como atalho para retorno. A recuperação exige revisão do backup e da versão, evitando perda de registros posteriores.

A senha do cofre abre os backups. A chave DPAPI do servidor depende da conta Windows original e é diferente dessa senha. Nenhuma dessas credenciais está nos instaladores, no código ou na documentação.

## Acesso e sessão

No Android, a biometria é opcional em Configurações. Confirme a senha da base e a autorização no diálogo nativo. O aparelho precisa oferecer biometria forte; indisponibilidade ou cancelamento mantém o acesso por senha. Alterar a biometria cadastrada no Android pode exigir nova ativação no Recanto.

Minimizar mantém a sessão na memória enquanto o processo estiver vivo. **Bloquear**, recarregar ou finalizar exige nova autenticação. O Android pode encerrar o processo por memória ou bateria; a próxima abertura pedirá senha ou biometria. Não há serviço permanente nem promessa de sincronização/notificação com processo encerrado. O servidor Windows é independente da janela do aplicativo, mas exige computador ligado, usuário conectado e rede privada ativa.

## Conferência em aparelhos físicos

Build, checksums, assinatura de avaliação, estrutura do APK/EXE e testes de navegador não substituem a instalação no aparelho. Confira em uma base fictícia de avaliação, preservando os backups reais:

| Ação | Resultado esperado |
| --- | --- |
| Atualizar sobre a instalação anterior | Mesmos registros e anexos, sem criar base paralela |
| Reabrir ave, parentesco, anexo e caderneta emitida | Conteúdo e vínculos preservados |
| Android: ativar biometria, bloquear e abrir | Diálogo nativo confirma antes de abrir a base |
| Android: cancelar biometria e usar senha | Base abre normalmente por senha |
| Android: alterar biometria do sistema | Senha continua disponível; reativação pode ser necessária |
| Android: minimizar e voltar sem encerrar processo | Sessão desbloqueada continua aberta |
| Android: finalizar ou reiniciar e abrir | Autenticação exigida novamente |
| Android: digitar e rolar listas/formulários | Teclado, barra inferior e conteúdo não se sobrepõem |
| Android: botão Voltar em detalhes/modal/menu | Fecha o contexto atual e recupera lista/filtros |
| Windows: reduzir janela e usar teclado | Navegação compacta e foco acessível |
| Editar exemplo offline e reconectar | Fila preservada, sem duplicar registros |
| Usar 4G/5G com Tailscale conectado | Acesso privado ao desktop enquanto ligado |
| Reiniciar Windows e entrar na mesma conta | Servidor retoma pelo início automático existente |

Os resultados automatizados e as verificações dos artefatos ficam junto da matriz da entrega. Não há aparelho físico Android ou Windows disponível neste ambiente; sensor biométrico, instalação sobre perfil real, DPAPI do usuário, políticas de energia e conexão Tailscale móvel exigem essa conferência local.
