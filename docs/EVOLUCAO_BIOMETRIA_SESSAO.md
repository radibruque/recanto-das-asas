# Acesso biométrico e sessão do aplicativo

## Implementação

A biometria é opcional e local ao aplicativo Android. Não exige serviço externo, conta adicional ou dependência npm. O usuário ativa em Configurações, confirma a senha existente e autoriza a biometria pelo diálogo do Android. Depois pode utilizar **Abrir com biometria** no acesso à base. A senha permanece disponível.

O plugin `RecantoBiometrics` utiliza `BiometricPrompt` da plataforma e uma chave AES-256/GCM no Android Keystore, protegida por autenticação biométrica forte a cada utilização. A chave não é exportada. Android 10 utiliza a autenticação de `CryptoObject`; Android 11 ou superior também restringe explicitamente os autenticadores a `BIOMETRIC_STRONG`.

São persistidos somente o nome da chave, o IV e o conteúdo criptografado da senha, em armazenamento privado do aplicativo. Nenhuma senha legível é gravada em preferências, `localStorage`, `sessionStorage`, banco, backup, sincronização ou log. A credencial é disponibilizada à memória da sessão existente somente após autenticação do Android; o `Vault` ainda confere essa senha contra a base criptografada. Os formatos criptográficos dos registros, anexos e backups não mudam.

Mudança da biometria pode invalidar a chave. Cancelamento, indisponibilidade, bloqueio do Android ou incompatibilidade retornam ao acesso por senha, sem criar ou substituir uma base. Remover a biometria apaga o conteúdo criptografado local e a chave correspondente, preservando a senha da base. O Android já exclui este aplicativo de backup automático; a configuração biométrica não é transferida para outros aparelhos. Chaves de uma ativação interrompida são descartadas no próximo início.

Windows e navegador conservam o acesso por senha. Não oferecem um botão ilustrativo de biometria.

## Sessão e botão Voltar

Minimizar não é finalizar. A sessão desbloqueada é mantida exclusivamente na memória enquanto o processo estiver aberto; não se grava um desbloqueio reutilizável para a próxima execução. O bloqueio explícito continua disponível. Se o aplicativo for finalizado, recarregado, ou o Android encerrar seu processo por falta de recursos, a próxima abertura exige senha ou biometria.

`RecantoNavigation` delega o botão Voltar à navegação do aplicativo pelo evento `recanto:native-back`. Sem listener durante o carregamento, o fallback minimiza, evitando descartar uma sessão acidentalmente. A operação `minimizeApp` não finaliza a atividade; `finishApp` é separada e somente deve ser chamada após uma ação explícita de saída e o bloqueio da sessão em JavaScript.

Não foi criado serviço permanente em segundo plano e não há promessa de sincronização ou notificações com processo encerrado. O sistema operacional continua controlando memória, bateria e suspensão.

## Contratos de integração

- `BiometricsButton`: `onUnlockPassword(password): Promise<void>`, `notify`, `disabled` opcional e `onBusyChange` opcional para impedir envio simultâneo do formulário de senha.
- `BiometricsManage`: `onValidatePassword(password): Promise<void>` deve conferir a base sem modificar a senha da sessão; `notify` informa resultado. O campo de senha é esvaziado antes do envio ao diálogo nativo.
- `watchNativeBack()` retorna o descarte do listener. O handler do aplicativo deve fechar primeiro diálogos/menu e depois voltar ao registro/contexto anterior.
- `minimizeNativeApp()` e `finishNativeApp()` são operações distintas. Nenhuma acompanha automaticamente `visibilitychange`, minimizar ou retorno do usuário.

## Validação e limites

Os testes do adaptador verificam plataforma suportada, consentimento, validação da senha antes da ativação, nova validação do Vault após autenticação do Android, cancelamento, chave inválida, respostas malformadas, ausência de armazenamento web de segredos e separação entre minimizar/finalizar. A compilação Java verifica compatibilidade com o SDK e APIs utilizadas.

Testes de navegador e mocks não comprovam autenticação de sensor ou proteção real do Keystore. São necessários testes em aparelho físico Android 10 e superior: ativar, bloquear, abrir pela biometria, cancelar e usar senha, alterar biometria, remover acesso biométrico, minimizar/retornar, finalizar/reabrir e recuperar backup. Hardware fraco ou ausente mantém acesso por senha.
