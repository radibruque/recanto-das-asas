# Recanto das Asas — correção do menu e atalhos web 0.2.2

A gravação enviada mostrou o menu lateral do Android com itens cortados, espaços vazios e deslocamento horizontal durante a rolagem. A reprodução da versão 0.2.1 confirmou a causa: a regra responsiva de desktop abaixo de 1250 px definia `flex-wrap: wrap`. O menu Android, organizado verticalmente e limitado à altura da tela, herdava essa regra e distribuía marca, navegação e controles da base em três colunas.

Um painel de 319 px úteis passava a conter 846 px de conteúdo. A rolagem deslocava essas colunas e deixava partes do menu fora da tela. A correção mantém painel e navegação em uma única coluna, preserva o tamanho da marca/rodapé e contém a rolagem vertical. Na reprodução de 360×708 px, o painel e seu conteúdo agora medem os mesmos 319 px; a navegação fica entre x=16 e x=303, e o rodapé é acessível ao rolar.

No ambiente web, as miniaturas do plantel aumentaram para 60×60 px no desktop e 56×56 px em telas compactas, no início e em Aves. A barra fixa inferior oferece Cadastrar ave, Aves, Casais, Financeiro e Abrir todos os menus. Os atalhos acionam os formulários e módulos existentes. Menus usa a mesma navegação de 20 destinos; abre um painel vertical no desktop e no web compacto. Escape fecha o painel. A barra respeita a área segura do aparelho e reserva espaço ao final do conteúdo.

No Android instalado, foi corrigido o menu lateral. A barra e as miniaturas maiores são específicas do navegador, conforme o pedido. O Windows instalado mantém sua apresentação B. Não houve mudança em banco, regras, autenticação, sincronização, APIs ou dependências. O código de atualização Android é 2003, posterior ao 2002 da entrega 0.2.1, com a mesma assinatura.

## Instalar

1. Faça e guarde um backup completo em cada aparelho. Feche os aplicativos.
2. Entre no GitHub com a conta que tem acesso ao repositório privado e abra a [entrega 0.2.2](https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.2-menu-atalhos-avaliacao). Em Assets, baixe **Source code (zip)** e extraia todas as pastas.
3. Android: abra `Recanto-das-Asas-0.2.2-debug.apk` pelo aplicativo Arquivos e confirme **Atualizar**, mantendo a instalação e os dados atuais.
4. Windows: mantenha juntas as três `Windows.parte*`, `01-Preparar-Windows.cmd` e `Preparar-Windows.ps1`. Execute o CMD para reunir as partes e conferir SHA-256; depois execute `Recanto-das-Asas-0.2.2-x64-Setup.exe` sobre a instalação existente.
5. Abra com a senha atual e confirme **0.2.2** no rodapé. O servidor local e o Tailscale não precisam de reinstalação.
6. No Android, abra o menu e role até Aparência, Base privada e Bloquear. Reabra e confira os destinos. No navegador, confira os cinco atalhos e as fotos maiores.

O APK mantém a identidade debug de avaliação e o Windows continua sem assinatura comercial. A instalação nos aparelhos físicos e a conferência no telefone do vídeo precisam ser confirmadas pelo usuário. As capturas da pasta `correcao-menu-0.2.2` usam somente bases isoladas de teste; a gravação e os registros reais do usuário não foram incluídos no repositório ou no pacote.

## Validação e alterações

Passaram o build, **269 testes unitários e 61 testes de navegador**, sem falhas, testes ignorados ou repetições na rodada final. Os 49 testes anteriores permanecem ativos; seis testes novos reproduzem o menu Android/web e seis cobrem os atalhos, cadastro repetido, persistência e busca, miniaturas 56/60 px, acesso a todos os 20 módulos, Escape e barra fixa sem cobrir os controles. Os 94 recursos e dois workers coincidem no APK e no pacote Windows, incluindo cache offline. Os 221 PNGs do APK são idênticos aos anteriores. Android mantém assinatura, pacote, mínimo Android 10 e código 2003; lint possui zero erros e os mesmos 30 avisos. O cabeçalho/CRC NSIS Windows, origem e perfil foram conferidos. [Tamanhos e SHA-256](ARTEFATOS_0.2.2.json).

Arquivos de aplicação alterados: `aplicativo/src/App.tsx`, `src/main.tsx`, `src/bc-layout.css`, novos `src/components/WebShortcuts.tsx` e `src/web-shortcuts.css`; versão em `src/domain/types.ts`, `package.json`, `package-lock.json` e texto do histórico em `src/modules/Settings.tsx`. Os novos testes de navegador cobrem as colunas/rolagem do menu e os atalhos, incluindo cancelar/reabrir cadastro, salvar/recuperar dados, fotos maiores e todos os destinos. O teste funcional existente de suporte atualiza somente a versão esperada.

Para recompilar esta entrega Android, use `ANDROID_VERSION_CODE=2003 npm run native:android` (ou defina a variável equivalente no PowerShell). O código explícito mantém a sequência das entregas de avaliação anteriores.

O pacote também contém `Recanto-das-Asas-Web-0.2.2.zip`, com o build web compilado. Caso já publique a versão de navegador, utilize o conteúdo de `dist` na mesma origem HTTPS existente para conservar a base do navegador. O APK e o instalador Windows carregam o build nativo correspondente. Nenhuma hospedagem nova foi configurada. O mecanismo existente de Atualizações permite verificar e ativar uma atualização web após o backup.
