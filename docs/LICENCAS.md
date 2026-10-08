# Dependências, licenças e custos

As versões estão fixadas em `aplicativo/package-lock.json`. O [inventário completo](LICENCAS_DEPENDENCIAS.json) inclui nome, versão, licença declarada, dependência de desenvolvimento e condição opcional. Entradas sem declaração exigem consultar o pacote original antes de redistribuir; o inventário não substitui seus avisos legais. Preserve licenças e notices ao distribuir instaladores.

| Dependência principal | Uso | Licença declarada |
| --- | --- | --- |
| React/React DOM | Interface | MIT |
| TypeScript, Vite, Vitest, Zod | Compilação, testes e validação | Apache-2.0 / MIT conforme pacote |
| Capacitor | Android/WebView | MIT |
| Electron/electron-builder | Windows/Chromium e empacotamento | MIT; runtime Chromium inclui notices adicionais |
| pdf-lib e fontkit | PDFs e fonte incorporada | MIT |
| ExcelJS e DOCX | XLSX e DOCX reais | MIT |
| JSZip | Backup/pacotes | MIT ou GPL-3.0-or-later; utilização pela alternativa MIT |
| Lucide | Ícones de interface | ISC |
| Playwright e fake-indexeddb | Testes | Apache-2.0 |
| Noto Sans | Caracteres brasileiros em PDF | SIL Open Font License 1.1, arquivo OFL em `aplicativo/public/fonts/` |
| NSIS | Instalador Windows | zlib/libpng, com licenças próprias dos plugins/ferramentas oficiais |
| Node.js 24.21.0 portátil x64 | Servidor no desktop Windows | MIT e avisos de dependências incorporadas; licença oficial completa incluída no ZIP em `NODE-LICENSE.txt` |
| OpenJDK/Temurin, Gradle e Android SDK | Ferramentas de compilação | Termos próprios; JDK GPLv2 com Classpath Exception e Gradle Apache-2.0; Android SDK requer aceite dos termos oficiais |

A aplicação incorpora os originais aprovados da identidade visual recebida. Não cria licença nova para a marca nem presume direitos de terceiros além da autorização do proprietário para este projeto. A base preserva seu arquivo `painel-base/vendor/shadcn-tailwind-4.13.0.LICENSE.md` e demais notices.

O código local não impõe mensalidade ou assinatura para acessar os registros. O servidor de sincronização não exige biblioteca paga. Custos possíveis são VPS/disco, domínio, VPN, backup externo, administração e certificado Authenticode. Nenhum serviço, certificado ou conta foi contratado. Não há API de IA, banco, pagamento, WhatsApp, e-mail ou suporte comercial automática embutida.

Na revisão, `npm audit --omit=dev` apontou o UUID transitivo de ExcelJS. A resolução foi fixada em UUID 11.1.1, com exportações CommonJS compatíveis, e os testes de arquivos foram repetidos. A consulta posterior não apresentou vulnerabilidades nas dependências de execução. Isso é o resultado da base de avisos no momento da execução, não uma garantia permanente. Ferramentas de desenvolvimento e binários devem continuar sendo atualizados e revisados pelo mantenedor.
