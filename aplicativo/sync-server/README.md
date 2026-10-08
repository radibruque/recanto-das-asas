# Sincronização privada Android ↔ Windows

Este serviço Node.js recebe **somente snapshots criptografados**. A senha do cofre e a chave AES-GCM permanecem nos aparelhos. O serviço conhece a identificação do espaço, as revisões e os horários, mas não conhece os registros, anexos ou conteúdo financeiro. O token de acesso e a senha do cofre têm finalidades diferentes; ambos precisam ser guardados com segurança. O compartilhamento entre seus aparelhos usa o mesmo espaço, token e senha do cofre.

O servidor está implementado e tem testes reais de rede. Nenhum serviço remoto foi publicado ou contratado. Para sincronizar entre aparelhos reais, você precisará configurar hospedagem privada, HTTPS e acesso de rede. Essa etapa depende de sua infraestrutura; não pode ser substituída por um link temporário do ambiente de desenvolvimento.

## Executar no próprio computador

Para o desktop Windows 10/11, use o [guia com o pacote portátil](../../docs/SERVIDOR_WINDOWS.md). Ele inclui Node.js oficial, proteção da chave de acesso pelo usuário Windows, início após login, parada pelo canal local e configuração de Tailscale Serve. O pacote não instala uma VPN no ambiente de desenvolvimento nem publica o serviço. As instruções abaixo continuam disponíveis para instalação manual.

Requer Node.js 22.13 ou posterior e disco persistente. Não há dependências adicionais do servidor. Execute a partir de `aplicativo/`, fornecendo o segredo pela configuração segura do sistema, sem escrever seu valor no código ou em arquivos versionados:

```bash
# Defina SYNC_TOKEN de modo seguro: pelo menos 32 caracteres aleatórios.
# SYNC_DATA_DIR deve apontar para uma pasta privada persistente fora do checkout.
export SYNC_DATA_DIR=/workspace/local-sync
export SYNC_ALLOWED_ORIGINS=http://127.0.0.1:5173
node sync-server/server.mjs
```

O processo encerra com erro se `SYNC_TOKEN` estiver ausente. A porta padrão é `8788`; `SYNC_PORT` permite alterá-la. `SYNC_HOST` é `127.0.0.1` por padrão: somente o próprio computador pode conectar. Não use `0.0.0.0`. Uma configuração de rede local pode indicar um endereço privado específico; o cliente exige **HTTPS** para qualquer conexão fora do próprio computador. Não exponha o serviço HTTP diretamente na rede.

Cada espaço ocupa `<espaço>.json`, gravado por arquivo temporário, sincronização em disco e troca atômica. O diretório deve ser acessível apenas pelo usuário do serviço. Rode exatamente um processo por diretório; `server.lock` impede processos concorrentes. `SIGINT` e `SIGTERM` encerram o serviço e liberam a trava. Se houver queda abrupta, confirme que nenhum servidor está executando antes de remover **somente** a trava `server.lock`; preserve todos os arquivos de dados. Não apague a trava de uma instância ativa.

O supervisor Windows usa `SYNC_CONTROL_STDIN=1`: a linha `recanto-sync-stop-v1` recebida exclusivamente pelo pipe do processo, ou seu fechamento, pede a mesma parada graciosa. Nenhuma rota de encerramento foi adicionada à rede. A inicialização mantém uma concessão exclusiva do sistema operacional em `supervisor.lease` e só recupera `server.lock` se o formato e o host forem reconhecidos e o PID estiver ausente; travas corruptas, de outro host ou com PID existente são preservadas.

Para gerar o pacote de distribuição em uma máquina de desenvolvimento, execute `npm run sync:windows` a partir de `aplicativo/`. O script baixa o ZIP oficial Node.js 24.21.0 x64 por HTTPS, exige o SHA-256 fixado e verifica CRC antes de incorporar somente `node.exe` e a licença. `--runtime-archive=/caminho/node-v24.21.0-win-x64.zip` reaproveita uma cópia com o mesmo hash. O resultado fica em `release/servidor-windows/`, sem token, base ou backups.

## Uso entre Android e Windows

Use um servidor sob seu controle com armazenamento persistente e um proxy HTTPS com certificado válido. O processo Node pode continuar restrito ao loopback; somente o proxy privado encaminha as requisições. Uma rede privada/VPN restringe quais aparelhos chegam ao proxy. Configure autenticação pelo token também dentro dessa rede. Não desative a verificação TLS nem aceite certificados inválidos.

Configure `SYNC_ALLOWED_ORIGINS` com as origens exatas dos clientes, separadas por vírgula. Nesta entrega, as origens dos aplicativos são `app://recanto` no Windows e `https://localhost` no Android. Use `SYNC_ALLOWED_ORIGINS=app://recanto,https://localhost` e acrescente a origem HTTPS do PWA somente se ele também for usado. Origem web precisa ser HTTPS, exceto loopback de desenvolvimento. A lista é vazia por padrão, e não aceita `*`. Requisições sem `Origin`, como clientes nativos, continuam exigindo o token. Preflight `OPTIONS` verifica a origem, método e cabeçalhos, mas não retorna dados; o navegador não envia o bearer token no preflight. Todos os `GET`/`PUT` exigem autenticação.

O cliente bloqueia redirecionamentos para evitar encaminhar credenciais a outro endereço. O token não deve estar na URL nem ser incluído em diagnósticos. Trocar `SYNC_TOKEN` invalida o token anterior; atualizar os aparelhos depois da troca. Trocar a senha do cofre é uma migração de criptografia separada e precisa preservar backups recuperáveis.

Custos: o código não impõe assinatura. Hospedagem, disco, cópias externas, domínio e eventualmente VPN dependem do fornecedor escolhido e podem ter mensalidade. Um computador próprio também precisa ficar ligado e acessível. Não há provedor, domínio, serviço pago ou publicação configurados nesta entrega. Compatibilidade entre aparelhos exige a mesma versão de esquema; versões incompatíveis são rejeitadas.

## Protocolo e tratamento de conflitos

`GET /v1/workspace/:id` retorna `{ workspaceId, revision, updatedAt, envelope }`. Um espaço novo tem revisão `0` e envelope `null`. As identificações usam 3–64 letras, números, hífen ou sublinhado.

`PUT /v1/workspace/:id` recebe:

```json
{
  "expectedRevision": 0,
  "operationId": "identificacao-unica-persistida-na-fila",
  "envelope": {
    "schemaVersion": 1,
    "salt": "base64-do-salt",
    "iv": "base64-do-vetor-de-inicializacao",
    "ciphertext": "base64-do-snapshot-com-tag-AES-GCM",
    "iterations": 310000
  }
}
```

O exemplo descreve o formato, não é um envelope válido para envio. A criptografia do cliente produz os campos reais. O limite de requisição é **64 MiB**, incluindo JSON e base64, aproximadamente 48 MiB de conteúdo criptografado. Anexos fazem parte do snapshot e contam no limite. O cofre continua disponível localmente se o limite impedir o envio; não remova arquivos para contornar o erro sem guardar uma cópia.

Antes de enviar, o aplicativo grava a operação completa na fila local persistente. Ao reconectar, repete **a mesma identificação, revisão esperada e envelope**, inclusive se a resposta anterior foi perdida. O servidor grava a atualização e o recibo de idempotência na mesma troca atômica. Uma repetição exata retorna sucesso com `duplicate: true`, sem aplicar a venda ou o recebimento outra vez. A mesma identificação com conteúdo ou revisão diferente retorna `409 OPERATION_ID_REUSED`.

A confirmação traz `{ workspaceId, revision, currentRevision, updatedAt, duplicate }`. `revision` identifica a revisão aceita originalmente para a operação. `currentRevision` pode ser maior se outro aparelho já gravou depois; baixe e revise essa versão antes de prosseguir. O diário de recibos não é expurgado automaticamente, de modo que tentativas antigas continuam protegidas contra duplicação; planeje capacidade de disco e acompanhe seu crescimento.

A escrita compara `expectedRevision` com a revisão atual dentro de uma fila serializada. Duas escritas da mesma revisão produzem um sucesso e um `409 REVISION_CONFLICT` com o snapshot remoto. **Não há mesclagem automática nem sobrescrita silenciosa**. O aplicativo mantém os dados locais e deve permitir revisar/exportar/guardar cópias dos dois lados antes de escolher qual versão ficará ativa. Não refaça uma operação rejeitada com revisão nova sem essa decisão explícita. A sincronização por snapshot impede gravações concorrentes silenciosas, mas ainda não faz mesclagem por campo: um conflito precisa ser resolvido pelo proprietário.

`SyncClient` em `src/lib/sync.ts` fornece `download()` e `upload(operation)`. `SyncConflictError.snapshot` contém a versão remota. `SyncHttpError` tem `status`, `code` e `retryable`; `SyncTransportError` é repetível. Essas funções não apagam a fila e não fabricam novas identificações durante uma tentativa. O responsável pela fila deve manter o envelope imutável até a confirmação, fazer a validação de conteúdo após descriptografar e aplicar o estado de conexão na interface.

## Backup, operação e validação

Sincronização não substitui backup: uma exclusão confirmada também pode sincronizar. Mantenha os backups completos versionados feitos pelo aplicativo em destino separado e uma cópia fora dos aparelhos. Para uma cópia consistente do armazenamento do servidor, pare-o com `SIGTERM`, copie os arquivos de espaço para o destino privado e reinicie. Não modifique JSON manualmente nem restaure uma versão antiga sem reconciliar as revisões nos aparelhos; isso pode invalidar filas pendentes. A cópia do servidor permanece criptografada e depende da senha do cofre.

Os testes `tests/sync.test.ts` iniciam um subprocesso em porta efêmera e diretório temporário. Validam autenticação, CORS, armazenamento opaco, disputa simultânea, reconexão com operação idêntica, reinício com diário persistente, isolamento entre espaços, conflitos, rejeição de envelopes inválidos e armazenamento corrompido. Execute `npm test -- tests/sync.test.ts` depois de instalar as dependências do aplicativo. Esses testes não atestam uma instalação Android/Windows, hospedagem remota ou uso de internet real.
