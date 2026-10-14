# Compilação e manutenção — 0.3.0

## Aplicação web e testes

Requer Node.js 22.13+ e npm. As versões são fixadas no `package-lock.json`.

```bash
cd aplicativo
npm ci
npm test
npm run build
npx playwright install chromium
RECANTO_E2E_PREVIEW=1 npm run test:e2e
```

No Linux do ambiente atual, Chromium está em `/usr/bin/chromium`. Em outro ambiente, configure `RECANTO_CHROMIUM_PATH` ou instale o navegador do Playwright. Os testes PDF usam o programa externo `pdftotext` do pacote Poppler. Em Windows, use PowerShell `$env:RECANTO_E2E_PREVIEW='1'; npm run test:e2e`.

O script `scripts/setup-cloud.sh` instala dependências com lockfile, compila e testa a aplicação. Ele usa caches em `/workspace`, sem alterar dados reais ou a hospedagem original. O projeto extraído `painel-base/` continua separado e utiliza seu próprio pnpm/D1; não é necessário conectar D1 para executar o aplicativo.

## Windows 10/11 — x64

Instale o compilador NSIS oficial e coloque `makensis` no PATH, ou configure `RECANTO_MAKENSIS` com o caminho absoluto. Electron/electron-builder usam os binários oficiais e conferem seus downloads.

```bash
npm run native:windows
```

No ambiente Linux atual, o NSIS oficial já foi obtido pelo cache do electron-builder. Exemplo reproduzível neste ambiente:

```bash
ELECTRON_CACHE=/workspace/tools/electron-cache \
ELECTRON_BUILDER_CACHE=/workspace/tools/electron-builder-cache \
XDG_CACHE_HOME=/workspace/tools/cache \
npm run native:windows
```

O script primeiro compila a web, empacota Electron para Windows e então usa NSIS padrão. O desinstalador é gravado durante a instalação no Windows; a compilação cruzada não precisa executar um EXE ou utilizar Wine. Saída: `release/windows/Recanto-das-Asas-0.3.0-x64-Setup.exe` e `SHA256SUMS.txt`.

A instalação é por usuário em `%LOCALAPPDATA%\Programs\RecantoDasAsas`; dados ficam em `%APPDATA%\RecantoDasAsas`. A reinstalação sobre a versão existente mantém esse perfil. O desinstalador conserva os dados. Faça backup e feche o programa antes de atualizar. Não limpe o perfil como procedimento de atualização.

O instalador gerado é de avaliação, sem assinatura Authenticode. Para distribuição definitiva, use certificado do proprietário, assine o executável aplicativo antes de empacotar, assine o instalador final com a ferramenta oficial e verifique no Windows com `Get-AuthenticodeSignature`. Proteja o certificado e guarde o procedimento de assinatura. `CSC_LINK` ativa a exigência de assinatura no empacotamento, mas o script ainda exige a assinatura externa do instalador NSIS: não interpreta um build sem essa etapa como distribuição assinada. A origem e os avisos do Windows dependem dessa assinatura e da reputação do certificado.

## Android 10+ — SDK 29 mínimo

Requer JDK 21 completo, Android SDK oficial com plataforma 36 e build-tools 35.0.0/36.0.0, acesso aos repositórios oficiais e aceitação dos termos do SDK pelo responsável. Configure `JAVA_HOME` e `ANDROID_HOME`. O bootstrap em `native/bootstrap-android-sdk.py` baixa ferramentas oficiais com checagem de SHA-256; ele não substitui o JDK nem valida aparelhos físicos.

```bash
JAVA_HOME=/caminho/para/jdk-21 \
ANDROID_HOME=/caminho/para/android-sdk \
npm run native:android
```

No ambiente atual:

```bash
JAVA_HOME=/workspace/tools/java/jdk-21.0.12.1+1 \
JAVA_TOOL_OPTIONS=-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts \
ANDROID_HOME=/workspace/tools/android-sdk \
ANDROID_VERSION_CODE=3000 \
npm run native:android
```

A truststore do sistema é usada neste ambiente para a autoridade do proxy corporativo. Não desative verificação TLS. O script traduz o endereço de HTTP(S)_PROXY para propriedades Java sem gravar credenciais. O Gradle wrapper usa versão 8.14.3 e checksum oficial. Caches/chave de avaliação estão fora do projeto, em `/workspace/tools`; o código não contém keystore ou senhas.

O processo faz build web, sincronização Capacitor, `assembleDebug` e `lintDebug`. Saída: `release/android/Recanto-das-Asas-0.3.0-debug.apk` e seu `.sha256`. Confira a assinatura com `apksigner verify --verbose --print-certs` e o manifesto com `aapt dump badging`. O debug usa `br.com.recantodasasas.app.debug`, separado da identidade definitiva. Para atualizar a instalação de avaliação existente, conserve a mesma chave externa de avaliação; não desinstale nem limpe os dados.

Para APK definitivo, forneça por configuração segura `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`, então:

```bash
npm run native:android -- --release
```

A identidade release é `br.com.recantodasasas.app`. Use o mesmo keystore em todas as futuras versões e aumente o versionCode. A versão 0.3.0 gera versionCode 3000, superior ao 2004 utilizado na avaliação 0.2.3; `ANDROID_VERSION_CODE` permite definir um valor maior explicitamente. Não guarde a chave no Git. A perda dela impede atualizar a instalação original. Antes de passar do debug para release, exporte e restaure um backup usando a mesma senha, pois são aplicações separadas.

## Servidor privado Windows e build web comum

```bash
npm run sync:windows
```

O ZIP local `release/servidor-windows/Recanto-das-Asas-Servidor-Windows-0.3.0.zip` inclui Node.js oficial 24.21.0, conferido pelo SHA-256 fixado no script, o servidor e os auxiliares Windows. Não inclui dados, configuração, token ou chave de assinatura. Para reutilizar o arquivo oficial já conferido neste ambiente:

```bash
node scripts/package-sync-windows.mjs \
  --runtime-archive=/workspace/tools/recanto-sync-runtime/node-v24.21.0-win-x64.zip
```

Para empacotar APK e EXE a partir de um único build web final, execute `npm run build` uma vez e use `node scripts/package-android.mjs --skip-web-build` e `node scripts/package-windows.mjs --skip-web-build` com as variáveis descritas acima. Confira os hashes de todos os arquivos de `dist/` dentro dos dois pacotes. A opção pressupõe que esse build esteja atualizado e validado; não altere `dist/` enquanto os pacotes são gerados.

## Atualização e retorno

Antes de gerar outra versão, atualize `package.json`, a versão padrão em `src/domain/types.ts`, os textos de versão em `src/App.tsx` e o histórico da página Atualizações. A versão registrada em dados restaurados também precisa de uma migração explícita se for usada como metadado da versão instalada. A página Atualizações mostra versão, mudanças e caminho manual. Não existe serviço privado permanente de distribuição configurado. Verificar atualização web busca o service worker na mesma origem; isso não atualiza automaticamente APK/EXE.

Uma atualização definitiva exige pacote assinado, checksum, identidade compatível, backup e teste de instalação sobre a versão anterior. A versão 0.3.0 migra bases dos esquemas 1/2 para o 3, conservando registros e anexos. Atualize primeiro o servidor privado e depois ambos os aplicativos, antes de editar ou sincronizar a base migrada. O servidor mantém o protocolo criptografado e bloqueia clientes antigos após aceitar a primeira gravação de esquema 3. Preserve `data`, `config.json` e `token.dpapi` em `%LOCALAPPDATA%\RecantoDasAsasSync`, use a conta Windows original e mantenha a configuração Tailscale existente. Os passos de parada, atualização e recuperação estão em [ATUALIZACAO_0.3.0.md](ATUALIZACAO_0.3.0.md) e [SERVIDOR_WINDOWS.md](SERVIDOR_WINDOWS.md).

O APK de avaliação deve conservar a identidade e o certificado da versão 0.2.3, além de aumentar o versionCode; a comparação dos artefatos não substitui a atualização em aparelho físico. Para retorno, restaure cópia de esquema compatível em instalação compatível; preserve também cópias posteriores. Não execute aplicativo antigo sobre banco novo.

Para preparar o pacote privado local a partir dos instaladores já compilados e do código commitado, execute `python3 scripts/package-update.py --output /tmp/recanto-atualizacao`. A pasta deve estar vazia. O script divide o EXE em partes de até 48 MiB, gera o preparador PowerShell compatível com Windows 10, inclui os checksums, as instruções e um ZIP do código-fonte. O preparador confere o SHA-256 antes de liberar o instalador. Esse empacotamento local não publica nem transfere os arquivos; qualquer entrega externa depende de autorização própria.

## Artefatos e limites

`release/`, `dist/`, `node_modules/`, caches, arquivos `local.properties`, keystores e dados de servidor são ignorados pelo Git. Os instaladores gerados são arquivos locais desta execução; para outra máquina, recompile ou transfira os arquivos de avaliação de modo privado. Nenhuma loja ou hospedagem foi usada para distribuir a entrega.

Compilação de APK/EXE, verificação de estrutura/assinatura de debug e testes de navegador não equivalem a testes de instalação, impressão ou atualização em Android/Windows físicos. Confira esses passos nos aparelhos, conservando um backup anterior.
