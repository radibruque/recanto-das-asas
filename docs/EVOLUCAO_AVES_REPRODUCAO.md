# Aves, ficha, saúde e reprodução — etapa 2

Implementação sobre o aplicativo existente, na evolução 0.3.0. Nenhum registro de ave, ovo, postura, manejo, anexo ou documento foi substituído por uma entidade paralela.

## Caminhos frequentes

- **Cadastrar ave:** identificação, espécie, sexo (inclusive indeterminado), origem, situação e nome aparecem primeiro. Foto e documentos são anexados no próprio formulário. Genética/fontes, parentesco, aquisição, identificação da caderneta, desenvolvimento e observações ficam em seções complementares. Os 40 campos existentes e seu payload de salvamento foram conservados.
- **Aves → ficha → Pesar:** abre o formulário rápido com ave e unidade em gramas definidas. Digite o peso e, se necessário, altere a data. O registro usa o comando `saveHealth` e aparece na ficha e em Saúde e manejo. Nos testes de navegador em 390 e 1440 px, nos dois temas, foi observado um único clique/toque de navegação da ficha até o formulário. Android foi simulado; a confirmação em aparelho físico continua pendente.
- **Ficha → Novo manejo:** abre o formulário existente com a ave selecionada e o tipo inicial acompanhamento. Peso é opcional para esse tipo. Os registros antigos conservam seus tipos.
- **Ficha → Anexar:** salva documentos/fotos diretamente em lote atômico. Essa ação não regrava a ficha nem cria novas informações de sexagem, mutação ou situação. Para mudar a foto principal, use Editar ave → Foto e documentos da ave.
- **Ficha → Abrir reprodução:** abre os casais relacionados. Formar casal pré-seleciona a ave quando seu sexo conhecido permite fazê-lo; não atribui sexo por inferência.
- **Reprodução:** Casais, Posturas e ovos e Filhotes consultam os registros existentes. Cada ovo conserva fertilidade, resultado, datas de incubação/previsão/eclosão e histórico próprios. Confirmar eclosão usa o comando existente que cria um único filhote vinculado aos pais, postura e ovo.

## Ficha individual

Cabeçalho com foto compacta ampliável, identificação, espécie, situação, recinto e último peso com data. As abas Resumo, Histórico, Saúde e peso, Reprodução/parentesco e Arquivos/entrega conservam informações e ações existentes. Os dados completos podem ser consultados em Resumo → Consultar todos os dados do cadastro, ou editados na ficha.

Arquivos/entrega reúne os vínculos dos anexos e acessos a operações, caderneta e versões emitidas. Os arquivos aparecem inicialmente por metadados; somente o arquivo solicitado é aberto em uma prévia, com opções de visualizar e baixar o original. Vínculos antigos por foto, sexagem, saúde, mutação e venda permanecem reconhecidos.

## Peso e apresentação dos dados

O gráfico representa somente medições efetivamente registradas. A posição horizontal usa as datas reais, mantendo intervalos sem registros e medições do mesmo dia; não há medições interpoladas, referência clínica, diagnóstico ou curva fabricada. A lista de pesagens com valores/data/título e abertura dos detalhes continua acessível. Os rótulos móveis são apresentados em HTML legível para evitar texto SVG excessivamente reduzido.

## Contexto e desempenho

Filtros, abertura dos filtros avançados, lista selecionada, aba da ficha e subárea reprodutiva são conservados em contexto de sessão. O contexto guarda apenas identificadores, escalares e até 40 snapshots de navegação. Não guarda base completa, registros de domínio, arquivos, PDF, credenciais ou rascunhos de anexos.

A consulta dos arquivos da ave segue os vínculos em passagens lineares e não lê conteúdo base64 para procurar metadados. As prévias completas de todos os anexos não são criadas ao abrir a aba de arquivos.

## Validação nesta integração

- TypeScript (`npx tsc --noEmit`): aprovado.
- 17 testes unitários em quatro arquivos: aprovados (`weight-series`, `bird-files`, `health-views`, `bird-care`).
- Gráfico: intervalos de calendário, medições do mesmo dia, peso único/constante, dados inválidos legados, saída acessível e ausência de curva estimada.
- Arquivos: vínculos diretos e legados, isolamento real/demonstração e metadados pesquisados sem abrir o conteúdo.
- Cadastro: comparação dos nomes dos 40 campos antes/depois e preservação do payload existente.

Os resultados de navegador, empacotamento Android/Windows, capturas e limitações de aparelho físico devem ser consultados na matriz geral da entrega. A implementação da tela não equivale a validar o funcionamento em um telefone físico.
