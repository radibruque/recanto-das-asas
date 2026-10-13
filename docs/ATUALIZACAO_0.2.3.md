# Atalhos no Android — 0.2.3

A barra fixa de atalhos, disponível no navegador na entrega 0.2.2, agora aparece também no APK Android. Os cinco botões usam as operações existentes: cadastrar ave, abrir Aves, Casais e Financeiro, e abrir todos os menus. Há espaço reservado abaixo do conteúdo para a barra, com ícones acima dos rótulos em telefones e tablets e cores dos temas claro e escuro.

Esta atualização mantém a correção da rolagem vertical do menu entregue em 0.2.2. As miniaturas maiores continuam na versão web. O instalador Windows e o servidor privado podem continuar na versão anterior: esta alteração é de apresentação, com os mesmos formatos de dados, protocolo de sincronização, regras e credenciais.

## Instalar no telefone

1. Faça um backup completo no aplicativo e guarde o arquivo.
2. Entre no GitHub com a conta que tem acesso ao repositório privado e abra a [entrega 0.2.3](https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.3-atalhos-android-avaliacao).
3. Em **Assets**, baixe **Source code (zip)**. Extraia o ZIP e abra `Recanto-das-Asas-0.2.3-debug.apk` pelo aplicativo Arquivos.
4. Confirme **Atualizar**, mantendo a instalação existente. Não desinstale o aplicativo: a base local fica na instalação atual.
5. Abra com a senha atual, confirme **0.2.3** no rodapé e confira os cinco atalhos inferiores. Teste cadastrar e cancelar, abrir Aves, Casais e Financeiro, e abrir/rolar o menu completo.

O APK mantém o pacote `br.com.recantodasasas.app.debug`, a mesma assinatura de avaliação, origem HTTPS `localhost`, mínimo Android 10 e código de versão **2004**, superior ao 2003 anterior. O servidor Windows e o Tailscale não precisam de reinstalação para esta atualização.

## Escopo

O componente e os eventos de navegação já existiam. A mudança de apresentação está em `aplicativo/src/web-shortcuts.css`: habilita a barra e seu espaçamento inferior para `data-platform='android'`, preservando os estilos de miniaturas específicos do navegador e a apresentação do Windows. Não foi necessário alterar código nativo, banco, autenticação, sincronização, dependências ou regras de negócio.

A versão foi atualizada em `aplicativo/package.json`, nas duas entradas de versão do pacote raiz em `package-lock.json`, em `src/domain/types.ts` e no histórico de `src/modules/Settings.tsx`. O teste de suporte foi ajustado para esperar a versão atual e os testes de atalhos passaram a verificar a apresentação Android.

O desenvolvimento foi isolado na branch `fix/atalhos-android-0.2.3`, a partir de `df86ae54dcccf6d2e9dbd87a39734c0d495ac0ad`. A branch principal foi preservada.

## Validação

Passaram o build de produção, 269 testes unitários e 66 testes de navegador, sem falhas, ignorados ou instáveis na rodada final. O lint Android terminou com zero erros e os mesmos 30 avisos e cinco sugestões. Resultados, capturas de bases fictícias isoladas e verificações do APK ficam em [atalhos-android-0.2.3](atalhos-android-0.2.3/README.md). Não há aparelho Android físico disponível neste ambiente; os testes de apresentação usam Chromium com a plataforma Android do Capacitor simulada. A instalação sobre a versão atual e o comportamento do teclado/barras do sistema devem ser conferidos no telefone. Nenhum dado, vídeo ou credencial real do usuário acompanha o pacote.

Para recompilar este APK, use `ANDROID_VERSION_CODE=2004 npm run native:android` (ou defina a variável equivalente no PowerShell). Isso conserva a sequência dos códigos das entregas anteriores.
