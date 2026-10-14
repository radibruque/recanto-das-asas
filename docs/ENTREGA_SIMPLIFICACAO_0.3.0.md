# Recanto das Asas 0.3.0 — entrega local

Esta atualização evolui o aplicativo existente a partir da versão 0.2.3 (`72cbd1b`). O trabalho está isolado em `feature/simplificacao-0.3.0`, com a base preservada em `checkpoint/pre-simplificacao-0.2.3` e a etapa 1 em `checkpoint/simplificacao-etapa1` (`8a69018`). O ZIP original, `PROMPT_DESENVOLVIMENTO.txt`, `painel-base/` e a identidade visual foram preservados. Não houve publicação, contratação ou envio a terceiros.

O ponto final recuperável é `checkpoint/simplificacao-0.3.0`. A [lista completa dos arquivos alterados](simplificacao-0.3.0/ARQUIVOS_ALTERADOS.txt) inclui as três etapas, acesso, documentação e evidências; os binários ficam fora do Git.

## Como usar

- **Criatório / Comercial:** o seletor muda o contexto de trabalho usando a mesma base. No desktop, a navegação lateral acompanha o setor. No celular, a barra inferior oferece Hoje, Aves, Reprodução, Comercial e Mais. **Novo** abre o cadastro pertinente à área.
- **Aves:** Plantel presente e Fora do plantel distinguem o cadastro atual do histórico. Nenhum registro de ave vendida, transferida, doada ou falecida é apagado. Os filtros avançados continuam disponíveis.
- **Ficha → Pesar:** abre diretamente o formulário com ave e unidade em gramas definidas. Os registros aparecem na ficha e em Saúde e manejo; o gráfico representa somente pesagens reais com suas datas.
- **Ficha → Novo manejo / Anexar / Abrir reprodução:** evita selecionar novamente a ave. A foto pequena pode ser ampliada. Resumo, Histórico, Saúde/peso, Reprodução/parentesco e Arquivos/entrega organizam os dados existentes.
- **Reprodução:** Casais, Posturas e ovos e Filhotes ficam na mesma área. Fertilidade, resultado e previsão continuam distintos; cada ovo conserva identificação e histórico.
- **Busca global:** pesquisa aves/anilhas, pessoas, vendas e documentos nos metadados locais e abre o registro. Não envia a pesquisa para a internet nem decodifica arquivos para montar resultados.
- **Configurações → Espécies e parâmetros:** substitui o JSON por um formulário. Configure somente prazos cuja fonte tenha conferido; campos vazios continuam não configurados. Ative as regras desejadas em Agenda derivada da reprodução.
- **Agenda:** separa tarefas manuais, derivadas, concluídas e resolvidas pelo acompanhamento. Detalhes abrem o registro relacionado e mostram o histórico. Recalcular preserva identificadores e conclusões. Adicionar ao calendário continua sendo uma ação explícita do usuário.
- **Materiais → Registrar compra:** reúne produto/lote, quantidade, fornecedor, valor e pagamento ou vencimento. A compra vincula estoque, obrigação e pagamento real. Correção e cancelamento conservam histórico; restituição fica a receber até o dinheiro ser efetivamente recebido.
- **Venda → Registrar entregue:** revisa cliente, aves, recebido, devido, caderneta, recibo e arquivos selecionados. Entregar não quita parcelas. Os documentos selecionados conservam sua versão original; relatórios gerenciais e documentos de custos internos ficam fora do pacote do tutor.
- **Configurações → Biometria (Android):** ativação opcional mediante confirmação da senha e autenticação do Android. A senha continua disponível. Minimizar conserva a sessão na memória enquanto o processo existir; Bloquear, finalizar ou reiniciar exige novo acesso.

## Matriz de implementação e evidências

Validação final: **408 testes unitários e 92 cenários de navegador aprovados**, sem falhas ou omissões na rodada final. Build e artefatos Android/Windows/servidor verificados. Compilação, simulação de plataforma e teste em aparelho físico são evidências diferentes; os passos físicos permanecem explicitamente pendentes.

| Escopo | Implementação | Evidência / limite |
| --- | --- | --- |
| Setores, navegação contextual, cinco destinos móveis e Novo | Implementado | Etapa 1: 30 testes unitários e 9 cenários de navegador aprovados |
| Indicadores com critério correspondente, plantel/histórico e operação multiave única | Implementado | Cenários de filtros e operação com duas aves aprovados; valores vendidos/recebidos/devidos separados |
| Busca global local por metadados | Implementado | Testes com acesso proibido ao conteúdo binário durante a busca |
| Voltar com busca, filtros, aba e posição | Implementado | 19 testes de contexto e 3 cenários de navegador; Android simulado |
| Cadastro essencial e complementos preservados | Implementado | 40 campos mantidos; formulário preserva entradas quando há erro |
| Ficha, ações diretas, anexo e mesma saúde geral/individual | Implementado | Vínculos, metadados e bytes recuperados após reabrir; saúde geral e ficha consultam os mesmos registros |
| Pesagem rápida, gráfico e lista com datas reais | Implementado | Série de datas reais e lista aprovadas; um clique/toque observado da ficha ao formulário em 390/1440 px, claro/escuro |
| Casal → postura → ovo → filhote único e pais | Implementado | Domínio e interface aprovados: dois ovos, um filhote, vínculo com pais/postura/ovo e encerramento após reabrir |
| Catálogo estável e parâmetros sem inferência | Implementado | Migração de grafias exatas, IDs, aliases explícitos e parâmetros ausentes |
| Tarefas derivadas sem duplicação, correção e encerramento | Implementado | Unitários e interface aprovados: datas atualizadas no mesmo ID, conclusão preservada, futuro resolvido e recuperação offline |
| Compra paga/a prazo, falha/repetição, correção/cancelamento | Implementado | Atomicidade e repetição aprovadas; UI valida compra paga/a prazo, recusa abaixo do pago, compensação e restituição real |
| Entrega e documentos sem custos internos | Implementado | Recibo, caderneta e anexo selecionados emitidos/baixados; ZIP recupera os mesmos bytes após nova emissão; custos internos excluídos |
| Backup/restauração e migração 1/2 → 3 | Implementado | Testes de recuperação com anexos, novos vínculos, documentos e fila |
| Bloqueio de clientes incompatíveis na sincronização | Implementado | Testes reais do protocolo: servidor antigo, promoção do esquema e rejeição de clientes antigos |
| Biometria Android opcional | Implementado | Adaptador testado e Java compilado; sensor/Keystore exigem aparelho físico |
| Sessão ao minimizar, bloqueio e reabertura | Implementado | Quatro fluxos claro/escuro em navegador/ponte Android aprovados: sessão após 11 min, Bloquear e reabrir protegidos; suspensão pelo sistema não é controlável pelo app |
| Temas, teclado, foco e larguras móveis | Preservado e adaptado | 20 módulos e larguras 360/768/1280/1440 px aprovados nos temas; contraste/foco/movimento reduzido verificados; teclado físico pendente |
| Instaladores Android/Windows e servidor Windows | Gerados localmente | Identidade, versão, assinatura APK, payload/CRC Windows, hashes, 94 arquivos web e servidor conferidos; instalação física pendente |

## Resultado e correções verificadas

A rodada final está em [Capturas e resultados](simplificacao-0.3.0/COMPARATIVO.md). Os testes utilizam dados fictícios isolados; a produção não foi preenchida.

Foram corrigidos o retorno de busca/filtros, a retenção de revisões completas da base em módulos inativos e vínculos antigos no acervo/emissão de documentos. Caderneta de uma nova operação usa o tutor e a data dessa operação, mantendo exceções de identificação/anilha e os originais anteriores. O responsável pelo criatório utiliza seu cadastro como padrão, preservando valores explicitamente informados. Essas correções têm testes de regressão.

O exemplo comercial foi validado com vendido R$ 1.000, recebido R$ 200 e devido R$ 800; após R$ 300 adicionais, recebido R$ 500 e devido R$ 500. A entrega preserva esses valores. Operações multiave e pagamentos aparecem uma única vez.

Há 16 capturas anteriores e 16 posteriores, nos dois temas e nas apresentações desktop web/Android simulado. Nas capturas posteriores, nenhum erro de página ou rolagem horizontal foi registrado.

## Arquivos e componentes

- `aplicativo/src/App.tsx`, `main.tsx`, componentes de navegação e busca: setores, resumos, destinos e sessão. Apenas o módulo ativo fica montado; os contextos guardam filtros/IDs, sem revisões inteiras da base nem arquivos.
- `components/BirdRegistrationForm.tsx`, `QuickWeightForm.tsx`, `WeightChart.tsx`, `BirdFilesForm.tsx`, `EggBoard.tsx`, `HatchlingList.tsx`, `HealthHistory.tsx` e módulos de aves/saúde: cadastro, ficha, ações e reprodução.
- `components/SpeciesSettings.tsx`, `PurchaseFlow.tsx`, `DeliveryReview.tsx` e módulos Settings, Agenda, Commercial, Documents, DocumentsLibrary e DigitalBooklet: formulários e integrações.
- `domain/types.ts`, `migrations.ts`, `species.ts`, `derived-tasks.ts`, `purchases.ts`, `engine.ts`, `breeding.ts`, `commercial.ts` e `lib/validation.ts`: esquema 3 e comandos versionados com validação de vínculos.
- `lib/navigation.ts`, `ui-context.ts`, `weight-series.ts`, `bird-files.ts`, `delivery-files.ts`, `document-content.ts`, `sync.ts`: consultas locais, contexto leve, preparação de arquivos e compatibilidade.
- Plugins Android de biometria e navegação, adaptador e componentes de acesso: uso das APIs nativas existentes, sem dependência adicional.
- CSS por área utiliza os tokens e recursos oficiais existentes; testes unitários e de navegador cobrem os novos comportamentos e regressões.
- `sync-server/server.mjs` e scripts Windows: negociação de esquema e instruções de atualização preservando dados, token e Tailscale.

## Atualização e recuperação

Siga [Atualização 0.3.0](ATUALIZACAO_0.3.0.md). A ordem é **backup verificado nos dois aparelhos → servidor Windows → aplicativos dos dois aparelhos → sincronização**. A identidade, a origem de armazenamento e a assinatura Android de avaliação devem permanecer as mesmas. Não desinstale como procedimento de atualização.

O esquema interno passa para 3; envelope criptográfico e formato de backup permanecem na versão 1. A migração não converte ajustes/movimentos antigos em compras nem cria despesas retroativas. Após o primeiro envio aceito de esquema 3, o servidor impede leitura/gravação por clientes antigos incompatíveis. Preserve a cópia anterior e as alterações posteriores; uma versão antiga não deve escrever sobre a base nova.

## Limitações verificáveis

- Não há aparelho físico Android nem Windows disponível nesta execução. A proteção do sensor, instalação sobre a versão anterior, teclado nativo, minimização/suspensão e impressão precisam do roteiro manual no guia de atualização.
- O Android pode encerrar processos por memória ou bateria. Nesse caso o acesso será novamente protegido por senha/biometria. Não foi criado serviço permanente e não se promete sincronização/notificação com o processo encerrado.
- O APK de avaliação usa a assinatura debug existente; o EXE é de avaliação sem Authenticode. Não foram publicados em loja, site ou release. Lint Android passou sem Error/Fatal ativos, com 33 avisos e 5 sugestões; a baseline existente do Capacitor filtra 6 erros da dependência e não foi modificada.
- O PDF comparativo não estava disponível. A implementação usa o escopo autossuficiente autorizado.
- Recursos avançados expressamente excluídos permanecem como evolução posterior, sem adição nesta entrega.
- A cópia do programa do servidor é sequencial; se a atualização for interrompida, repita o instalador conservando os arquivos de configuração, chave e dados.
- Os checks aprovados cobrem os comportamentos e artefatos registrados; não equivalem a garantia de ausência universal de bugs.

## Referências

- [Auditoria, base e plano](SIMPLIFICACAO_0.3.0.md)
- [Migração e integridade do domínio](DOMINIO_SIMPLIFICACAO_0.3.0.md)
- [Ficha, pesagens e reprodução](EVOLUCAO_AVES_REPRODUCAO.md)
- [Biometria, sessão e botão Voltar](EVOLUCAO_BIOMETRIA_SESSAO.md)
- [Capturas e resultados](simplificacao-0.3.0/COMPARATIVO.md)
