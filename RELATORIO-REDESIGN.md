# Redesign visual do Recanto das Asas

Validação de 12 de outubro de 2026. Base: commit `44b0941`, versão funcional 0.2.0. Branch de trabalho: `design/redesign-visual`.

## Escopo aprovado e resultado

O usuário aprovou a modernização visual sobre o aplicativo existente e a preferência de tema isolada em cada instalação. A apresentação agora usa uma paleta natural clara e uma paleta escura com azul-acinzentado e verde-petróleo suave. A tipografia Noto Sans, os ícones Lucide e as artes oficiais foram mantidos.

O CSS centraliza tokens de cores, espaçamento, tipografia, bordas, raios, sombras e estados. Dashboard, navegação, cartões, tabelas, formulários, filtros, abas, modais, arquivos e mensagens compartilham essa linguagem. As informações e operações das 20 áreas existentes permanecem na interface.

A revisão corrigiu o desalinhamento entre cartões do dashboard e a quebra de identificações longas. No telefone, a navegação fechada fica visualmente oculta e deixa de receber foco fora da tela. O botão de menu comunica seu estado aberto/fechado, e o botão de bloqueio mantém nome acessível quando aparece somente como ícone. Os estados e eventos de navegação e bloqueio continuam iguais.

## Temas

O controle de aparência oferece **Claro**, **Escuro** e **Sistema** na entrada e na navegação. A preferência usa somente a chave `recanto.ui.theme` no armazenamento visual da instalação. Ela não é um campo da base criptografada, do backup ou da sincronização.

O script externo `theme-init.js` aplica a escolha antes da montagem do React e atualiza a cor do navegador. O modo Sistema acompanha mudanças na preferência do sistema operacional. Quando o armazenamento está bloqueado, a seleção funciona durante a sessão e a abertura da base continua disponível.

| Par de cores verificado | Claro | Escuro |
| --- | ---: | ---: |
| Texto principal / fundo principal | 11,33:1 | 10,74:1 |
| Texto secundário / fundo claro ou cartão escuro | 4,84:1 | 6,25:1 |
| Texto / botão primário | 4,89:1 | 7,03:1 |
| Borda de campo / cartão | 3,53:1 | 3,99:1 |

Esses valores são exemplos calculados com a fórmula WCAG de luminância relativa. A verificação de navegador também examina texto visível sobre superfícies sólidas em telas e formulários de amostra. Isso não constitui uma certificação completa WCAG: imagens oficiais, conteúdo de documentos e todas as combinações possíveis de estados não são abrangidos por essa análise automática.

As transições são curtas e desativadas quando o sistema pede movimento reduzido. A impressão da interface utiliza uma apresentação clara, inclusive quando o usuário está no tema escuro. O conteúdo dos PDFs emitidos não foi redesenhado.

## Preservação do sistema

Foram comparados 202 arquivos existentes de negócio, persistência, sincronização, exportação, plataformas nativas, Electron, servidor, fontes, artes, modelos, dependências e configurações com o ponto inicial. O conteúdo desses arquivos permaneceu igual. Não houve migração de dados, alteração de contratos de API, de cálculos, validações, autenticação, permissões ou fluxo de armazenamento. A versão funcional e as dependências continuam em 0.2.0 e nas versões anteriores.

Nos 12 componentes e módulos de interface alterados, a comparação sintática corresponde ao código anterior quando se desconsideram classes e estilos de apresentação. Em `App.tsx`, as diferenças adicionais são o controle visual de tema, contêineres de apresentação da marca e os atributos de acessibilidade do menu e do bloqueio. Os hooks, comandos, cálculos, condições e eventos existentes foram preservados.

Além dessa comparação de código, os mesmos 14 cenários funcionais de navegador foram executados antes e depois do redesign. Essa evidência cobre os fluxos listados abaixo; não equivale a provar toda combinação de operações possível.

## Arquivos modificados e criados

Todos os caminhos de código abaixo são relativos a `aplicativo/`.

| Arquivos | Trabalho realizado |
| --- | --- |
| `src/style.css` | Tokens, paletas, componentes, estados, foco, movimento reduzido e responsividade. |
| `src/App.tsx` | Apresentação da entrada, marca, navegação e dashboard; controle de tema e atributos acessíveis. |
| `src/components/BirdRegistrationForm.tsx`, `HealthRegistrationForm.tsx`, `HealthHistory.tsx`, `DirectAttachments.tsx`, `RecordDialog.tsx` | Classes e estilos de apresentação dos formulários, históricos, anexos e modais existentes. |
| `src/modules/Breeding.tsx`, `Commercial.tsx`, `Agenda.tsx`, `Documents.tsx`, `DocumentsLibrary.tsx`, `DigitalBooklet.tsx`, `Settings.tsx` | Apresentação dos módulos existentes, mantendo os campos e as operações. |
| `index.html`, `public/manifest.webmanifest` | Inicialização visual e cor inicial do navegador. |
| Novos `src/lib/appearance.ts`, `src/components/ThemeToggle.tsx`, `public/theme-init.js` | Preferência e controle visual de tema aprovados. |
| Novo `tests/theme.test.ts` | Testes do mecanismo visual de tema. |
| Novos `tests/e2e/visual-redesign.spec.ts`, `theme.spec.ts`, `accessibility.spec.ts`, `visual-helpers.ts` | Verificações de apresentação, temas, responsividade e acessibilidade. |

Esta documentação, as instruções de instalação e o comparativo com capturas também fazem parte da entrega. As fontes, logotipos e modelos originais não foram editados nem substituídos.

## Testes e resultados

| Verificação | Resultado |
| --- | --- |
| Base anterior: testes automatizados e build | 226 testes aprovados; build aprovado. |
| Base anterior: cenários funcionais de navegador em produção | 14 de 14 aprovados. |
| Redesign: testes automatizados | 237 aprovados. |
| Redesign: TypeScript e build de produção | Aprovados. |
| Instaladores Android e Windows | Compilados; Android assemble/lint aprovado, sem erros. |
| Conteúdo incorporado nos instaladores | 92 recursos web idênticos à compilação de produção em APK e Windows ASAR. |
| Pacotes Android e Windows | Compilação aprovada; 92 recursos web conferidos iguais no APK e no ASAR Windows. |
| Assinatura Android e análise nativa | Assinatura válida e igual à anterior; análise com zero erros e os mesmos 30 avisos da base anterior. |
| Redesign: suite completa de navegador em produção | **39 de 39 aprovados**, em uma execução final de 2,6 minutos. |
| 20 áreas em claro/escuro e 360/768/1280/1440 px | Navegação preservada, sem rolagem horizontal global ou sobreposição de controles detectadas. |
| Modais, estados vazios, ficha, plantel com registros longos e busca | Aprovados nos cenários testados, inclusive em telefone. |
| Preferência de tema, sistema, recarga, bloqueio, armazenamento indisponível e reabertura offline | Aprovados. |
| Foco por teclado, menu móvel, movimento reduzido e contraste de texto amostral | Aprovados. |

Os 14 cenários funcionais existentes abrangem cadastro/edição de aves, erro de identificação duplicada com preservação do formulário, persistência após recarga, separação da demonstração, bloqueio, uploads diretos, cancelamento sem anexos órfãos, histórico de saúde e peso, reservas/vendas/entrega/devolução, pagamentos parciais e totais, histórico de clientes, acervo e metadados, caderneta PDF de quatro páginas, lembrete de calendário, backup criptografado/restauração, uso offline e exportação de suporte sem segredos.

O pacote Android mantém a versão exibida 0.2.0 e usa o código de instalação 2001 para atualizar a instalação anterior 2000. As bibliotecas e os contratos do aplicativo permanecem iguais. As instruções de atualização estão em [INSTALACAO_REDESIGN.md](INSTALACAO_REDESIGN.md).

Todos os dados de teste foram criados em contextos de navegador isolados. As capturas usam a demonstração existente e uma base de teste vazia; nenhum exemplo foi inserido em uma instalação pessoal ou em registros reais do usuário.

O APK mantém a identidade `br.com.recantodasasas.app.debug` e o certificado de avaliação anterior (SHA-256 `78a89de576577bb9ce97d2e7404d762e81f03005abc06c6e8ea5983e19dc0b35`). Foi gerado com `ANDROID_VERSION_CODE=2001` para permitir atualização sobre o código 2000, sem alterar a versão funcional, o esquema ou os arquivos de compilação do projeto. O instalador Windows mantém a identidade e o perfil de usuário. O lint Android mantém os 30 avisos anteriores de recursos/ícones e dependência disponível; nenhum aviso foi suprimido.

Não foram adicionadas dependências. O CSS passou de aproximadamente 4,5 kB para 6,7 kB comprimidos e a inicialização visual acrescenta cerca de 1 kB comprimido. Isso registra o tamanho dos artefatos; não substitui medição de desempenho em aparelhos físicos.

Na primeira verificação visual, identificações longas ainda causavam overflow. O ajuste de quebra de texto foi aplicado somente ao CSS e os casos passaram novamente. O foco do menu móvel fechado também foi corrigido somente pela apresentação CSS e pelos atributos acessíveis. A execução final de 39 cenários passou com essas correções.

Para reproduzir as verificações na pasta `aplicativo/`:

```sh
npm test
npm run build
RECANTO_E2E_PREVIEW=1 npm run test:e2e
```

## Comparativo

Abra [comparativo.html](Comparativo-Visual/comparativo.html) em um navegador depois de extrair a entrega. Ele mostra as imagens originais lado a lado, sem filtros ou edição, e permite escolher a tela. O comparativo do Início inclui os temas claro e escuro.

Capturas de exemplo:

- [Início anterior](Comparativo-Visual/before/02-inicio-desktop.png).
- [Início atualizado claro](Comparativo-Visual/after/02-inicio-desktop.png).
- [Início atualizado escuro](Comparativo-Visual/after/10-inicio-escuro-desktop.png).
- [Telefone atualizado](Comparativo-Visual/after/08-inicio-mobile.png).
- [Ficha da ave atualizada](Comparativo-Visual/after/04-ficha-ave-desktop.png).

## Limites da validação

O navegador usado foi Chromium no ambiente de desenvolvimento em nuvem. Não houve uso de aparelhos Android ou Windows físicos nesta revisão. A instalação e as interações específicas desses aparelhos, o calendário externo e a sincronização real entre aparelhos precisam de confirmação local. Os testes existentes de exportação nativa usam adaptadores de teste, não um aparelho físico.

O splash e as barras nativas Android e o fundo inicial da janela Electron não receberam integração dinâmica com a preferência visual, conforme o escopo aprovado. A escolha de tema se aplica à interface compartilhada. A preferência visual fica independente em cada aparelho.

Não há pendência de autorização para as alterações incluídas neste redesign. A validação sustenta os fluxos e resoluções examinados, sem prometer ausência absoluta de bugs em combinações não testadas.
