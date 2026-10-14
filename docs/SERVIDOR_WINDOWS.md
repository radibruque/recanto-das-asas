# Sincronizar Android e Windows usando seu computador

Seu Windows 10 pode guardar a cópia de sincronização do Recanto das Asas. O Android consegue conectar fora de casa por uma rede privada Tailscale. Cada aplicativo continua guardando seus registros localmente e funcionando sem internet.

O computador precisa ficar **ligado, com seu usuário conectado, internet e Tailscale ativos**. Se estiver desligado, sem internet ou suspenso, as alterações ficam na fila do aparelho até a próxima conexão. Os scripts não mudam suas configurações de energia.

## O que você precisa

- O [ZIP do servidor Windows](../aplicativo/release/servidor-windows/Recanto-das-Asas-Servidor-Windows-0.3.0.zip), extraído por completo. Ele inclui o runtime oficial **Node.js 24.21.0**; você não precisa instalar Node ou executar comandos npm. O [SHA-256](../aplicativo/release/servidor-windows/Recanto-das-Asas-Servidor-Windows-0.3.0.zip.sha256) acompanha o arquivo.
- Tailscale instalado no Windows e no Android, com os dois aparelhos na mesma conta/rede privada.
- Os aplicativos Recanto das Asas nos dois aparelhos e a mesma senha para abrir a base.
- Um destino fora do computador para guardar backups.

Confira no [site do Tailscale](https://tailscale.com/pricing) um plano e condições compatíveis com o uso no criatório. Não pressupomos gratuidade para atividade comercial. Este pacote não contrata serviços nem ativa cobranças.

Não é necessário comprar um domínio, contratar serviço Google ou abrir portas no roteador. O Tailscale fornece um endereço HTTPS para a rede privada. A emissão do certificado pode tornar público **o nome DNS do computador** em registros de transparência de certificados; o conteúdo do criatório continua privado. Prefira um nome de dispositivo sem informações pessoais.

## Atualizar uma instalação existente para 0.3.0

A versão 0.3.0 utiliza o esquema de dados 3. Atualize **primeiro o servidor** e depois **ambos os aplicativos**. O serviço mantém o protocolo criptografado anterior e acrescenta a verificação da versão do cliente. Depois da primeira gravação do esquema 3, um cliente antigo recebe uma recusa de atualização obrigatória; ele não pode sobrescrever a base nova.

1. Em cada aparelho, salve um backup completo `.ra-backup` e verifique sua prévia, guardando os arquivos fora da pasta instalada. Preserve também qualquer alteração pendente ou conflito que ainda não tenha sido revisado.
2. No mesmo usuário Windows que instalou o servidor, execute `%LOCALAPPDATA%\RecantoDasAsasSync\program\05-Parar.cmd`. Aguarde a confirmação da parada. Isso para o processo do Recanto e mantém o Tailscale instalado e conectado.
3. Extraia o ZIP 0.3.0 **em uma pasta nova** e execute `01-Instalar.cmd` dessa pasta. Ele verifica os arquivos, substitui os arquivos da subpasta `program` e retoma o processo. Não substitua a pasta de dados inteira.
4. Preserve `%LOCALAPPDATA%\RecantoDasAsasSync\data`, `config.json` e `token.dpapi`. A chave continua protegida por DPAPI para a mesma conta Windows. O instalador não cria outra chave quando já existe uma instalação válida. Não limpe o perfil nem recrie a rede Tailscale.
5. Na pasta `program` instalada, execute `03-Conectar-Tailscale.cmd` para conferir o HTTPS privado com autenticação e a capacidade do servidor para o novo esquema. O endereço, o identificador e a chave usados nos aplicativos continuam os mesmos.
6. Feche o aplicativo Windows e execute o instalador 0.3.0 sobre a instalação atual. No Android, abra o APK 0.3.0 e confirme **Atualizar**, sem desinstalar. Atualize os dois antes de editar ou sincronizar a base migrada.
7. Abra cada aplicativo, confira seus registros e a versão. Sincronize e revise eventuais conflitos existentes antes de continuar o trabalho. Uma cópia vazia nunca deve substituir a remota existente.

Se `01-Instalar.cmd` informar que o servidor está em execução, volte à etapa 2 e aguarde; não apague `supervisor.lease` ou `server.lock`. Se a chave estiver ausente ou não puder ser aberta, preserve todos os arquivos e use a conta Windows original. Não há recuperação automática de DPAPI entre usuários. O [guia de atualização e recuperação 0.3.0](ATUALIZACAO_0.3.0.md) detalha os aplicativos e a cópia anterior.

## 1. Preparar o ZIP e instalar o servidor

1. Baixe o ZIP completo do servidor e confira o SHA-256 fornecido junto do pacote.
2. No Explorador de Arquivos, clique com o botão direito no ZIP e abra **Propriedades**. Se aparecer **Desbloquear**, marque e confirme antes de extrair.
3. Escolha **Extrair tudo** e abra a pasta extraída. Não execute os scripts de dentro do ZIP.
4. Execute **01-Instalar.cmd** e leia as mensagens. Ele copia o servidor para `%LOCALAPPDATA%\RecantoDasAsasSync`, cria uma chave de acesso protegida para seu usuário e prepara o início automático após seu login.
5. Se precisar iniciar novamente, use **02-Iniciar.cmd** na pasta instalada `%LOCALAPPDATA%\RecantoDasAsasSync\program`. Os demais comandos também são copiados para essa pasta; você pode remover a pasta extraída depois da instalação.

A chave é protegida pelo Windows para o usuário que instalou o servidor. Execute os scripts com esse mesmo usuário. Ela não é a senha da base do aplicativo e não é incluída no ZIP. Os scripts usam a política PowerShell `RemoteSigned` somente no processo iniciado; não alteram a política global do Windows.

O início automático acontece **depois que você entra no Windows**. Não é um serviço que começa antes do login. Preserve a pasta instalada: ela guarda a configuração privada e a cópia de sincronização fora das pastas dos instaladores do aplicativo.

## 2. Conectar os aparelhos pela rede privada

1. Instale o [Tailscale para Windows](https://tailscale.com/download/windows) e o [Tailscale para Android](https://tailscale.com/download/android) pelas fontes oficiais. A instalação pode pedir a confirmação do sistema operacional.
2. Entre na mesma conta nos dois aparelhos e confirme que ambos aparecem conectados. No Android, autorize a conexão VPN solicitada pelo Tailscale. Outra VPN ativa pode impedir seu funcionamento.
3. No computador, execute **03-Conectar-Tailscale.cmd**. Ele verifica o login e se já existe uma configuração de serviço na porta HTTPS 443 antes de preparar a conexão do Recanto das Asas.
4. Se o Tailscale solicitar habilitar certificados HTTPS para sua rede, leia e confirme na página oficial da sua conta. Ao finalizar, o script guarda o endereço detectado do computador.

O encaminhamento privado usa `tailscale serve --bg http://127.0.0.1:8788`. O servidor fica acessível pelo HTTPS da rede Tailscale; a porta interna 8788 permanece no próprio computador. **Não use Tailscale Funnel**, que disponibiliza serviços na internet pública. Se já houver outro serviço configurado na porta 443, resolva essa situação antes de continuar, preservando a configuração existente.

No painel do Tailscale, mantenha somente aparelhos autorizados com acesso ao servidor. Confira também as condições e o vencimento da autenticação dos dispositivos. A [documentação de Tailscale Serve](https://tailscale.com/kb/1312/serve) explica a conexão privada.

## 3. Configurar primeiro o aplicativo no Windows

Os instaladores atuais estão em [Windows](../aplicativo/release/windows/Recanto-das-Asas-0.3.0-x64-Setup.exe) e [Android](../aplicativo/release/android/Recanto-das-Asas-0.3.0-debug.apk). O instalador Windows é de avaliação sem Authenticode; o APK é de avaliação com identidade separada da futura versão definitiva. Instalação e atualização em aparelhos físicos ainda precisam ser conferidas.

1. Abra o aplicativo no Windows e crie ou desbloqueie sua base. Guarde a senha: ela é necessária para abrir os mesmos registros no Android e restaurar backups.
2. Entre em **Backup e recuperação**, faça um backup completo e baixe o arquivo `.ra-backup`. Guarde uma cópia fora do computador antes de configurar a sincronização.
3. Execute **04-Mostrar-Conexao.cmd** no próprio computador. Após sua confirmação explícita, ele mostra o endereço HTTPS, o identificador da base **principal** e a chave de acesso.
4. No aplicativo, abra **Sincronização**. Preencha **Endereço HTTPS do serviço** com o endereço mostrado, **Identificador da base** com `principal` e **Chave de acesso ao serviço** com a chave mostrada.
5. Clique em **Salvar conexão** e depois em **Sincronizar agora**. Aguarde a confirmação da sincronização antes de preparar o Android.

A chave dá acesso ao serviço privado. Copie-a somente para seus aparelhos; não a envie neste chat, em capturas de tela ou em relatos de problema. A senha da base permanece nos aplicativos e não é enviada ao servidor.

## 4. Recuperar a mesma base no Android

1. Abra o aplicativo Android e crie a base local com **a mesma senha usada no Windows**. Mantenha essa instalação vazia até buscar os registros existentes.
2. Confirme que o Tailscale do Android está conectado.
3. Em **Sincronização**, informe o mesmo endereço HTTPS, `principal` e a mesma chave. Salve e clique em **Sincronizar agora**.
4. Se aparecer **Revisar conflito**, use **Examinar resumo da base remota** e confira que corresponde ao Windows. Depois escolha **Usar base remota e preservar cópia local**.
5. Confira aves, documentos e demais registros antes de começar a editar no Android.

**Não escolha substituir a base remota pela instalação vazia.** Se o Android já tiver registros próprios, faça backups dos dois aparelhos e revise as diferenças primeiro. A sincronização identifica conflitos e mantém cópias; não combina automaticamente fichas divergentes.

## 5. Conferir antes de usar com registros reais

Faça as verificações antes de inserir dados reais, usando exemplos no espaço **Demonstração**. Os espaços separam os cadastros, mas a sincronização e o backup incluem a base inteira. Se já houver registros reais, guarde backups dos dois aparelhos e não faça testes de substituição ou restauração sobre essa base.

| Verificação | Resultado esperado |
| --- | --- |
| Sincronizar um cadastro e um documento de exemplo do Windows | Ambos aparecem e podem ser abertos no Android |
| Desligar o Wi-Fi do Android e usar 4G/5G com Tailscale ativo | Sincronização funciona fora da rede de casa |
| Reiniciar o Windows e entrar no mesmo usuário | Servidor volta após login e os registros continuam disponíveis |
| Deixar o Android sem conexão e editar um exemplo | Registro local é preservado e a alteração fica pendente |
| Reconectar e sincronizar | Alteração chega ao outro aparelho sem duplicar registros |
| Editar o mesmo exemplo nos dois aparelhos sem sincronizar entre as edições | Aparece conflito para revisão, sem substituição silenciosa |
| Baixar backup e restaurar numa base de avaliação vazia | Registros e anexos do exemplo são recuperados |

O serviço aceita requisições de até 64 MiB, aproximadamente 48 MiB de conteúdo cifrado. A sincronização envia a base completa, incluindo anexos. Uma rede móvel lenta ou uma base grande pode ultrapassar o tempo disponível para a transferência; os dados continuam locais e as tentativas preservam a identificação da operação. Confira o funcionamento com um documento de tamanho semelhante aos que você pretende usar.

Essas verificações dependem dos seus aparelhos e da conexão instalada. Testes de código executados no ambiente de desenvolvimento não substituem esse teste físico.

## Parar, retomar e guardar backups

Use **05-Parar.cmd** para pedir a parada do servidor. Os dados são preservados, e o comando não desliga o Tailscale nem remove outros serviços dele. Use **02-Iniciar.cmd** para retomar.

Se quiser impedir o início após login, execute **06-Desativar-Inicio-Automatico.cmd**. Ele remove somente o atalho reconhecido do Recanto das Asas. Isso não apaga seus registros.

Configure a suspensão manualmente em **Configurações do Windows → Sistema → Energia e suspensão**, conforme sua necessidade. O computador suspenso não recebe conexões. Considere energia, conexão e manutenção do Windows como parte do funcionamento do servidor.

**Sincronização não é backup.** Em **Backup e recuperação**, baixe regularmente o arquivo criptografado `.ra-backup` e guarde versões em um pendrive ou armazenamento privado fora do aparelho. Guarde a senha separadamente. A cópia no mesmo computador não recupera dados depois da perda física dele. Veja o [manual de backup e restauração](MANUAL.md).

Se algo falhar, leia a mensagem do script e confira computador ligado, usuário conectado, internet e Tailscale nos dois aparelhos. Não apague arquivos da pasta de dados ou `server.lock` por tentativa. Preserve seus backups e informe o erro sem incluir a chave de acesso ou dados pessoais.

O código do pacote fica em [sync-server/windows](../aplicativo/sync-server/windows). Detalhes do serviço e seus limites estão no [manual técnico](../aplicativo/sync-server/README.md). A conexão remota, os scripts e o início automático ainda exigem validação no Windows e Android reais.
