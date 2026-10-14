# Domínio e integridade da simplificação 0.3.0

Este documento descreve as alterações funcionais das etapas 2 e 3. A base continua única, local e criptografada; os espaços de produção e demonstração conservam os vínculos existentes. Não há novo serviço, dependência ou integração externa.

## Compatibilidade e migração

O banco passa ao **schema 3**. `migrateState` aceita os schemas 1 e 2, prepara uma cópia e preserva identificadores, grafias, datas, estimativas, dados financeiros, anexos, documentos e auditoria. A validação rejeita schemas futuros, referências entre espaços e registros incompatíveis antes de gravar ou adotar uma base.

O envelope criptografado e o formato ZIP de backup continuam na versão 1. A migração ocorre ao ler; a gravação seguinte persiste o banco atualizado. Instalar sobre a versão existente preserva a identidade da instalação. Um cliente antigo não deve escrever a base nova; a proteção correspondente do serviço de sincronização faz parte da entrega principal.

Não há conversão retroativa de movimentos de estoque em compras. As tarefas anteriores permanecem manuais, com a conclusão original. Nenhum documento emitido é regravado pela migração.

## Catálogo de espécies

Cada entrada possui um identificador estável, nome, grafias anteriores explícitas, situação e parâmetros opcionais. O catálogo reúne os seis nomes de referência já existentes, nomes usados nos cadastros e estimativas configuradas. Parâmetros ausentes permanecem nulos. Toda alteração de um parâmetro para um valor configurado exige uma fonte informada.

A migração trata nomes exatos separadamente. Renomear uma entrada explicitamente conserva seu ID e o nome anterior como alias; não reescreve a espécie textual das aves. Casais e parentesco podem reconhecer esses aliases explícitos pela identidade do catálogo. Grafias incertas continuam separadas e não são unidas por inferência.

As estimativas da versão anterior permanecem preservadas e identificadas como fonte não registrada. A edição por JSON foi substituída pelo formulário; o comando legado não pode apagar silenciosamente estimativas.

## Agenda derivada

As regras de previsão de eclosão, acompanhamento do ovo e acompanhamento do filhote começam **desativadas**. Tarefas são geradas apenas com datas e parâmetros disponíveis. Uma previsão informada manualmente permanece preservada; uma previsão produzida pelo catálogo acompanha a correção da data de incubação ou do parâmetro.

Cada trabalho possui uma `derivationKey` permanente e um UUIDv8 derivado de seu espaço e fonte. Isso mantém identidade entre aparelhos e compatibilidade com os anexos existentes. Recalcular não cria outra tarefa. Conclusões, lembretes e observações do usuário são conservados; `derivationNotes` contém separadamente o texto produzido a partir dos parâmetros.

Encerrar um acompanhamento ou desativar uma regra resolve pendências incompatíveis sem excluir seu histórico. Reabrir o acompanhamento reativa a mesma tarefa resolvida automaticamente, preservando tarefas concluídas pelo usuário. Datas e ave de uma tarefa derivada são corrigidas no registro de origem.

Recalcular uma previsão não inventa um evento biológico datado no dia atual. A rastreabilidade fica na tarefa e na auditoria, permitindo encerrar posturas com as datas reais de seu histórico.

Este fluxo não implementa diagnóstico, prescrição, referência de peso ou alimentação automática. Também não promete notificação com o aplicativo fechado.

## Compras integradas

`purchase.save` vincula compra, material/lote, movimento de estoque, obrigação a pagar e pagamento opcional em uma transação. Uma falha posterior, inclusive em pagamento ou anexo, não deixa registros parciais. A transação específica de compra copia somente coleções afetadas, sem ler ou copiar corpos de anexos.

A chave de idempotência identifica a operação e os dados aceitos. Repetir a solicitação não duplica compra, estoque, obrigação, pagamento ou lote de anexos. Reutilizar a chave com dados diferentes é rejeitado. Correções exigem a revisão atual e um motivo.

Editar notas, fornecedor, vencimento ou pagamento conserva o movimento de estoque. Alterações efetivas de quantidade, material, valor ou data registram compensação e nova entrada na data real da correção, preservando o movimento anterior. Uma redução que tornaria o saldo negativo é rejeitada. Valores inferiores aos pagamentos líquidos já registrados exigem cancelamento e acompanhamento da restituição.

Cancelar conserva os pagamentos reais e cancela a obrigação original. Se houve pagamento, cria uma conta **a receber** do fornecedor, chamada “Restituição de compra”. Não fabrica reembolso, estorno ou venda. Somente registrar o recebimento efetivo altera novamente o dinheiro em caixa. A conferência de caixa continua contabilizando entradas e saídas reais.

## Revisão e recuperação da entrega

`deliveryCandidates` consulta somente metadados. Exibe anexos autorizados para o tutor e relacionados à operação, à ave ou ao cliente, além de caderneta digital, recibo e termo próprios relacionados. Arquivos privados, clientes de outra operação e relatórios gerenciais ficam fora dessa seleção.

Ao confirmar a entrega, a venda pode guardar `deliveryManifest`: tipo, ID, SHA-256 e nome de cada original selecionado, com a data da entrega. Repetir a entrega conserva esse snapshot. O máximo é 20 arquivos e 40 MB por seleção; os originais continuam disponíveis individualmente.

Registrar entrega não quita dívida e não cria outra venda. A operação de duas aves mantém um único total e cada pagamento aparece uma vez. Cadernetas e documentos emitidos conservam seu formato e histórico. O empacotamento ZIP e a revisão visual são tratados pela interface.

## Evidências de domínio

Os testes novos verificam migração, aliases explícitos, parâmetros sem defaults, geração e reprogramação de tarefas, conclusão e reabertura, anexos de tarefa derivada, eclosão única, compras pagas/a prazo, repetição e rollback, correção de estoque, restituição, privacidade e snapshots de entrega, backup verificado e reabertura offline do cofre.

Os testes de preservação cobrem cadastro, saúde, genealogia, reprodução, operações comerciais, pagamentos, conferência de caixa, anexos e armazenamento existentes. Resultados finais, UI, dispositivos e empacotamento constam do relatório principal de validação.
