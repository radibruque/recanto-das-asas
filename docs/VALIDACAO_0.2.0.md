# Validação da atualização 0.2.0

Verificação final no ambiente Linux de desenvolvimento, em 9 de outubro de 2026:

- `npm test -- --maxWorkers=2`: 226 testes aprovados, 15 arquivos, nenhum teste ignorado.
- `npm run build`: TypeScript e compilação Vite aprovados.
- `RECANTO_E2E_PREVIEW=1 npm run test:e2e`: 14 cenários aprovados na compilação de produção, incluindo funcionamento offline, backup/restauração, anexos diretos, imagem grande, acervo, saúde, agenda, financeiro, histórico e duas emissões da caderneta digital.
- Android: `assembleDebug` e `lintDebug` aprovados; nenhum erro/fatal no lint. Os 30 avisos tratam de recursos/ícones antigos e versão disponível de uma dependência. Não foram suprimidos para obter aprovação.
- Exportação Android: 14 testes do plugin Java real em JVM com adaptadores controlados e 10 do protocolo JS, incluídos nos 226. Cobrem transferência em partes, exportação de 8 MiB com heap de 48 MiB, tamanho/SHA, cancelamento, falha de gravação/fechamento e limpeza do destino incompleto.
- APK: assinatura válida, identidade `br.com.recantodasasas.app.debug`, versão 0.2.0, código 2000, Android mínimo 29. Certificado SHA-256 `78a89de576577bb9ce97d2e7404d762e81f03005abc06c6e8ea5983e19dc0b35`, igual ao APK 0.1.1.
- Comparação dos 91 recursos web do APK e do pacote Windows ASAR com a compilação validada: bytes idênticos, incluindo modelo e fonte da caderneta.
- Modelo PDF enviado: preservado byte a byte. PDFs gerados: quatro páginas, texto legível, foto proporcional dentro da moldura, arquivos íntegros e histórico preservado. O arquivo original não é reescrito.

## Falhas corrigidas

O exportador anterior mantinha o arquivo inteiro em base64 na ponte Android e podia abrir o destino antes de terminar a decodificação. O novo fluxo prepara e verifica um arquivo temporário em partes antes de abrir o seletor; gravação e fechamento precedem a confirmação de sucesso. Sem o logcat do telefone original, não é possível afirmar a causa exata do crash relatado.

A fonte dos PDFs usa uma instância estática pequena de Noto Sans incorporada integralmente, evitando o consumo da fonte variável completa sem repetir o problema anterior de letras ausentes. A geração é concluída antes de abrir o seletor e é arquivada antes do download; cancelar ou falhar no destino permite tentar novamente pelo histórico.

A validação de PDF confundia texto de imagens com comandos, e o modelo enviado possui credenciais C2PA incorporadas. O emissor copia as quatro páginas finalizadas para um PDF limpo; o verificador examina objetos reais, inclusive comprimidos, com limites de descompressão. Os testes rejeitam ações ativas e aceitam os PDFs passivos gerados.

Uma fixture da concorrência de reservas tinha uma data fixa anterior ao cadastro no dia seguinte. Ela passou a usar a data do cadastro; a regra que impede movimentação anterior à última situação foi mantida. O teste continua exigindo exatamente uma reserva e uma parcela entre dois acessos concorrentes.

## Limites da verificação

Não houve instalação/atualização em aparelhos físicos Android ou Windows neste ambiente. Os testes JVM não reproduzem todos os fornecedores de armazenamento Android. A instalação, o seletor de arquivo, a abertura do PDF e a confirmação dos lembretes no calendário precisam ser conferidos nos aparelhos. O instalador Windows é de avaliação sem Authenticode; o APK mantém a assinatura privada de avaliação existente.

Preserve o backup e atualize ambos os clientes antes de editar/sincronizar a base de esquema 2. Testes aprovados não garantem ausência absoluta de falhas em qualquer dispositivo.
