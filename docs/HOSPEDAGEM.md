# Escolha de hospedagem para Android e Windows

A necessidade confirmada é compartilhar registros entre Android 10+ e Windows 10/11, inclusive fora de casa. A escolha atual é usar o desktop Windows 10 do proprietário. Não há hospedagem contratada. O aplicativo já contém cliente e servidor de sincronização; o [guia de instalação no Windows](SERVIDOR_WINDOWS.md) e o pacote separado do servidor permitem preparar acesso privado pelo Tailscale. A instalação nos aparelhos do proprietário ainda precisa ser executada e conferida.

## Opções

| Opção | Vantagem | Condição e custo |
| --- | --- | --- |
| Computador próprio + rede privada/VPN | Aproveita equipamento existente | Precisa ficar ligado; conexão, energia e cópia externa continuam necessárias |
| Pequeno VPS com disco persistente + VPN + HTTPS | Conecta de locais diferentes sem depender do Windows ligado | Mensalidade do VPS, cópias externas e administração; domínio opcional conforme certificado/rede |
| Plataforma gerenciada com volume persistente | Menos administração do sistema | Confirmar volume durável, processo único, HTTPS, rede privada, cópias e preço; planos gratuitos podem suspender ou apagar armazenamento temporário |

A opção de VPS fica disponível para uma migração futura, caso seja necessário sincronizar sem manter o desktop ligado. Nesse caso, escolha um fornecedor que permita snapshots ou backup externo e cobrança previsível. Hetzner, DigitalOcean e provedores locais são exemplos para comparar; esta entrega não consultou preços atuais nem abriu conta. É possível começar no seu computador e mudar depois, preservando os envelopes e as revisões.

O serviço não precisa interpretar dados, rodar IA ou ter banco pago. O orçamento deve incluir hospedagem, espaço dos anexos, cópia independente, manutenção e eventualmente domínio/VPN. Certificado TLS pode ser gratuito com ACME, desde que configurado corretamente; certificado Authenticode do instalador Windows é uma necessidade separada.

## Configuração técnica

Siga o [manual do servidor](../aplicativo/sync-server/README.md). Mantenha o processo Node em loopback e encaminhe somente pelo proxy HTTPS privado. Configure pelo mecanismo seguro da hospedagem:

- `SYNC_TOKEN`: pelo menos 32 caracteres aleatórios, exclusivos, guardados fora do código.
- `SYNC_DATA_DIR`: diretório privado e durável, fora de pastas publicadas ou de instalação.
- `SYNC_HOST=127.0.0.1` e porta interna livre.
- `SYNC_ALLOWED_ORIGINS=app://recanto,https://localhost` para Windows e Android desta versão; acrescente a origem HTTPS exata do PWA se necessário.

Execute `node sync-server/server.mjs` a partir de `aplicativo/`. Use um único processo por diretório e configure reinício supervisionado. A trava evita duas instâncias. O proxy deve permitir GET, PUT e OPTIONS, cabeçalhos Authorization/Content-Type e corpo de até 64 MiB; configure tempos compatíveis com uploads e não registre tokens ou conteúdo nos logs. Restrinja acesso de rede aos aparelhos autorizados. Verifique certificado TLS válido e mantenha a checagem habilitada nos clientes.

No primeiro aparelho, guarde um backup verificado e preencha endereço HTTPS, identificador da base e token. No segundo, crie/desbloqueie com a mesma senha e configure a mesma conexão. A base vazia local e a base remota existente podem gerar um conflito inicial: examine o resumo e escolha usar a base remota. Não escolha substituir a remota por uma instalação vazia.

## Aceite da instalação remota

Antes de usar dados reais, valide com exemplos: upload de um aparelho, download no outro, reinício do servidor com persistência, alteração sem rede e reconexão, conflito com edições dos dois lados, token incorreto, origem proibida e restauração de backup. Confira no servidor que não há nomes, anexos ou valores em texto claro.

A hospedagem remota, VPN, proxy e conexão em aparelhos físicos não foram implantados nem testados nesta entrega. O servidor e o cliente foram testados por rede local automatizada. A publicação do serviço e a criação de contas/custos exigem a escolha do proprietário.
