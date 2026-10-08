# Recanto das Asas — instalar e conectar seus aparelhos

Este pacote instala o aplicativo no Windows e no Android e prepara seu computador como servidor privado de sincronização. Você poderá consultar e editar registros sem internet. Para transferir alterações entre os aparelhos, o computador precisa estar ligado, com seu usuário conectado, internet e Tailscale ativos.

Esta versão 0.1.0 é de avaliação privada. Os arquivos foram compilados e conferidos no desenvolvimento, mas instalação, impressão e atualização ainda precisam ser verificadas nos seus aparelhos. Comece com exemplos antes de cadastrar informações reais.

## 1. Conferir o pacote e seus aparelhos

No Windows, abra **Configurações → Sistema → Sobre**. Em **Tipo de sistema**, confirme sistema operacional de **64 bits** e processador **x64**. O instalador atende Windows 10/11 x64; não atende Windows de 32 bits.

No Android, abra **Configurações → Sobre o telefone → Versão do Android**. É necessário Android **10 ou superior**. Mantenha o navegador e o Android System WebView atualizados pelas fontes oficiais do aparelho.

Baixe o ZIP completo da versão 0.1.0 e o resumo SHA-256 fornecido junto dele. Se conferir o arquivo, o resultado deve coincidir com o publicado. Após extrair, a pasta `Recanto-das-Asas-Instalacao-0.1.0` contém:

| Pasta ou arquivo | Para que serve |
| --- | --- |
| `Windows/Recanto-das-Asas-0.1.0-x64-Setup.exe` | Instalar o aplicativo no computador |
| `Android/Recanto-das-Asas-0.1.0-debug.apk` | Instalar a versão de avaliação no celular |
| `Servidor-Windows/` | Preparar a sincronização no seu computador; contém os comandos numerados |
| `Guia-Instalacao.html` e `Guia-Instalacao.pdf` | Este guia para abrir no navegador ou leitor PDF |
| `Documentacao/` | Manual, validação, requisitos, licenças e informações dos arquivos |
| `Codigo-Fonte/Recanto-das-Asas-Codigo-Fonte-0.1.0.zip` | Código para manutenção futura; não precisa executar para instalar |

Tailscale não está incluído no ZIP. Baixe-o pelas fontes oficiais nos passos abaixo. Não é necessário instalar Node.js, npm, programas de desenvolvimento ou o pacote de código-fonte.

## 2. Desbloquear e extrair tudo

1. No Explorador de Arquivos, encontre o ZIP baixado.
2. Clique nele com o botão direito e abra **Propriedades**. Se houver **Desbloquear**, marque e confirme. Se não houver essa opção, continue.
3. Clique com o botão direito no ZIP e escolha **Extrair tudo**.
4. Abra a pasta extraída `Recanto-das-Asas-Instalacao-0.1.0` e mantenha suas subpastas juntas.
5. Abra `Guia-Instalacao.html` ou `Guia-Instalacao.pdf` e siga os próximos passos.

Não execute os instaladores ou comandos de dentro da visualização do ZIP. Os scripts usam PowerShell `RemoteSigned` somente no processo que iniciam; não alteram a política global do Windows. Se aparecer erro de script sem assinatura, consulte a tabela de solução de problemas no fim deste guia.

## 3. Instalar o aplicativo no Windows

1. Abra a pasta **Windows** e execute **Recanto-das-Asas-0.1.0-x64-Setup.exe**.
2. Leia as telas e conclua a instalação. Abra **Recanto das Asas** pelo atalho criado.
3. No primeiro acesso, crie sua base privada com senha de **pelo menos dez caracteres** e confirme a mesma senha.
4. Guarde a senha em um gerenciador ou outro local seguro. Não há recuperação automática; ela também será necessária no Android e para recuperar backups.
5. Para conhecer o aplicativo, use **Demonstração → Criar exemplos fictícios**. O espaço **Meu criatório** começa vazio.

O instalador Windows desta avaliação não tem assinatura Authenticode e pode mostrar aviso de origem. Confira que o nome e o SHA-256 correspondem ao pacote entregue. Se aparecer **“O Windows protegeu o computador”**, leia **Mais informações**. Se você confirmou a origem e o arquivo, pode confirmar **Executar assim mesmo** para este instalador, quando essa opção estiver disponível. Se a opção não aparecer ou houver divergência, preserve o aviso para revisão. Não desative antivírus, SmartScreen ou outras proteções.

Antes de configurar a conexão, entre em **Backup e recuperação**, crie o backup completo e baixe o arquivo `.ra-backup`. Guarde uma cópia fora do computador, em um pendrive ou armazenamento privado. Faça isso também se já tiver registros na instalação.

## 4. Instalar o aplicativo no Android

1. Transfira **Android/Recanto-das-Asas-0.1.0-debug.apk** para seu celular por cabo USB ou armazenamento privado de sua escolha.
2. No Android, abra o aplicativo **Arquivos** ou equivalente e toque no APK recebido.
3. Se o sistema pedir permissão para instalar aplicativos dessa origem, conceda-a somente ao aplicativo usado para abrir esse arquivo. Leia e confirme a instalação.
4. Depois, você pode retirar essa permissão em **Configurações → Aplicativos → Acesso especial → Instalar apps desconhecidos**; o caminho pode variar conforme o fabricante.
5. Abra **Recanto das Asas** e crie a base local com **a mesma senha escolhida no Windows**. Deixe essa base vazia até recuperar os registros no passo 8.

Este APK usa assinatura e identidade de avaliação, separadas da futura versão definitiva. Não apague uma instalação com registros para trocar de versão: faça backup primeiro. A passagem para a versão definitiva exigirá recuperar o backup na instalação correta. Atualizações definitivas usarão a mesma identidade e a chave de assinatura controlada pelo proprietário.

## 5. Instalar o servidor no computador

1. Volte à pasta extraída no Windows e abra **Servidor-Windows**.
2. Execute **01-Instalar.cmd**, com o mesmo usuário que você usa normalmente no computador. Não precisa escolher **Executar como administrador** para esse servidor.
3. Aguarde a mensagem de que o servidor está instalado e respondendo no próprio computador. Leia qualquer erro antes de continuar.
4. Os comandos ficam instalados em `%LOCALAPPDATA%\RecantoDasAsasSync\program`.

O pacote inclui o runtime oficial Node.js **24.21.0**. O servidor guarda uma chave de acesso protegida pelo Windows para esse usuário. Essa chave é diferente da senha da sua base. Configuração, chave e dados privados são criados no computador; não estão no ZIP entregue.

O início automático acontece **depois que você entra nessa mesma conta do Windows**. O servidor não inicia antes do login. Para encontrar os comandos instalados a qualquer momento, pressione **Win + R**, cole `%LOCALAPPDATA%\RecantoDasAsasSync\program` e confirme com Enter.

## 6. Preparar a conexão privada Tailscale

1. Baixe o [Tailscale para Windows](https://tailscale.com/download/windows) pela fonte oficial e instale-o. Ele pode pedir autorização do administrador para sua instalação.
2. Baixe o [Tailscale para Android](https://tailscale.com/download/android) pela fonte oficial indicada e instale-o no celular.
3. Entre na **mesma conta Tailscale nos dois aparelhos** e confira que ambos estão conectados à sua rede privada.
4. No Android, aceite a solicitação de conexão VPN do Tailscale. Outra VPN ativa pode impedir essa conexão.
5. No computador, execute **03-Conectar-Tailscale.cmd**. Se solicitar habilitar HTTPS, abra a página oficial indicada e habilite certificados HTTPS/Serve para sua rede.
6. Aguarde a mensagem de que o HTTPS privado foi configurado e está respondendo. O script guarda o endereço do seu computador.

Confira previamente no [site do Tailscale](https://tailscale.com/pricing) as condições e um plano compatível com o uso no criatório. Não há garantia de gratuidade para atividade comercial. O pacote não contrata serviços nem ativa cobranças automaticamente.

Use **Tailscale Serve**, destinado à rede privada. **Não habilite Funnel**, que publica serviços na internet. Não abra portas no roteador. Se já houver outro serviço na porta HTTPS 443, o comando interrompe a configuração para preservar o que existe.

Você não precisa comprar um domínio ou contratar serviço Google. A emissão do certificado HTTPS pode tornar público o nome DNS do computador nos registros de transparência de certificados; seus registros e documentos permanecem privados. Prefira um nome de dispositivo sem informações pessoais e mantenha somente aparelhos autorizados na sua rede Tailscale.

## 7. Conectar e enviar primeiro a base do Windows

1. No computador, execute **04-Mostrar-Conexao.cmd**.
2. Leia as mensagens. Para revelar a chave na própria janela, digite exatamente **MOSTRAR** e confirme com Enter.
3. Anote ou copie para seus aparelhos os três campos: endereço HTTPS, identificador da base **principal** e chave de acesso.
4. Abra **Sincronização** no aplicativo Windows.
5. Em **Endereço HTTPS do serviço**, informe o endereço mostrado pelo comando, começando com `https://`.
6. Em **Identificador da base**, informe `principal`.
7. Em **Chave de acesso ao serviço**, informe a chave mostrada. Não coloque aqui a senha usada para abrir o aplicativo.
8. Clique em **Salvar conexão** e depois em **Sincronizar agora**.
9. Aguarde a confirmação de sincronização antes de conectar a base vazia do Android.

Não envie a chave neste chat, em capturas de tela ou relatos de problema. A senha da base também deve ser guardada por você. O servidor recebe o conteúdo criptografado, sem a senha necessária para abrir seus registros.

## 8. Buscar a mesma base no Android

1. Confira que o Tailscale do Android está conectado e que o aplicativo foi aberto com **a mesma senha da base do Windows**.
2. Abra **Sincronização** no aplicativo Android.
3. Preencha o mesmo endereço HTTPS, o identificador `principal` e a mesma chave de acesso.
4. Clique em **Salvar conexão** e depois em **Sincronizar agora**.
5. Se aparecer **Revisar conflito**, clique em **Examinar resumo da base remota** e confira que é a base enviada pelo Windows.
6. Escolha **Usar base remota e preservar cópia local**.
7. Confira os registros e abra um documento de exemplo antes de começar a editar.

**Na instalação Android vazia, não escolha “Manter esta base e substituir a remota com confirmação”.** Essa opção substituiria os dados do servidor pela base local. Se o celular já tiver registros próprios, faça backups dos dois aparelhos e revise as diferenças primeiro. Não há combinação automática de fichas conflitantes.

## 9. Testar, guardar backups e usar no dia a dia

Faça os testes antes de inserir dados reais, usando exemplos em **Demonstração**. Os cadastros de demonstração e do criatório são separados, mas backup e sincronização incluem a base inteira. Se já houver dados reais, guarde backups e não faça testes de substituição ou restauração sobre essa base.

| Teste | O que conferir |
| --- | --- |
| Sincronizar cadastro e documento fictícios do Windows | Ambos aparecem no Android e o documento abre |
| Desligar o Wi-Fi do celular, manter 4G/5G e Tailscale ligados | Android sincroniza fora da rede de casa |
| Deixar o Android sem internet e editar um exemplo | Alteração continua local e aparece como pendente |
| Reconectar e usar **Sincronizar agora** | Alteração chega ao Windows sem duplicação |
| Editar o mesmo exemplo nos dois aparelhos antes de sincronizar | Aparece conflito para revisão, sem substituição silenciosa |
| Reiniciar o Windows e entrar no mesmo usuário | Servidor volta após login e os registros permanecem |
| Recuperar um backup numa instalação de avaliação vazia | Registros, vínculos e anexos são recuperados |

O computador deve ficar **ligado, conectado, com seu usuário logado e sem suspender** para o Android sincronizar. Ajuste isso manualmente em **Configurações do Windows → Sistema → Energia e suspensão**, conforme sua necessidade. Os scripts não modificam energia ou suspensão. Quando o servidor estiver indisponível, os registros essenciais continuam no aparelho e as alterações aguardam conexão.

Baixe regularmente backups completos em **Backup e recuperação**. Guarde versões do arquivo criptografado `.ra-backup` em um pendrive ou armazenamento privado fora do aparelho. Preserve a senha separadamente: ela é necessária para restaurar. **Sincronização não substitui backup**, e uma cópia apenas no computador não recupera dados após a perda física dele.

Para recuperar um backup em instalação vazia, crie a base com a mesma senha do backup, selecione o arquivo `.ra-backup`, confira a prévia e só então confirme a recuperação. Preserve também uma cópia dos dados atuais antes de substituir uma base existente.

O limite por envio é de 64 MiB de JSON, aproximadamente 48 MiB de conteúdo criptografado, incluindo anexos. A sincronização transfere a base inteira. Redes móveis lentas ou bases grandes podem ultrapassar o tempo disponível; os dados ficam locais e as tentativas preservam a identificação da alteração. Confira o funcionamento com documentos do tamanho que você pretende usar.

## Comandos do servidor já instalado

Pressione **Win + R**, informe `%LOCALAPPDATA%\RecantoDasAsasSync\program` e abra o comando desejado:

| Comando | O que faz |
| --- | --- |
| `02-Iniciar.cmd` | Inicia ou retoma o servidor local |
| `03-Conectar-Tailscale.cmd` | Prepara e confere o HTTPS privado |
| `04-Mostrar-Conexao.cmd` | Mostra o endereço e, após digitar **MOSTRAR**, a chave |
| `05-Parar.cmd` | Solicita a parada do servidor, preservando dados e outros serviços Tailscale |
| `06-Desativar-Inicio-Automatico.cmd` | Remove somente o atalho de início automático reconhecido |

Desativar o início automático não apaga registros nem encerra o servidor que já estiver rodando. Para encerrar também, execute `05-Parar.cmd`. Não apague arquivos de dados ou travas por tentativa.

## Se algo não funcionar

| Situação | Como verificar |
| --- | --- |
| O ZIP abre mostrando arquivos, mas os comandos falham | Use **Extrair tudo** e execute os arquivos da pasta normal extraída |
| PowerShell informa que o script não está assinado | Volte ao ZIP original, abra **Propriedades → Desbloquear** se disponível e extraia novamente para uma nova pasta. Não altere a política global nem apague a instalação ou os dados privados |
| O Windows mostra aviso de origem do EXE | Confira nome, origem e SHA-256. Veja **Mais informações**; confirme somente este instalador quando a opção estiver disponível e você tiver conferido o arquivo. Sem essa opção ou com divergência, preserve o aviso para revisão. Não desative proteções do sistema |
| Android não permite instalar o APK | Confira Android 10+, arquivo completo e permissão de instalação somente para o aplicativo usado para abri-lo. Se o sistema bloquear, preserve a mensagem para revisão |
| O endereço HTTPS não aparece | Confira login Tailscale, ambos os aparelhos conectados, MagicDNS e certificados HTTPS habilitados. Execute `02-Iniciar.cmd` antes de tentar novamente `03-Conectar-Tailscale.cmd` |
| O comando informa outro serviço na porta 443 | Preserve a configuração existente. Não habilite Funnel nem apague outros serviços para tentar resolver |
| A base não abre ou não consegue decifrar o conteúdo recebido | Confira a senha escolhida no aplicativo Windows e use exatamente a mesma no Android. A chave do servidor não substitui essa senha. Não há recuperação automática de senha |
| Aparece erro **401** | Confira a **Chave de acesso ao serviço** usando `04-Mostrar-Conexao.cmd`. Ela deve ser igual nos dois aplicativos e é diferente da senha da base |
| Aparece conflito | Examine o resumo e preserve backups dos dois lados. Na instalação Android vazia, use a base remota. A combinação automática de fichas não está disponível |
| O desktop está desligado, suspenso, sem login ou sem internet | As alterações ficam pendentes localmente. Retome o computador e a conexão e depois use **Sincronizar agora** |
| O servidor não volta ou informa problema de trava | Execute `02-Iniciar.cmd` e leia a mensagem. Preserve os arquivos; não apague `server.lock` ou a pasta de dados por tentativa |

Se precisar de ajuda, anote a mensagem e os passos realizados. No aplicativo, **Reportar problema** permite revisar e exportar um relato para compartilhar manualmente. Não inclua a chave de acesso, senha, dados de clientes ou documentos pessoais.

## Manutenção e documentos incluídos

Antes de atualizar qualquer aplicativo, guarde um backup completo verificado. Atualizações definitivas precisam preservar a identidade de instalação, assinatura e compatibilidade dos dados. Não desinstale como procedimento normal de atualização. A versão Android de avaliação tem identidade própria; preserve backups para migrar à versão definitiva quando ela for entregue.

Na pasta **Documentacao**, você encontra o manual de uso, o guia detalhado do servidor, os testes executados, as pendências reais, licenças e informações dos arquivos. A pasta **Codigo-Fonte** permite continuar a manutenção com outro desenvolvedor e não é um backup do banco de dados.

O pacote não publica seus registros, não configura integração bancária, não envia mensagens nem fornece um servidor permanente na conversa. A conexão remota, a instalação e o início automático devem ser conferidos nos seus aparelhos conforme o passo 9.
