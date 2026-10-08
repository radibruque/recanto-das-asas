# Arquitetura e armazenamento — 0.1.0

## Adaptação da base

O painel recebido é React/TypeScript com rotas de hospedagem e banco Cloudflare D1. Seu modelo original foi preservado em `aplicativo/src/domain/base-model.ts`. Foram reaproveitados a organização do manejo, os conceitos de aves/casais/posturas/ovos, as validações e a identidade aprovada. A interface e o armazenamento foram adaptados em um projeto separado: a autenticação da hospedagem e uma conexão remota D1 não protegeriam um aplicativo instalado nem garantiriam uso offline.

O aplicativo usa React 19, TypeScript e Vite. Capacitor empacota os mesmos recursos no Android; Electron os empacota no Windows. Todos os arquivos essenciais, fontes e 78 artes originais estão incorporados. O PWA precacheia esses arquivos depois do primeiro acesso online. O servidor de sincronização usa Node.js e disco persistente, sem banco ou dependências externos.

## Camadas

- `src/domain/types.ts`: esquema de entidades e estado inicial vazio.
- `src/domain/breeding.ts`: cadastro, parentesco, casais, ovos, eclosão, manejo e agenda.
- `src/domain/commercial.ts`: contatos, operações, parcelas, pagamentos, estoque e caixa.
- `src/domain/documents.ts`: anexos, versões e consultas dos relatórios.
- `src/domain/engine.ts`: composição dos comandos, importação e auditoria.
- `src/lib/storage.ts`: criptografia, persistência, fila de envio e backups locais.
- `src/lib/validation.ts`: validação do esquema e dos vínculos na leitura/restauração.
- `src/lib/exports.ts`: PDF, DOCX, XLSX, CSV e imposição do livreto.
- `src/lib/backup.ts`: ZIP completo com manifesto e integridade dos arquivos.
- `src/lib/synchronize.ts` e `sync.ts`: orquestração e protocolo do cliente.
- `sync-server/server.mjs`: armazenamento opaco com revisão e idempotência.

## Esquema do banco

IndexedDB `recanto-das-asas-private`, versão de armazenamento 2, contém `vault` e `backups`. A versão 2 acrescenta a coleção de backups sem excluir a versão anterior. O estado interno é `schemaVersion: 1`; versões desconhecidas são rejeitadas. `src/lib/validation.ts` documenta os campos efetivamente aceitos.

A chave única `vault` contém revisão local, envelope criptografado do estado e envelope criptografado dos metadados de sincronização. O estado contém aves, casais, posturas, ovos, mutações, saúde, tarefas, contatos, vendas, contas, obrigações, pagamentos, transferências, produtos/lotes, movimentos, conferências, anexos, documentos, suporte, auditoria e configurações. Registros operacionais têm UUID e `scope: real|demo`; os vínculos exigem o mesmo espaço. Configurações do proprietário e relatos de suporte são globais. O backup inclui ambos os espaços.

Cada envelope usa AES-256-GCM, salt aleatório de 16 bytes, IV aleatório de 12 bytes e PBKDF2/SHA-256 com 310.000 iterações. A senha fica apenas em memória durante a sessão. Isso protege dados em repouso e detecta alterações do arquivo; não impede acesso por um sistema operacional comprometido ou pela sessão já desbloqueada. Há bloqueio após dez minutos sem interação. Não há recuperação da senha, colaboradores ou permissões por função nesta versão.

Uma alteração descriptografa e valida a versão corrente, executa o comando, valida o resultado e cifra o novo estado. A gravação compara a revisão dentro de uma transação IndexedDB. A concorrência repete a operação validada sobre a versão atual, impedindo perda de alterações e reserva duplicada. Restaurações e adoções remotas usam a revisão revisada e interrompem a substituição se a base mudar durante a preparação.

## Regras de dados

Valores financeiros são inteiros em centavos. Totais de itens usam quantidade em milésimos, BigInt e arredondamento para o centavo mais próximo. Parcelas distribuem os centavos restantes nas primeiras parcelas. Quantidades têm até três casas decimais. Não há conversão automática entre kg, g, L ou outras unidades; cada produto/lote mantém sua unidade. Datas de negócio usam `YYYY-MM-DD`, formatação brasileira e fuso `America/Sao_Paulo`; horários técnicos usam ISO UTC.

As validações bloqueiam identificações e microchips duplicados, pais incompatíveis, genealogia circular, casais ativos incompatíveis, eclosão repetida, venda de ave indisponível, pagamento superior ao saldo e saída indevida de estoque. Históricos de situação, sexagem, mutação, recinto/responsável e operação comercial são preservados. Exclusões de aves vinculadas são recusadas. A auditoria registra proprietário, horário, comando, identificação e motivo quando fornecido; não é assinatura digital ou registro inviolável perante terceiros.

Anexos permitem PDF, PNG, JPEG ou TXT UTF-8, até 10 MiB por arquivo. Formato, assinatura, extensão, tamanho e SHA-256 são verificados. Os bytes estão no estado criptografado, não em links temporários. Substituição acrescenta uma versão vinculada. Documentos emitidos guardam o arquivo original para reimpressão. O código não faz análise antivírus de PDFs nem deve interpretar anexos como comprovação automática de regularidade.

## Sincronização

A fila persiste snapshots completos antes do envio. Conserva a primeira operação para repetição idêntica e o snapshot mais recente, evitando armazenar toda a base a cada edição. O servidor recebe somente envelopes e compara a revisão esperada. Operação repetida retorna o recibo original; conteúdo diferente com a mesma identificação é rejeitado. O token está nos metadados locais criptografados e não acompanha o estado enviado.

Um conflito preserva o trabalho local. O proprietário pode examinar a versão remota e escolher, com backups independentes antes da substituição. Não há mesclagem automática por campo. Antes de usar o segundo aparelho pela primeira vez, adote a base remota ou restaure o backup do primeiro; não cadastre registros em duas bases vazias independentes esperando combinação automática.

A fila tenta novamente no próximo acesso, a cada 30 segundos durante a sessão e ao recuperar a conexão. O aplicativo fechado não trabalha em segundo plano. O limite do servidor é 64 MiB por requisição JSON, aproximadamente 48 MiB de conteúdo cifrado; anexos contam nesse limite. A sincronização não substitui backup.

## Backup e compatibilidade

O ZIP contém estado completo, anexos/documentos no estado, originais da marca, catálogo e manifesto SHA-256. A inspeção valida integridade, versão, caminhos, vínculos e arquivos antes da restauração; o ZIP é depois cifrado pela senha da base. A retenção inicial guarda sete datas diárias, quatro semanas e seis meses, além das cópias preservadas antes de conflitos e restaurações. O intervalo é configurável; as quantidades de retenção ainda são fixas. Restauração recupera a base e seus arquivos internos; as artes de fábrica verificadas também estão incorporadas na instalação 0.1.0.

O usuário deve baixar uma cópia para outro destino. A aplicação não verifica se o destino escolhido está em outro aparelho. Apagar dados do aplicativo ou o perfil do navegador remove a base local. Android impede backup automático do sistema; Windows usa `%APPDATA%\RecantoDasAsas`. Atualizar mantendo identidade e assinatura conserva esse armazenamento. Migração de um esquema futuro precisa de código e testes específicos; não execute uma versão antiga sobre um esquema novo desconhecido.
