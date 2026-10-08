# Relatório de validação — 0.1.0

Executado no ambiente Linux em 8 de outubro de 2026 UTC. Dados exclusivamente fictícios. A base D1 e a hospedagem de produção não foram acessadas. Esta validação cobre o código e os artefatos descritos, com pendências de aceite registradas separadamente.

## Resultado executado

| Verificação | Resultado |
| --- | --- |
| ZIP original, caminhos e conteúdo extraído | CRC e SHA-256 conferidos; 202 arquivos preservados byte a byte |
| Instalação reproduzível | `scripts/setup-cloud.sh`: `npm ci`, build e testes concluídos; lockfile preservado |
| TypeScript estrito + Vite | `npm run build` aprovado; recursos de exportação divididos em chunks, sem aviso de tamanho do build final |
| Domínio, arquivos, armazenamento e rede | `npm test`: 145 testes aprovados em seis arquivos; nenhuma falha/omissão, incluindo parada por pipe e fechamento do supervisor |
| Auxiliares do servidor Windows | PowerShell oficial em Linux: 29 verificações aprovadas; sintaxe, substituição de configuração, concessão exclusiva, preservação de trava ativa/corrupta/externa e rejeição de Funnel/foreground na porta 443 |
| Navegador Chromium em build de produção | Sete fluxos completos aprovados; inclui viewport 390×844 e modo offline |
| PDFs | `pdftotext` externo e pdf-lib: caracteres brasileiros, paginação, cabeçalhos, privacidade e A5/A6/A4 corretos |
| XLSX e DOCX | XLSX reaberto por ExcelJS com valores/células; DOCX inspecionado como ZIP/XML; CSV UTF-8 com proteção contra fórmulas |
| Android | APK debug compilado com JDK 21, SDK 36 e Gradle 8.14.3; `lintDebug` sem erros no aplicativo |
| Assinatura/manifesto Android | `apksigner verify`: assinatura v2 válida; pacote `.debug`, versão 0.1.0-debug, versionCode 1000, mínimo SDK 29 |
| Recursos dentro do APK | Arquivos de `dist/`, fontes e artes comparados byte a byte com `assets/public/` |
| Windows | Electron x64 empacotado e instalador NSIS real compilado em Linux; checksum e estrutura PE conferidos |
| Avisos de segurança das dependências de execução | `npm audit --omit=dev`: zero avisos após correção do UUID transitivo de ExcelJS |
| Ambiente reutilizável | Inicialização em loopback conferida por HTTP; `install_script` e `start_skill` atualizados no rascunho do onboarding |

Os detalhes de tamanho e SHA-256 dos instaladores finais estão em [ARTEFATOS.json](ARTEFATOS.json). Os instaladores ficam em `aplicativo/release/` e são ignorados pelo Git. O rascunho do ambiente foi salvo para revisão; isso não publica um snapshot nem implanta o aplicativo.

O pacote adicional do servidor Windows inclui o Node.js 24.21.0 x64 oficial, verificado pelo SHA-256 do ZIP de origem. A geração valida CRC; o manifesto interno registra o hash de cada arquivo. Não contém token, registros ou backups. Os testes PowerShell foram executados em Linux, não no Windows do proprietário: DPAPI, ACLs nativas, atalho após login, Tailscale Serve/certificado e comunicação pelo Android em 4G/5G permanecem verificações nos aparelhos. O guia está em [SERVIDOR_WINDOWS.md](SERVIDOR_WINDOWS.md).

## Testes de domínio e integração

- Identificação/microchip duplicados, datas inválidas, pais/espécie/sexo, ciclos genealógicos, isolamento real/demo, fontes e históricos de sexagem/mutação e movimentos de responsabilidade.
- Casais ativos incompatíveis, parentesco confirmado, posturas/ovos, fertilidade separada do resultado, eclosão única e filhote com vínculos, saúde, pesos, tarefas e exclusões que preservam histórico.
- Orçamento/reserva/venda, parcelas em centavos, sinais/parciais, repetição de recebimento, devolução/reembolso, disponibilidade, estoque, quantidade/limites, saldo, transferências, fechamento e conciliação.
- Cronologia de entrega/devolução/recebimento/reembolso e preservação do histórico dos responsáveis.
- Anexos por assinatura/extensão/tamanho/hash, versões, relatórios/filtros/indicadores, PDF longo, CSV, XLSX, DOCX e livreto com cada página exatamente uma vez na folha/lado correto.
- Criptografia/persistência, senha incorreta, arquivos binários de 8 MiB, adulteração, gravações simultâneas de duas instâncias, reserva concorrente com exatamente uma venda/parcela, importação atômica, backup/manifesto e restauração limpa.
- Subprocesso real do servidor, autenticação, CORS incluindo `app://recanto` e `https://localhost`, espaços, reinício, disco, disputa de revisão, conflito, erro de rede, repetição idêntica após resposta perdida, fila compactada e adoção recusada quando a base mudou.

## Sete fluxos de navegador

1. Criar base, cadastrar ave, rejeitar duplicidade mantendo o formulário, recarregar/desbloquear, separar demonstração e bloquear.
2. Baixar uma arte original e emitir caderneta real em PDF com versão preservada.
3. Navegar e cadastrar ave com largura de 390 pixels, sem transbordamento horizontal.
4. Contato/conta, reserva de ave, duas parcelas, sinal de R$ 200 em operação de R$ 1.000, venda, entrega ainda parcial e devolução com reembolso, terminando com saldo esperado.
5. Anexar arquivo à ave, baixar backup completo cifrado, abrir outro contexto de navegador sem base, verificar/confirmar restauração e recuperar os mesmos bytes do anexo e vínculo.
6. Build de produção com cache pronto, desconexão e recarga offline, recuperação da ave e do catálogo de artes.
7. Relato de suporte com formatos fictícios de dados pessoais/token, exportação removendo esses dados e sem incluir cadastro da ave.

## Correções reconfirmadas

A revisão corrigiu caminhos das artes, preservação de fontes no PDF imposto, conversão base64 de arquivos grandes, proteção de revisões em restaurações/adoção remota, repetição de operação após resposta perdida, cópias de conflito preservadas no mesmo dia, concorrência do backup automático com restauração, conclusão de operação após bloqueio da sessão e cronologia/histórico comercial. As suítes afetadas foram executadas novamente após as mudanças. As falhas anteriores não estão contadas como aprovação.

A preparação nativa também corrigiu sintaxe de versão Gradle, uso de JDK completo, confiança TLS do proxy pelo certificado do sistema, compatibilidade de MIME para exportar os originais e compilação do instalador NSIS sem executar binário Windows. Verificações de assinatura e checksums não foram desabilitadas.

## Avisos e testes não executados

A instalação npm mostra avisos de descontinuação de dependências transitivas, principalmente ferramentas de build. O lint Android mantém avisos de recursos/ícones e de dependências geradas; o aplicativo tem zero erros de lint. Capacitor traz baseline de terceiros que filtra erros existentes na biblioteca e três recomendações. Esses avisos não foram suprimidos no código do projeto para produzir um resultado limpo artificialmente.

Não foram testados em aparelhos físicos: instalação/abertura Android e Windows, impressão real, salvamento/compartilhamento Android, atualização sobre uma versão anterior e recuperação após perda física. Não há versão adaptada instalada anterior nem chaves definitivas para esse ciclo. O instalador Windows não tem Authenticode; o APK usa chave e identidade de avaliação.

Não foram executados Microsoft Excel/Word nem impressoras; PDF foi lido por um programa externo, XLSX/DOCX foram inspecionados por leitores de formato. Inspeção da imposição não equivale a impressão frente e verso efetivamente realizada.

Não há hospedagem/VPN/proxy HTTPS remotos implantados, sincronização entre aparelhos físicos ou integrações bancárias/mensageria. O serviço foi testado em rede local automatizada. As funções de desenvolvimento ainda pendentes, incluindo custos/recorrências/templates e consultas completas, estão na [matriz](MATRIZ_REQUISITOS.md).

Os testes executados passaram. Isso não estabelece ausência absoluta de bugs ou aceite de requisitos não implementados/não executados. Use primeiro a demonstração e faça homologação com exemplos nos dois aparelhos antes de introduzir a base real.
