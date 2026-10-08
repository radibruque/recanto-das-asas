# Recanto das Asas

Aplicativo privado em português para criação e operação comercial, desenvolvido a partir do painel React/TypeScript fornecido. Destinos: Android 10 ou superior e Windows 10/11 de 64 bits. Os registros locais funcionam sem internet e ficam criptografados; a sincronização entre aparelhos depende de um serviço privado que ainda precisa ser hospedado.

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

## Entrega 0.1.0

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
