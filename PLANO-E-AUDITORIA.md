# Plano de redesign — desktop B e Android C

Auditoria e proposta de 13 de outubro de 2026. Aplicativo examinado: versão 0.2.0, branch `design/redesign-visual`, commit `c1611689dfa6f4621c9f9c4950274bce635d809a`. O checkout estava limpo antes da auditoria e permanece sem alterações.

## O que está entregue nesta fase

Auditoria, proposta visual, paleta e protótipo isolado. As prévias cobrem início, ficha e cadastro de ave nas quatro combinações; também mostram saúde e peso para exemplificar o histórico do conceito C. Nenhum código do aplicativo foi substituído. Não há novo APK ou instalador nesta fase.

O item 9 do prompt solicitado estabelece: **“Aguarde minha aprovação do plano e das prévias antes de implementar.”** Esta entrega torna essa aprovação concreta. A implementação começa depois da confirmação dessas prévias e deste plano.

## Resultado da auditoria

O aplicativo instalado está em `aplicativo/`: React 19.2.6, TypeScript 5.9.3 e Vite 8.0.13; Electron 44.7.0 no Windows e Capacitor 8.5.3 no Android. Usa CSS próprio com tokens, Noto Sans local e ícones Lucide. A navegação é controlada pelo estado em `src/App.tsx`, sem biblioteca de rotas. A base original `painel-base/` continua preservada e separada; não controla a interface atualmente instalada.

O projeto possui 20 áreas: Início, Aves, Casais, Reprodução, Parentesco, Saúde e manejo, Agenda, Clientes e fornecedores, Vendas e reservas, Financeiro, Estoque, Relatórios, Documentos, Caderneta do pet, Identidade visual, Backup e recuperação, Sincronização, Configurações, Atualizações e Reportar problema.

`Breeding.tsx`, `Commercial.tsx`, `Documents.tsx` e `Settings.tsx` organizam esses módulos; componentes próprios tratam formulários, anexos, históricos e diálogos. `src/domain/` contém as regras; `src/lib/storage.ts` administra a base criptografada e outros arquivos de `src/lib/` tratam sincronização, PDFs, exportação e integração nativa.

Claro, Escuro e Sistema já existem. A preferência `recanto.ui.theme` fica separada da base e da sincronização; `public/theme-init.js` aplica a aparência antes do React. Essa infraestrutura será mantida.

## Proposta visual

**Windows / desktop — conceito B:** assinatura horizontal oficial, navegação superior com os mesmos acessos, indicadores compactos, tabelas organizadas, busca clara, formulários com seções e ações alinhadas. Os grupos Comercial, Central e Sistema acomodam seus módulos sem excluir acessos ou duplicar controles. Em janelas menores, o layout B se adapta à largura.

**Android — conceito C:** cabeçalho compacto, foto real da ave em destaque, títulos com linguagem editorial, cartões, dados organizados e histórico legível. O menu compacto mantém os 20 módulos e os controles Meu criatório, Demonstração e Bloquear. Aparência permanece disponível em Claro, Escuro e Sistema. As abas da ficha preservam Ficha, Parentesco, Histórico, Saúde e peso e Documentos.

Cada conceito mantém sua composição em ambos os temas. O Android claro continua C; o Windows escuro continua B. A foto de exemplo foi gerada somente para este protótipo e está identificada como ilustrativa. Na implementação, continuará sendo usada a foto realmente anexada por `photoId`; esse exemplo não será incluído no aplicativo.

O protótipo apresenta somente telas de amostra. Seus botões de registro, bloqueio e upload não executam ações; menus sem tela de amostra permanecem listados. Essa limitação pertence ao protótipo. No aplicativo, todas as operações existentes continuarão conectadas aos seus eventos reais.

## Paleta proposta

A paleta oficial está em `identidade-visual/07_Guia/Paleta_RGB.json`, também incorporada em `aplicativo/public/artes/07_Guia/Paleta_RGB.json`: azul `#054973`, turquesa `#078FA8`, azul claro `#29AAEA`, verde `#67994B` e amarelo `#FBC732`.

| Uso | Claro | Escuro |
| --- | --- | --- |
| Fundo | `#F4F8FA` | `#233B46` |
| Cartões | `#FFFFFF` | `#294550` |
| Superfície secundária | `#E8F2F5` | `#34515D` |
| Texto principal | `#183A4D` | `#EDF5F8` |
| Texto secundário | `#58717E` | `#BED2D9` |
| Ação principal | `#054973` | `#8CCCD9` |
| Texto da ação principal | `#FFFFFF` | `#123744` |
| Bordas de campos | `#728996` | `#92ADB9` |
| Verde para texto e estados | `#487332` | `#B2CBA3` |
| Amarelo de apoio | `#FBC732` | `#FBC732` |

Os azuis e turquesas suaves derivam da marca. Os arquivos originais dos logotipos permanecem iguais; são usadas suas versões oficiais azul e branca. Verde e amarelo aparecem como apoio. Cores de erro continuam tendo indicação textual, sem depender apenas da cor.

Contrastes calculados: azul oficial/branco 9,52:1; texto principal claro/cartão 11,99:1; texto secundário claro/superfície secundária 4,52:1; texto principal escuro/cartão 9,23:1; texto secundário escuro/superfície secundária 5,40:1; botão turquesa/texto escuro 7,10:1. Os controles de tema e as abas móveis das prévias foram revisados para toque de pelo menos 44 px de altura e legibilidade. Isso não equivale a uma certificação WCAG completa.

## Arquivos previstos para a implementação

Todos os caminhos de código abaixo são relativos a `aplicativo/`.

| Arquivo | Alteração prevista |
| --- | --- |
| `src/style.css` | Tokens da marca, composição B/C, componentes, foco, responsividade e movimento reduzido. |
| `src/App.tsx` | Contêineres do topo, navegação e apresentação do dashboard; mesmos estados, indicadores, eventos e comandos. |
| `src/main.tsx` | Marcador exclusivamente visual da plataforma, se necessário, usando Capacitor já instalado; sem alterar bridges ou integrações. |
| `src/modules/Breeding.tsx` | Apresentação da ficha, foto, ações e abas; mesmos dados e condições. |
| `src/components/BirdRegistrationForm.tsx` e `HealthRegistrationForm.tsx` | Apresentação e organização visual das seções, preservando campos, atributos, validações e eventos. |
| `src/components/RecordDialog.tsx`, `DirectAttachments.tsx`, `HealthHistory.tsx`, `ThemeToggle.tsx` | Aparência de diálogos, anexos, históricos e escolha de temas; processamento e funcionamento preservados. |
| `src/modules/Agenda.tsx`, `Commercial.tsx`, `Documents.tsx`, `DocumentsLibrary.tsx`, `DigitalBooklet.tsx`, `Settings.tsx` | Classes e contêineres de apresentação onde CSS compartilhado não for suficiente. |
| `public/theme-init.js`, `index.html`, `public/manifest.webmanifest` | Valores visuais de cores para carregamento e navegador; algoritmo de temas preservado. |
| Testes de tema, geometria e acessibilidade em `tests/e2e/` | Atualizar expectativas da paleta e do layout, preservando verificações funcionais. |
| Documentação e capturas | Comparação, evidências de validação e instruções de atualização. |

Os arquivos específicos serão limitados ao necessário. Não será feita refatoração geral. Não serão alterados os diretórios de regras de negócio, banco, persistência, sincronização, templates PDF, processamento de arquivos, configuração Electron, bridges nativas, dependências ou lockfiles.

## Dependências entre interface e lógica

- `App.tsx` mistura JSX com os hooks de desbloqueio, bloqueio, comandos, backup e sincronização. A mudança será limitada aos contêineres e apresentação; esses hooks permanecem iguais.
- `Overview` calcula indicadores e períodos financeiros. Serão reorganizados os resultados já existentes, preservando fórmulas, filtros e critérios.
- `Breeding.tsx` compartilha seleção, abas e editores. Serão mantidos `selectedId`, `tab`, abertura dos formulários e condições.
- `AttachmentThumbnail` recebe um limite de altura visual. O destaque da foto pode ajustar dimensões de apresentação sem tocar em bytes, anexação, leitura ou exportação.
- O projeto possui breakpoints, mas não tem identificação global da plataforma para o layout. O marcador de apresentação utilizará `Capacitor.getPlatform()` já disponível para manter C no Android, inclusive em tablet, e B no desktop. O navegador utilizará uma adaptação responsiva documentada. Não haverá mudança no plugin ou na segurança nativa.
- O menu compacto deve continuar impedindo foco em controles ocultos e conservar os atributos acessíveis. Não serão renderizadas duas cópias funcionais da navegação.

Essas mudanças são de apresentação. Se a implementação revelar necessidade de alterar lógica funcional, será apresentado o arquivo e trecho, motivo, impacto, riscos e alternativa antes de executar, conforme o prompt.

## Etapas posteriores à aprovação

1. Criar branch específica a partir de `c161168`, registrando esse ponto de restauração; preservar o trabalho existente.
2. Aplicar tokens e estrutura B/C progressivamente, sem reconstruir o aplicativo.
3. Adaptar fichas, formulários e componentes dos 20 módulos.
4. Revisar claro, escuro e sistema, responsividade, foco, contraste e movimento reduzido.
5. Comparar o código funcional com a base e executar os testes existentes, sem enfraquecer verificações.
6. Compilar as duas plataformas e conferir os recursos incorporados. Produzir instaladores de atualização preservando a identidade anterior.
7. Entregar capturas reais, resultados, arquivos modificados e limitações.

## Validação desta fase e limites

Na base atual, foram executados **237 testes em 16 arquivos**, todos aprovados, e **TypeScript + build de produção**, aprovados. O build mantém um aviso já existente sobre importação dinâmica em `src/lib/exports.ts`; não foi alterado para este trabalho. Os logs estão em `validacao-base/`.

O inventário atual também contém 39 cenários Playwright, que não foram reexecutados nesta fase de auditoria e protótipo. Serão executados após a implementação. A cobertura existente inclui cadastro/edição, exclusão sem vínculos, validações, persistência, separação da demonstração, anexos diretos, cancelamento sem órfãos, foto, saúde/peso, comercial/pagamentos, histórico de clientes, documentos, PDF digital de quatro páginas, calendário, backup/restauração, uso offline e suporte, além de temas, módulos e acessibilidade.

As prévias foram capturadas em Chromium no ambiente de nuvem. **80 combinações** de plataforma, tema, tela e largura (360, 390, 768, 1280 e 1440 px) passaram nos exames de carregamento, erros JavaScript, rolagem horizontal global, sobreposição nos grupos examinados e título principal visível. A revisão final repetiu 20 combinações de saúde/peso depois do ajuste dos rótulos do histórico. Os 20 módulos foram conferidos nas duas navegações; a troca de tema, manutenção do modo Sistema e links da galeria passaram. Os relatórios JSON acompanham a entrega.

O protótipo e a galeria foram verificados por HTTP local. A abertura direta por `file://` não pôde ser verificada: o Chromium desta nuvem bloqueia esse tipo de navegação por política administrativa. Os arquivos HTML e seus recursos acompanham o ZIP para abertura no computador; as imagens também ficam visíveis diretamente no GitHub, sem executar o protótipo.

As imagens demonstram a proposta visual; não validam sincronização, exportação ou cadastro no futuro layout. Não houve teste em Android ou Windows físicos nesta fase. A tipografia de títulos com serifas usa a fonte de sistema disponível e pode variar entre aparelhos. Nenhuma promessa de ausência total de bugs é feita.
