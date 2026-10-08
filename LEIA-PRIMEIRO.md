Correção 0.1.1 da criação de cadernetas e demais PDFs.

A fonte Noto Sans agora é incorporada integralmente: a versão anterior gravava o texto, mas quase todas as letras desapareciam ao exibir ou imprimir. Corrigidos os formatos A5/A6, individuais e em livreto A4. O arquivo PDF fica maior para conservar a fonte completa.

## Download e atualização

1. Clique em **Source code (zip)** abaixo. Esse ZIP contém os instaladores de atualização e os dois PDFs corrigidos enviados para análise.
2. Extraia tudo em uma pasta curta no Windows.
3. Faça e guarde um backup da base nos dois aparelhos antes de atualizar. Feche o aplicativo Windows.
4. Execute **01-Preparar-Windows.cmd**, que reúne as três partes e verifica o instalador. Execute o EXE 0.1.1 gerado para atualizar na mesma pasta/conta de usuário.
5. Transfira **Recanto-das-Asas-0.1.1-debug.apk** para o Android e escolha **Atualizar**. Não desinstale o aplicativo atual. O APK mantém a identidade e a assinatura da versão 0.1.0, com versionCode aumentado de 1000 para 1001.
6. Abra o aplicativo, confira seus registros e gere uma nova caderneta. PDFs antigos arquivados permanecem como foram emitidos; emita uma nova versão para obter a correção.

O servidor e o Tailscale não precisam ser reinstalados nem reconfigurados.

Os exemplos recuperados estão na pasta **Cadernetas-corrigidas**. O conteúdo e a ordem das páginas são idênticos aos PDFs enviados; somente a fonte e o mapeamento das letras foram reparados.

## Verificação

146 testes automatizados, 7 cenários de navegador, compilação TypeScript/Vite e compilação/lint Android passaram. O novo teste rasteriza os PDFs e detecta o desaparecimento das letras; a versão anterior falha nesse teste. A aparência dos PDFs corrigidos foi inspecionada e o texto foi comparado com os originais. Assinatura APK validada, idêntica à versão anterior.

A atualização sobre uma instalação física Android/Windows ainda precisa ser confirmada pelo proprietário. Instalador Windows sem Authenticode e APK de avaliação privada. Se o Android não oferecer Atualizar, interrompa e relate o aviso sem desinstalar.

Código da correção na branch **correcao/caderneta-0.1.1**. Esta tag aponta para o pacote de atualização para disponibilizar os binários pelo download ZIP do GitHub privado.
