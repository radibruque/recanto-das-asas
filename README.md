# Recanto das Asas

Aplicativo privado em português para criação e operação comercial, desenvolvido a partir do painel React/TypeScript fornecido. Destinos: Android 10 ou superior, Windows 10/11 de 64 bits e navegador. Os registros locais funcionam sem internet e ficam criptografados; a sincronização usa um serviço privado, que pode funcionar no seu Windows com Tailscale.

O ZIP foi extraído preservando sua organização. `painel-base/` e `identidade-visual/` são os originais recebidos, conservados para consulta. `PROMPT_DESENVOLVIMENTO.txt` mantém o escopo completo. A adaptação está em `aplicativo/`; a hospedagem anterior não foi modificada.

## Executar e verificar

Requer Node.js 22.13 ou superior:

```bash
cd aplicativo
npm ci
npm run dev
```

Acesso local: `http://127.0.0.1:5174`. Crie uma senha com pelo menos dez caracteres e guarde-a: não existe recuperação automática. A base real começa vazia. A demonstração só é preenchida quando solicitada e tem registros e exportações identificados separadamente.

```bash
npm test
npm run build
RECANTO_E2E_PREVIEW=1 npm run test:e2e
```

Os testes de navegador requerem Chromium, instalado com `npx playwright install chromium`, ou `RECANTO_CHROMIUM_PATH` apontando para uma instalação existente. A configuração também reconhece `/usr/bin/chromium`.

## Atualização 0.3.0 — simplificação e integração

Setores Criatório/Comercial na mesma base, busca global local, navegação com contexto, ficha e pesagem rápidas, reprodução integrada, catálogo de espécies, agenda derivada, compras ligadas ao financeiro e revisão de entrega. Biometria Android opcional e sessão mantida na memória ao minimizar. Os temas e a identidade visual existentes foram preservados.

Veja [a matriz e os novos caminhos](docs/ENTREGA_SIMPLIFICACAO_0.3.0.md) e [como atualizar e recuperar](docs/ATUALIZACAO_0.3.0.md). Faça backups verificados e atualize **o servidor Windows antes dos aplicativos**, mantendo dados, configurações e Tailscale. Não desinstale para atualizar. A entrega 0.3.0 é local; nenhuma nova publicação foi realizada.

## Atualização 0.2.3 — atalhos Android

A barra fixa de atalhos foi habilitada também no APK Android. Esta foi a base funcional preservada para a evolução 0.3.0.

## Atualização 0.2.2 — correção do menu e atalhos web

Correção do menu Android que se dividia em colunas e cortava os itens durante a rolagem. No navegador, miniaturas maiores e uma barra fixa inferior para cadastrar ave, Aves, Casais, Financeiro e todos os menus. Os dados e módulos existentes permanecem os mesmos.

Veja [a análise e como atualizar](docs/ATUALIZACAO_0.2.2.md) e a [entrega privada 0.2.2](https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.2-menu-atalhos-avaliacao).

## Atualização 0.2.1 — conceitos B/C

Navegação superior e dashboard B no Windows; ficha e histórico C no Android. Início e Aves usam listas horizontais com miniaturas, e os temas seguem a identidade visual oficial. As correções de processamento reduzem pausas em fotos, históricos e backups, preservando formatos, validações, dados e sincronização.

Veja [como instalar a atualização](docs/INSTALACAO_BC_0.2.1.md), o [relatório de implementação e validação](docs/REDESIGN_BC_0.2.1.md) e a [entrega privada com instaladores](https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.1-bc-avaliacao). Faça backup em ambos os aparelhos e atualize sobre a instalação existente, mantendo o servidor local e o Tailscale atuais.

## Atualização 0.2.0

Anexos diretamente nos cadastros, acervo com filtros e prévias, saúde e manejo agrupados por ave, agenda com integração ao calendário, histórico comercial por contato, vendas e reservas separadas e fechamento de caixa com resumo preservado. A caderneta passa a usar somente o modelo digital vertical de quatro páginas fornecido, com foto e campos revisáveis. A exportação Android transfere o arquivo em partes e verifica tamanho e integridade antes de abrir o destino.

Veja [como atualizar preservando os dados](docs/ATUALIZACAO_0.2.0.md). Atualize Android e Windows antes de voltar a editar ou sincronizar: a nova versão lê a base anterior e grava o esquema 2, que os aplicativos antigos recusam.

## Entrega inicial 0.1.0

Cadastro e históricos das aves, genealogia, reprodução, saúde, agenda, clientes, reservas, vendas parceladas, recebimentos parciais, devoluções, financeiro, conciliação manual, estoque, documentos e relatórios, caderneta A5/A6, artes originais, backups criptografados e sincronização com conflitos estão implementados. A matriz registra os detalhes e as funções ainda pendentes; esta versão não representa aprovação de todos os requisitos do prompt.

Instaladores compilados ficam em `aplicativo/release/`, com SHA-256. São arquivos de avaliação: APK debug com identidade separada e instalador Windows sem assinatura Authenticode. A instalação e a atualização em aparelhos físicos ainda precisam ser verificadas. Os binários e caches não fazem parte do controle de versão; o código de compilação está incluído.

- [Manual de uso](docs/MANUAL.md)
- [Arquitetura e armazenamento](docs/ARQUITETURA.md)
- [Compilação, assinatura e atualização](docs/COMPILACAO.md)
- [Hospedagem para sincronização](docs/HOSPEDAGEM.md)
- [Servidor no seu Windows 10 com acesso privado pelo Android](docs/SERVIDOR_WINDOWS.md)
- [Instalação completa no Windows e Android](docs/INSTALACAO_COMPLETA.md)
- [Matriz de requisitos e pendências](docs/MATRIZ_REQUISITOS.md)
- [Resultados de validação](docs/VALIDACAO.md)
- [Dependências, licenças e custos](docs/LICENCAS.md)

O código não exige assinatura mensal para utilizar os dados locais. Hospedagem, domínio, cópias externas e certificados de assinatura dependem das opções escolhidas pelo proprietário. Nenhum serviço foi contratado ou publicado.
