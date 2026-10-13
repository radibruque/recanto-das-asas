# Recanto das Asas — implementação B/C 0.2.1

## Resultado e escopo

O Windows usa a estrutura B: navegação superior azul com marca oficial, ícones sobre os rótulos, oito indicadores existentes, plantel com miniaturas e informações em linhas, tarefas e resumo financeiro à direita. No Android, a estrutura C apresenta cabeçalho compacto, fotografia, identificação, situação, peso atualizado, ações, abas e histórico recente de saúde e manejo. O início e o menu Aves utilizam uma lista horizontal compartilhada, sem cartões individuais. Abrir uma linha apresenta a ficha existente.

Os temas Claro, Escuro e Sistema usam azul, azul-petróleo e tons suaves da identidade oficial. A fonte local Noto Sans variável recebeu declaração dos pesos reais; títulos e ações usam negrito legível. A marca colorida e o símbolo oficial permanecem intactos; o símbolo aparece discretamente no painel. Nenhuma arte oficial, modelo PDF ou dependência foi substituída.

O trabalho parte de `c1611689dfa6f4621c9f9c4950274bce635d809a`, preservado como ponto de restauração, na branch `design/b-desktop-c-android`. As correções de processamento autorizadas acompanham o redesign. Não houve migração de banco, alteração de regras financeiras, de autenticação, de protocolo/endpoint de sincronização ou de dados existentes. As fórmulas do dashboard são as mesmas; os conteúdos adicionais continuam disponíveis em “Situação do plantel, reservas, entregas e estoque”.

## Arquivos de aplicação

| Grupo | Arquivos e responsabilidade |
|---|---|
| Estrutura compartilhada | `aplicativo/src/App.tsx`, `src/main.tsx`: apresentação por plataforma, navegação, controles da base e dashboard; destino de cada operação mantido. Menus fecham após a escolha e devolvem o foco. |
| Estilos | `src/style.css`, novo `src/bc-layout.css`: tokens, paleta, fonte, listas, cabeçalhos, fichas, responsividade e movimento reduzido. |
| Inicialização do tema | `index.html`, `public/theme-init.js`, `public/manifest.webmanifest`: cores de fundo e navegador alinhadas aos temas; mecanismo de preferência existente mantido. |
| Aves | Novo `src/components/BirdCollection.tsx`, `src/modules/Breeding.tsx`: listas com foto, seleção real da ave, ficha reorganizada, todas as abas/campos/operações existentes. |
| Histórico | `src/components/HealthHistory.tsx`, `src/domain/breeding.ts`: linha do tempo e agrupamento de históricos em uma passagem, preservando os registros e a ordenação anterior. A evolução de peso continua na aba Saúde e peso. |
| Miniaturas | `src/components/DirectAttachments.tsx`, novos `src/lib/attachment-preview.ts`, `.worker.ts`, `attachment-preview-data.ts`: preparação assíncrona perto do viewport, descarte/cancelamento, no máximo duas preparações simultâneas e cache temporário limitado. |
| Base64 e dimensões | `src/domain/documents.ts`, `src/lib/attachment-input.ts`, novos `attachment-base64.ts` e `attachment-image-dimensions.ts`: decoder linear equivalente e extração da função pura de dimensões, sem alterar a foto original ou as validações. |
| Backups | `src/lib/storage.ts`, `src/modules/Settings.tsx`, novos `encrypted-backup-payload.ts` e `.worker.ts`: conversões em blocos, lista de metadados e leitura do envelope escolhido; serialização/hash do conteúdo já criptografado fora da interface. |
| Versão | `package.json`, `package-lock.json`, `src/domain/types.ts`: 0.2.1; dependências e suas versões mantidas. |

Os caminhos `src/` da tabela são relativos a `aplicativo/`. A lista exata de arquivos está no diff da branch e no código-fonte entregue.

## Correções verificadas

- O decoder anterior podia causar `RangeError` em arquivos válidos grandes. A validação linear mantém alfabeto, padding, limites, mensagens e bytes. Arquivos válidos de 4/10 MiB foram incluídos na regressão.
- Fotos fora da área visível deixam de ser decodificadas em massa. O worker envia apenas base64, MIME e SHA-256; verifica integridade antes da prévia. URLs temporárias são revogadas, trabalhos são cancelados, e falha ou silêncio do worker por 30 segundos usa fallback verificado. O worker de fotos tem cerca de 4,3 kB e integra o cache offline existente.
- O backup deixa de decodificar ciphertext duas vezes; conversões grandes cedem tempo à interface. A tela de cópias lê apenas resumos e recupera o envelope escolhido para o download. Retenção diária/semanal/mensal e cópias fixadas preservadas.
- O worker de backup recebe somente o envelope já criptografado; mantém bytes e SHA-256 do formato anterior, com fallback, timeout e limpeza. PBKDF2 de 310 mil iterações, AES-GCM, schema e formatos mantidos.
- Saúde e manejo evita varrer todo o histórico para cada ave a cada digitação. Testes com milhares de eventos confirmam equivalência, ordenação e uma única passagem por conjunto.
- A conferência visual corrigiu sobreposição no menu superior, menus que permaneciam abertos e corte da ficha em uma janela Windows de 360 px.

## Medições de desempenho

Chromium com viewport móvel e CPU reduzida em seis vezes; fotos fictícias e as mesmas 78 artes oficiais no backup. São reproduções controladas, não medidas no telefone físico.

| Cenário | Antes | Depois |
|---|---:|---:|
| Maior bloqueio ao mostrar 12 fotos de cerca de 1 MiB | 9.346 ms | 61 ms |
| Maior bloqueio ao mostrar 30 fotos de cerca de 1 MiB | 22.431 ms | 143 ms |
| Maior bloqueio ao mostrar 12 fotos de cerca de 2,25 MiB | 23.147 ms | 77 ms |
| Maior bloqueio na geração do backup completo | 12.021 ms | 364 ms |
| Duração total do backup de 22.936.386 bytes | 38,47 s | 22,52 s |

Todas as fotos foram vistas ao percorrer as listas e todas as URLs foram liberadas ao desmontar a tela. Nove cópias passam a entregar zero caracteres de ciphertext ao estado React da listagem. O cursor ainda lê valores do IndexedDB internamente, portanto a duração dessa listagem não melhorou no benchmark; a correção reduz retenção simultânea e blocos longos na interface.

## Validação

- TypeScript e build de produção: passaram.
- Vitest: **269 testes em 20 arquivos passaram**, incluindo compatibilidade de backup antigo, senha incorreta, corrupção, retenção, conflitos/sincronização, base64 grande, SHA, worker/fallback/timeout/cancelamento, anexos, calendário e PDF/caderneta.
- Playwright do build final: **49 testes passaram**, sem falhas, testes ignorados ou repetições. Incluem 20 módulos em 360/768/1280/1440 px nos dois temas, contraste AA nas superfícies amostradas, teclado, movimento reduzido, modais, uploads, PDFs, calendário, backup/restauração, sincronização e conflitos. A estrutura C também foi conferida em Android simulado de 1280 px; Windows estreito de 360/768 px recebeu conferência visual independente. As 140 verificações funcionais anteriores foram preservadas, exceto a versão esperada 0.2.1.
- Revisões independentes: confirmaram os dois problemas visuais corrigidos, equivalência dos contratos e fórmulas, compatibilidade criptográfica/retentiva e descarte das prévias.
- APK Android 0.2.1-debug: pacote e origem mantidos, código 2002, Android mínimo 10, mesma assinatura SHA-256 do APK anterior. Lint: zero erros, 30 avisos e cinco sugestões existentes; nenhuma supressão ou alteração de dependência. Instalador Windows x64 NSIS gerado; cabeçalhos e CRC conferidos. Os 94 recursos do build, incluindo os dois workers e o cache offline, coincidem byte a byte no APK e no ASAR. Origem app://recanto, identificador da aplicação e diretório de dados Windows mantidos. Os tamanhos e SHA-256 estão em [ARTEFATOS_0.2.1.json](ARTEFATOS_0.2.1.json).

Os testes existentes foram mantidos; as alterações de testes ajustam a navegação aos menus reais, as novas cores e a versão. As regressões novas cobrem comportamento observável e compatibilidade, inclusive busca, abertura da ficha a partir do início, upload/recuperação dos bytes originais, peso atualizado e histórico.

## Limites e conferência nos aparelhos

Permanecem etapas síncronas anteriores, como serialização/validação integral da base e apresentação de TXT extensos. O desempenho no Android físico, no teclado/WebView do usuário e a atualização sobre suas instalações reais precisam ser confirmados. O APK mantém a identidade debug de avaliação existente e o Windows continua sem assinatura comercial. Não há garantia de ausência de todo bug; os resultados acima documentam o que foi efetivamente verificado.

Veja [as capturas e a comparação de estrutura](Interface-Implementada/index.html). As capturas são da aplicação compilada, com registros fictícios em contextos isolados. Nenhum dado de teste foi inserido na base do usuário. O banco local, o servidor e o Tailscale não precisam ser recriados.
