# Revisão 2 — estrutura B/C e listas com fotos

Esta revisão substitui a proposta visual anterior. Foi preparada sobre a auditoria do aplicativo 0.2.0 (`c161168`), sem editar seus arquivos, dados ou instaladores. O plano de auditoria anterior continua como referência técnica; as decisões de apresentação abaixo prevalecem.

## Estrutura solicitada

**Desktop B:** uma barra azul superior, marca colorida oficial à esquerda, ícones acima dos rótulos, título/busca/ação na mesma linha, indicadores em uma faixa compacta, tabela individual de aves na coluna principal e tarefas/resumo financeiro empilhados à direita. A tabela traz foto, nome, anilha, espécie, sexo, mutação, situação, recinto e acesso à ficha. As informações adicionais atuais continuam acessíveis abaixo e nas fichas. Não serão inventados indicadores ou alterados os critérios de vendas, recebimentos, saldo ou atraso para copiar os rótulos ilustrativos da imagem.

**Android C:** cabeçalho compacto de voltar/nome/anilha/menu, foto imediatamente abaixo, identificação e características à esquerda e peso/última pesagem à direita, ações na mesma linha, abas e histórico recente vertical na ficha, seguido dos documentos e dos demais detalhes existentes. Os detalhes completos, parentesco, histórico de situação, saúde/peso e documentos permanecem acessíveis.

**Início e Aves, nas duas plataformas:** usar a mesma apresentação de aves com fotos reais anexadas. Desktop em tabela como B; Android em lista de cartões sem rolagem horizontal global. Quando não houver foto, mostrar uma identificação visual de ausência, sem inventar uma fotografia. Filtros, pesquisa, campos, contagem e acesso à ficha do menu Aves permanecem. As prévias utilizam uma foto gerada e dados ilustrativos; isso não entrará no aplicativo real.

A preparação atual de várias miniaturas pode bloquear a interface, conforme o diagnóstico abaixo. A implementação das listas com fotos precisa considerar a correção autorizada desse processamento; multiplicar o componente atual sem essa revisão pode agravar os congelamentos relatados.

**Temas e fonte:** claro e escuro para cada estrutura; opção Sistema mantida. Noto Sans local com seu eixo real de pesos 100–900, títulos 800, ações 700–750, dados 600–700 e textos de apoio com peso menor para leitura confortável. Sem fonte externa ou nova dependência. Paleta oficial azul/turquesa, verde e amarelo de apoio; tonalidades escuras suaves.

**Identidade:** marca aprovada completa e símbolo vetorial completo em detalhe discreto. Não existe mascote independente ou pattern oficial no repositório. Não será inventado um substituto da marca. A auditoria encontrou oito PNGs derivados totalmente transparentes; a prévia usa o original válido de `01_Principal/Logo_Colorida_Transparente_1254px.png`. Os arquivos originais não foram editados. A escolha e aplicação do recurso válido são alterações visuais; reparar os derivados e seus catálogos não faz parte desta entrega sem definição separada.

## Aplicação ao código depois da aprovação

O inventário técnico e os arquivos existentes constam em [PLANO-E-AUDITORIA.md](PLANO-E-AUDITORIA.md). A atualização usará CSS/tokens e contêineres existentes. O complemento desta revisão prevê um componente de apresentação para a coleção de aves, reutilizado em Início e Aves, e uma apresentação compacta do histórico existente na ficha Android. Os eventos reais de abrir ficha, editar, registrar manejo e visualizar documentos serão conservados; filtros e campos serão reutilizados, sem nova base, regra ou operação comercial.

Arquivos visuais previstos: `src/style.css`, `src/App.tsx`, `src/modules/Breeding.tsx`, `src/components/HealthHistory.tsx`, componentes de formulários/diálogos/anexos e demais módulos apenas onde necessário para apresentação consistente. Um novo componente de coleção de aves pode ser necessário para evitar duas implementações visuais divergentes. O marcador de plataforma, usando Capacitor já instalado, afeta somente a seleção do layout.

O código de regras, armazenamento, autenticação, APIs, contratos, sincronização, exportação e modelos PDF permanece protegido. A investigação descrita abaixo identificou necessidades de processamento que exigem aprovação específica, independentemente do design.

## Travamentos: resultados e correções propostas

Relato: Android congela temporariamente e retoma ao rolar ou digitar. Testes isolados em Chromium com CPU reduzida 6× reproduziram mecanismos capazes de provocar esse comportamento. Não são testes do telefone físico e não identificam com certeza qual deles está causando o relato.

| Achado | Evidência | Proposta funcional para aprovação |
| --- | --- | --- |
| Backup automático ocupa a interface | Base vazia com artes oficiais: tarefas contínuas de 11,8 s e 9,2 s. | Reduzir alocações e decodificação repetida; se necessário, processar trabalho pesado fora da thread da interface, preservando backup automático, todos os arquivos, formatos, hashes e criptografia. |
| Miniaturas são preparadas antes de aparecer | 12 fotos de aproximadamente 1 MB: tarefa contínua de 9,3 s. | Adiar preparo até a região visível e distribuir o trabalho; preservar integridade, foto original, descarte de URLs e cancelamento. |
| Busca em saúde recalcula todo o histórico | Produção: 100 aves/2.000 registros, 143–276 ms por tecla. | Agrupamento derivado/memoização com resultados idênticos, incluindo filtros, ordenação e atualização depois da sincronização. |
| Telas do sistema carregam envelopes de todos os backups | Nove cópias sintéticas: cerca de 206 MB de texto carregados. | Carregar metadados leves onde a lista é necessária e ler o envelope escolhido sob demanda, sem mudar o banco, retenção ou cópias fixadas. |
| Bug confirmado no validador Base64 | Arquivos válidos de 4–10 MiB podem exceder a pilha da regex. | Validação linear equivalente, mantendo limites, caracteres, padding e mensagens; patch proposto ainda não aplicado. |

Detalhes de arquivo/trecho, motivos, impactos, riscos e alternativas:

- [Diagnóstico de backup, busca e processamento](diagnostico/DIAGNOSTICO-TRAVAMENTOS.md).
- [Diagnóstico de miniaturas, anexos e exportação](diagnostico/DIAGNOSTICO-MINIATURAS.md).
- [Patch Base64 proposto, sem aplicação](diagnostico/base64-proposto.patch).
- [Equivalência do patch: 14.190 entradas e arquivos grandes](diagnostico/verificacao-base64-proposto.json).

As medidas brutas acompanham os diagnósticos. A proposta do validador foi criada somente fora do aplicativo. A alternativa sem autorização funcional é aplicar exclusivamente o visual e manter os gargalos documentados; CSS não elimina essas tarefas síncronas. Não é adequado chamar isso de correção de travamentos.

## Validação e aprovação

Foram executados nesta auditoria 53 testes existentes de PDF/caderneta, anexos e transferência nativa: todos passaram. A falha Base64 foi reproduzida em investigação adicional que esses testes não cobriam. O diagnóstico não afirma ausência de bugs porque a suite passou.

As prévias revisadas abrangem cinco telas por plataforma/tema: Início, Aves, Ficha, Cadastro e Saúde/peso. **100 combinações** dessas telas com claro/escuro, desktop/Android e larguras de 360/390/768/1280/1440 px passaram nos exames de carregamento, erros JavaScript, rolagem horizontal global, sobreposição nos grupos examinados e título principal visível. Foram conferidos os 20 acessos de navegação nas duas plataformas, os oito filtros de Aves, troca claro/escuro/sistema e preservação do modo Sistema ao navegar. O relatório é `validacao-responsividade-v2.json`. Essas verificações não executam operações reais do aplicativo nem constituem certificação completa de acessibilidade. O aplicativo continua sem alterações de código; nenhuma base pessoal foi usada.

O prompt determina aprovação das prévias antes de implementar e autorização explícita para mudanças funcionais. A decisão pedida é: aprovar a apresentação da revisão 2 e definir se as correções de processamento acima estão autorizadas. Depois disso serão aplicadas somente as mudanças aprovadas, comparado o comportamento e executados os testes completos, build e validação das duas plataformas, com limites de testes físicos claramente documentados.
