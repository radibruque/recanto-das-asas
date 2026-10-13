# Diagnóstico de miniaturas, anexos e exportação — c161168

Auditoria somente leitura do aplicativo em `/workspace/recanto-das-asas`. Código, configurações, dependências e dados do aplicativo não foram modificados. As imagens de teste e a página de instrumentação foram criadas exclusivamente em `/tmp/recanto-thumb-audit`. Nenhuma base pessoal foi utilizada. O servidor isolado da auditoria foi encerrado ao finalizar as medições.

## Escopo e limites

O usuário descreveu congelamentos temporários no Android ao rolar a tela ou digitar, seguidos de retomada. Esta auditoria examinou miniaturas, fotos, anexos, emissão da caderneta, exportação nativa, formulários e CSS. As medições foram feitas em Chromium de desktop com viewport móvel de 390×844, toque e redução de CPU em 6 vezes. Isso não equivale a instalar e instrumentar o APK no aparelho do usuário; teclado nativo, GPU, memória e versão de WebView podem ser diferentes.

## Evidência 1 — preparo antecipado das miniaturas bloqueia a interface

`aplicativo/src/components/DirectAttachments.tsx:13–40`: cada instância de `useAttachmentUrl` decodifica o base64 e executa SHA-256 síncrono antes do primeiro `await` que possa liberar o processamento. As instâncias realizam esse trabalho ao montar, incluindo fotos abaixo da área visível. O `loading="lazy"` em `AttachmentThumbnail` (linha 46) só adia o carregamento do elemento `img`; ele não adia a preparação anterior.

A página isolada importou o componente real, sem copiar ou substituir sua lógica. JPEGs válidos fictícios foram gerados com conteúdo aleatório. Cada linha usa a mesma foto em várias instâncias para medir trabalho duplicado; não é uma base real.

| Instâncias | JPEG por instância | Maior bloqueio contínuo do processamento da página | Soma de tarefas longas na montagem | Digitação após carregar, p95 | Rolagem após carregar, p95 |
|---|---:|---:|---:|---:|---:|
| 12 | 92.421 bytes | 1.022 ms | 1.075 ms | 39,7 ms | 16,7 ms |
| 1 | 1.053.841 bytes | 938 ms | 938 ms | 25,3 ms | 16,8 ms |
| 12 | 1.053.841 bytes | 9.346 ms | 9.410 ms | 32,8 ms | 16,7 ms |
| 30 | 1.053.841 bytes | 22.431 ms | 22.491 ms | 71,5 ms | 16,7 ms |
| 12 | 2.252.880 bytes | 23.147 ms | 24.053 ms | 48,1 ms | 16,7 ms |

Todas essas imagens terminaram de carregar. Não houve erro JavaScript não tratado. Depois de carregar, a rolagem permaneceu fluida; a digitação sobre 30 componentes apresentou duas tarefas acima de 50 ms.

**Conclusão limitada:** há um mecanismo reproduzido capaz de provocar congelamento temporário ao abrir regiões com várias fotos/anexos. Esta evidência não demonstra que ele seja a causa exclusiva do relato do usuário, nem que ocorra em toda digitação/rolagem. Em condições estáveis, o efeito não repete a decodificação em cada tecla porque depende de base64, MIME e SHA-256, que permanecem iguais.

Possíveis correções a revisar: preparar apenas miniaturas próximas à área visível; dividir o trabalho ou utilizar processamento assíncrono; reaproveitar a mesma imagem verificada enquanto os bytes não mudam. Nenhuma foi aplicada. Modificar quando e como uma prévia é processada exige revisão técnica, preservando verificação de integridade, bytes originais, cancelamento, descarte de URLs e erros visíveis. CSS isolado não elimina o trabalho síncrono executado pelo efeito.

## Evidência 2 — validador base64 falha em arquivos dentro do limite

`aplicativo/src/domain/documents.ts:13–16`: a expressão regular de grupos repetidos usada por `base64ToBytes` excede a pilha interna do V8 em strings extensas válidas.

- No Node, o validador original passou com 2 MiB e lançou `RangeError: Maximum call stack size exceeded` com 4, 8 e 10 MiB.
- No Chromium, uma foto JPEG válida de 5.875.089 bytes, abaixo do limite de 10 MB, produziu a mensagem de erro capturada `Maximum call stack size exceeded` em `AttachmentThumbnail`. O componente exibiu um alerta; não houve erro global não tratado.
- O mesmo helper também é usado na preparação de foto principal, validação de anexo e recuperação de documentos. A falha não está restrita à miniatura.

**Conclusão:** bug reproduzido no processamento de arquivos grandes. A falha impede o processamento de certos arquivos permitidos. A existência desse bug não prova sua relação com digitação de qualquer texto.

### Proposta funcional preparada, ainda não aplicada

Foi criada uma proposta de substituir somente a validação por uma varredura linear do alfabeto e padding, preservando o limite da string codificada, as mensagens de erro, a conversão final, o alfabeto e a aceitação existente de bits de padding não canônicos. SHA-256, limites de anexos, tipos permitidos, esquema e persistência permanecem intactos na proposta.

Arquivos para revisão:

- `base64-proposto.patch`: diferença sugerida para `aplicativo/src/domain/documents.ts`.
- `proposto-documents.ts`: cópia completa com a proposta, fora do aplicativo.
- `base64-proposto.mjs` e `verificar-base64-proposto.mjs`: implementação e verificação isoladas.
- `verificacao-base64-proposto.json`: resultados.

Comparação com o comportamento original: **14.190 entradas pequenas** produziram exatamente os mesmos bytes ou erros, incluindo todas as combinações de tamanho até quatro sobre alfabeto de dez caracteres, entradas válidas, padding, espaços, acentos, quebras de linha e mutações inválidas. A proposta recuperou bytes idênticos de arquivos aleatórios de **4 MiB e 10 MiB**, para os quais o original excedeu a pilha. Também rejeitou entrada além do limite codificado.

Risco de aplicar: mudar um validador compartilhado exige testes de regressão para anexos, emissão/recuperação, importação, backup e sincronização. A proposta foi verificada isoladamente e **não substitui a validação integrada após aprovação**. Reduzir o limite ou alterar a mensagem de erro evitaria alguns sintomas, mas impediria arquivos antes permitidos; portanto não é uma alternativa adequada para preservar a função atual.

## CSS, fonte e teclado

O CSS atual não usa blur, filtros de fundo, animações contínuas, `transition: all` ou manipuladores de rolagem intensivos. As sombras são discretas. Não foi identificada, nesta inspeção, uma causa geral de congelamento atribuível exclusivamente ao CSS.

`aplicativo/src/style.css:1–5` usa `NotoSans.ttf`, arquivo variável existente de aproximadamente 2 MB, com eixo de peso 100–900. A declaração `@font-face` não informa o intervalo de pesos; a raiz utiliza `font-synthesis: none`. Isso merece correção visual para garantir que os pesos BOLD solicitados utilizem o eixo real da fonte. **Não foi demonstrado que cause travamento.** O PDF usa outra fonte, estática, com cerca de 80 KB, que não deve ser substituída por causa do redesign.

O manifesto Android declara tratamento de mudanças de teclado/tela, sem plugin dedicado de teclado. Não foi reproduzido problema de teclado nativo nesta auditoria. As simulações no navegador não comprovam comportamento do teclado do aparelho.

Evitar usar o logo PNG 4096×4096 como ícone pequeno ou textura repetida no novo layout: o arquivo comprimido é pequeno, mas sua decodificação ocupa aproximadamente 64 MiB de pixels. Isso é uma orientação preventiva de escolha dos recursos existentes, não um bug demonstrado nas telas atuais.

## PDF/caderneta/exportação

Não foi reproduzida regressão de emissão ou exportação nos testes atuais. O código mantém PDF digital de quatro páginas e limite de emissão de 8 MB; fotos possuem validação de dimensões e redução antes de incorporar. A transferência Android usa partes de 192 KiB, verifica tamanho e SHA-256 antes de abrir um destino e remove saídas incompletas quando o provedor permite.

Executados uma vez, sem alterar testes:

`npm test -- --reporter=verbose tests/digital-booklet.test.ts tests/pdf-safety.test.ts tests/native-export.test.ts tests/native-transfer.test.ts tests/attachments-direct.test.ts tests/attachments-transaction.test.ts`

**Resultado: 53 testes passaram, em seis arquivos.** Incluem exportação de 8 MiB sob heap de JVM de 48 MiB, cancelamento, partes fora de ordem, falha de integridade, falha de escrita/fechamento, callback perdido, foto no retângulo do modelo, renderização real de texto e transações com anexos.

A execução Java usa adaptadores controlados do sistema no host; não é uma execução do seletor de arquivos, impressão ou APK em Android físico. Cópias para provedores lentos no retorno do seletor Android continuam a depender do desempenho desses provedores. Isso é secundário ao relato de congelamento ao digitar/rolar e não foi apresentado como causa desse relato.

## Artefatos da auditoria

- `results.json`: medições completas de montagem, digitação e rolagem.
- `measure.mjs`, `entry.tsx`, `server.mjs`: instrumentação isolada.
- `small.jpg`, `medium.jpg`, `large.jpg`, `huge.jpg`: imagens fictícias para reprodução.

Não foi aplicado nenhum patch funcional ou alteração visual ao aplicativo nesta auditoria.
