# Diagnóstico dos travamentos — versão atual

Base examinada: `design/redesign-visual`, commit `c161168`, aplicativo 0.2.0. Auditoria realizada em 13/10/2026 com uma cópia independente extraída por `git archive` em `/tmp/recanto-freeze-audit/baseline`. Nenhum arquivo do aplicativo, banco real, instalador ou branch principal foi alterado por esta auditoria.

Relato recebido: somente Android; a interface congela e depois volta ao rolar para baixo ou digitar. Não foi informado ainda o tamanho do plantel, volume dos anexos, tela específica, aparelho ou momento relativo à abertura do aplicativo.

## Conclusão sustentada pelas medições

Há bloqueios longos da thread JavaScript reproduzíveis no processamento atual de backup e anexos, e pausas na busca de saúde conforme o volume cresce. Os testes explicam mecanismos capazes de bloquear toque, rolagem e teclado. Eles não demonstram ainda qual mecanismo causou o travamento específico no Android do usuário.

Existe também um bug independente confirmado: a validação Base64 de anexos permitidos com vários megabytes pode lançar `RangeError: Maximum call stack size exceeded`.

## Método e limites

- Chromium headless instalado no ambiente, viewport móvel 390 × 844.
- CDP `Emulation.setCPUThrottlingRate({rate:6})`; reduz a capacidade de execução da CPU para expor tarefas longas. Não é um emulador Android nem corresponde a um aparelho específico.
- `PerformanceObserver` com `longtask`: duração dos períodos contínuos que ocupam a thread principal por pelo menos 50 ms.
- Dados exclusivamente fictícios, IndexedDB isolado em contexto temporário do navegador, sem conexão privada configurada.
- Busca medida separadamente em Vite desenvolvimento e em build de produção compilado do mesmo commit.
- Backup medido pela função real `backupVault`, com a base vazia e todos os 78 arquivos oficiais de arte que a aplicação inclui. São 19.260.434 bytes de artes antes da compactação.
- Tempos absolutos variam por máquina, WebView, armazenamento, volume e estado da memória. A memória reportada por `performance.memory` é estimativa do navegador, não memória total do aplicativo Android.

## 1. Backup automático pode bloquear por vários segundos

Arquivos e trechos:

- `aplicativo/src/App.tsx:56`: inicia o backup no desbloqueio quando `lastBackupAt` está ausente ou vencido, sem aguardar uma ação do usuário. É comportamento existente que deve ser preservado.
- `aplicativo/src/modules/Settings.tsx:13`: `backupVault` inclui todas as artes, inspeciona o ZIP, criptografa, descriptografa para verificar integridade, calcula hashes e retém a cópia local.
- `aplicativo/src/modules/Settings.tsx:16`: verificação completa com `vault.encryptBackup` e `vault.decryptBackup`.
- `aplicativo/src/lib/storage.ts:11`: `fromBase64` usa `Uint8Array.from(atob(value), callback)`.
- `aplicativo/src/lib/storage.ts:26`: `validateEnvelope` decodifica integralmente o ciphertext para validar seu tamanho mínimo.
- `aplicativo/src/lib/storage.ts:31`: a descriptografia decodifica novamente o mesmo ciphertext, antes de chamar o WebCrypto assíncrono.

Reprodução CPU6×, base vazia:

- Tempo total do backup: 38.129,9 ms.
- Arquivo criptografado resultante: 22.936.386 bytes.
- Duas tarefas contínuas principais: 11.846 ms e 9.154 ms; também houve tarefas menores entre 50 e 462 ms.
- `performance.memory.usedJSHeapSize` ao final: aproximadamente 193 MB.

Isso confirma que uma função assíncrona ainda pode bloquear a interface por causa da conversão síncrona de bytes. Apenas colocar `async`, usar uma promessa ou executar depois de um `setTimeout` não remove o custo da thread principal.

Medição isolada do decoder, CPU6×, mesma sequência de bytes:

| Quantidade aproximada | Decoder atual | Protótipo de cópia direta em Uint8Array | Bytes iguais |
| --- | ---: | ---: | --- |
| 1 MiB | 549 ms | 35 ms | Sim |
| 4 MiB | 2.230 ms | 171 ms | Sim |
| 17 MiB | 8.618 ms | 515 ms | Sim |

O protótipo existe somente no script temporário. Mede cópia de bytes e não é uma implementação aprovada da validação completa. Não foi aplicado ao projeto.

Correção proposta, sujeita a aprovação funcional:

1. Reduzir alocações na conversão Base64, com equivalência de bytes e dos critérios atuais de aceitação/rejeição.
2. Evitar a decodificação duplicada apenas se todas as validações atuais forem mantidas e testadas.
3. Se ainda houver tarefas longas, deslocar processamento pesado para um worker compatível com CSP/Vite/Capacitor, mantendo formatos, hashes, criptografia, senha, inspeção, arte completa, retenção, queue e controle de revisão.
4. Exibir andamento de forma visual; não desligar backup nem remover suas verificações para melhorar desempenho.

Riscos: mudança em rotina de codificação/criptografia, compatibilidade com WebView antigo, descarte indevido de tarefas após bloquear a base, custo de transferência de dados para workers. Exige testes de equivalência, integridade, senha errada, corrupção, concorrência e retorno após bloqueio antes da entrega.

Alternativa que preserva a lógica sem aprovação: concluir apenas o redesign e documentar este gargalo. CSS sozinho não elimina essas tarefas longas.

## 2. Busca em saúde recalcula o histórico completo para cada ave

Arquivos e trechos:

- `aplicativo/src/App.tsx:64`: `onChange` da busca atualiza o estado e renderiza os módulos.
- `aplicativo/src/components/HealthHistory.tsx:42`: calcula e filtra `recordsFor` para cada ave.
- `aplicativo/src/components/HealthHistory.tsx:43`: executa isso para todas as aves a cada render.
- `aplicativo/src/domain/breeding.ts:211`: `healthHistoryForBird` faz `state.health.map(...)`, filtro e ordenação a cada chamada; o mapa cria objetos para todo o histórico antes de selecionar a ave.

Cenário: backup já atualizado, sem sincronização, busca digitada `fictícia` com intervalo programado de 80 ms. A duração total inclui automação e pausas; para travamentos, o indicador relevante é o tamanho das longtasks.

Build de produção, CPU6×:

| Aves / registros de saúde | Longtasks durante a busca | Tempo total da digitação automatizada |
| --- | --- | ---: |
| 30 / 300 | 50–83 ms | 1.496 ms |
| 100 / 2.000 | 143–276 ms | 2.779 ms |
| 300 / 6.000 | 705–969 ms | 8.174 ms |

Desenvolvimento, CPU6× — **não usar estes valores como tempo do APK**:

| Aves / registros de saúde | Longtasks durante a busca | Tempo total da digitação automatizada |
| --- | --- | ---: |
| 30 / 300 | 190–342 ms | 3.596 ms |
| 100 / 2.000 | 629–802 ms | 7.818 ms |
| 300 / 6.000 | 2.245–2.607 ms | 22.817 ms |

Perfil CPU do caso de produção 300/6.000 identifica `HealthPanel.recordsFor`, `healthHistoryForBird` e `HealthPanel` como os principais consumidores. O custo principal medido não foi o formato das datas.

Correção proposta, sujeita a aprovação funcional: criar agrupamento derivado do histórico por ave e cache/memoização conforme `state`, `scope` e filtros. Preservar exatamente ordenação por data e posição original, busca por campos existentes, filtros, contagem, vínculos e todos os registros. Não implementar paginação nova que oculte informações sem autorização. Não alterar peso atualizado ou gravação de manejo.

Riscos: cache inválido depois de sincronização/edição, resultado de busca diferente, inversão de registros da mesma data. Validar equivalência dos resultados antes/depois com filtros, datas iguais, escopos e atualização da base.

Alternativa sem mexer na lógica: CSS e composição podem melhorar percepção e apresentação, mas não eliminam o processamento repetido.

## 3. Menus do sistema carregam todos os envelopes de backup

Arquivos e trechos:

- `aplicativo/src/modules/Settings.tsx:25`: o efeito chama `vault.backups()` e `setBackups` em cada `state.revision`, para Configurações, Backup, Sincronização, Atualizações e Reportar problema, mesmo quando a lista não é exibida.
- `aplicativo/src/lib/storage.ts:78`: `backups()` usa `getAll()` e devolve envelopes completos.
- `aplicativo/src/lib/storage.ts:77`: retenção também lê todas as cópias para aplicar sua política existente.

Reprodução sintética: após criar um backup completo real da base vazia, foram inseridas oito cópias fictícias com datas diferentes no IndexedDB do navegador isolado. `vault.backups()` carregou nove cópias:

- Ciphertext total: 206.425.908 caracteres.
- Duração: 1.614 ms, incluindo tarefa contínua de 1.025 ms.
- JS heap estimado ao final: aproximadamente 245 MB.

Este cenário não afirma que o usuário tenha nove cópias desse tamanho; mostra o custo concreto quando elas existem. A retenção diária/semanal/mensal permite múltiplas cópias completas e as cópias fixadas para conflito não devem ser descartadas.

Correção proposta, sujeita a aprovação funcional: carregar a lista somente na tela de backup; obter metadados leves de cada cópia por cursor, sem materializar ciphertext de todas; ler o envelope escolhido apenas ao baixar. Preservar o banco e sua versão, todas as cópias, política de retenção, cópias fixadas, hashes, tamanhos e opções de download. A seleção de retenção pode usar metadados de cursor sem mudar quais cópias ficam.

Riscos: uma lista que não atualiza após backup manual/automático, leitura da cópia errada, seleção de retenção divergente. Não remover backup para economizar RAM. Não modificar schema do banco para esta proposta.

## 4. Bug confirmado na expressão regular dos anexos

Arquivo e trecho: `aplicativo/src/domain/documents.ts:15`.

A expressão `/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/` repete grupos em Base64 grande. O limite de arquivo é 10 MiB, mas a regex falhou em valores Base64 válidos de 5 e 10 MiB.

- Node v24.19.0: 5 e 10 MiB lançaram `RangeError: Maximum call stack size exceeded`.
- Chromium CPU6×: mesmo erro para 5 e 10 MiB.
- Conversão de 1 MiB nesse helper: aproximadamente 779 ms; 2 MiB: aproximadamente 1.341 ms.
- O helper é usado por seleção de foto, miniaturas, anexos, documento emitido, caderneta e inspeção de backup.
- `aplicativo/src/lib/sync.ts` já contém uma validação Base64 sem grupos repetidos e um comentário sobre o mesmo tipo de estouro; isso fornece um padrão existente no projeto para avaliar uma correção, sem adicionar biblioteca.

Reprodução mínima com dados fictícios:

```sh
node -e 'const value=Buffer.alloc(5*1024*1024,65).toString("base64"); console.log(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value));'
```

Correção proposta, sujeita a aprovação funcional: substituir a implementação da validação por checagens lineares equivalentes; preservar limite, caracteres, comprimento, posição e quantidade do padding aceitos hoje. Testar arquivos válidos grandes e inválidos próximos ao limite, foto, arquivo comum e backup. Não apenas capturar o `RangeError` e chamar o arquivo válido de danificado.

Impacto esperado: arquivos válidos no limite permitido deixam de falhar por tamanho de pilha. Risco: alteração involuntária dos critérios de validação. O bug de Base64 não prova a causa dos congelamentos relatados durante digitação/rolagem.

## Arquivos de evidência

- `/tmp/recanto-freeze-audit/measure.mjs`: funções reais de backup, leitura de backups e busca em desenvolvimento.
- `/tmp/recanto-freeze-audit/results.json`: dados brutos de desenvolvimento/backup/getAll.
- `/tmp/recanto-freeze-audit/measure-production.mjs`: mesma busca em build de produção.
- `/tmp/recanto-freeze-audit/results-production.json`: dados brutos de produção.
- `/tmp/recanto-freeze-audit/profile-30.json`, `profile-100.json`, `profile-300.json`: perfil CPU de produção.
- `/tmp/recanto-freeze-audit/measure-decode.mjs`: benchmark isolado do decoder e protótipo somente para medição.
- `/tmp/recanto-freeze-audit/results-decode.json`: resultados do decoder.
- `/tmp/recanto-freeze-audit/baseline/aplicativo`: snapshot do commit auditado, com build de produção em `dist` e vínculo de leitura para node_modules do projeto.

Execução reproduzível: Vite dev na porta 5188, preview do build na 5189 e os scripts Node acima. Os dois servidores foram encerrados ao concluir a auditoria. Os scripts não dependem de dados ou credenciais do usuário.

## Aprovação e validação necessárias

As correções propostas mexem em processamento, validação ou carregamento funcional e precisam da aprovação explícita exigida no prompt. O redesign visual pode prosseguir independentemente; este relatório não autoriza alterações em lógica, segurança, banco, persistência ou sincronização.

Para atribuir a causa ao aparelho e validar a correção final, ainda será necessário repetir rolagem/digitação no Android instalado, idealmente com o volume real de dados e os momentos de backup/sincronização observados, preservando os dados. Nenhum teste foi realizado no telefone físico nesta auditoria. Não é possível declarar ausência de bugs ou travamentos apenas com as medições do navegador.
