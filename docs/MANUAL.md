# Manual curto — versão 0.1.0

## Primeiro acesso

Crie uma base com senha de pelo menos dez caracteres. Guarde a senha em um gerenciador ou em outro local seguro: perdê-la impede recuperar a base e seus backups. A base real está vazia. Clique em **Demonstração** e **Criar exemplos fictícios** para explorar; volte a **Meu criatório** antes de cadastrar seus próprios dados. Não use dados reais em exemplos ou relatos de teste.

Em **Configurações**, preencha seus contatos, categorias financeiras e estimativas de incubação. O campo de estimativas aceita JSON, por exemplo `{"Calopsita": 20}`; esse número é uma estimativa escolhida pelo criador, não uma orientação clínica. O sistema usa a espécie exatamente como cadastrada.

## Aves e reprodução

Em **Aves**, cadastre identificação, espécie e origem; nome, documentos pessoais e microchip são opcionais. Use sexo indeterminado quando desconhecido. Informe fonte e data de correções de sexagem e mutação. Mudanças de situação, recinto ou responsável exigem motivo e preservam histórico. Se um formulário indicar erro, corrija-o sem fechar: os campos permanecem preenchidos.

Para anexar uma foto, exame ou documento, arquive o arquivo em **Documentos** e vincule a ave. Depois selecione a imagem na ficha ou os documentos no registro de saúde. São aceitos PDF, PNG, JPEG e TXT UTF-8, até 10 MiB. **Nova versão** conserva a anterior. Validade vencida indica somente a data informada; o aplicativo não atesta regularidade legal.

Em **Casais**, selecione macho e fêmea disponíveis da mesma espécie. O aviso de parentesco precisa ser revisto. Em **Reprodução**, abra uma postura e registre os ovos individualmente. Fertilidade e resultado são campos distintos. Confirmar eclosão cria um filhote com os pais e vínculos automaticamente e impede repetir a criação. Registre pesagens, alimentação, desmame e demais informações em **Saúde e manejo**, e prazos em **Agenda**.

## Operação comercial

Cadastre contato em **Clientes e fornecedores** e uma conta financeira em **Financeiro**. Em **Vendas e reservas**, inclua cada ave como item de quantidade um. Orçamentos não bloqueiam disponibilidade; reservas e vendas bloqueiam. Defina valores, desconto, taxas e parcelas. A soma das parcelas é igual ao total, com distribuição exata dos centavos.

Confirme recebimentos somente depois de verificar o dinheiro. Um recebimento parcial deixa o restante em aberto. Converter uma reserva em venda preserva parcelas e sinal. **Registrar entrega** conserva procedência e vincula o cliente. Revise caderneta e documentos na central correspondente.

Cancelamento/devolução com dinheiro recebido pede conta para o reembolso integral e motivo. Confirme depois de devolver efetivamente o dinheiro: esta ação registra o reembolso manual, não executa Pix ou transferência bancária. Os recebimentos anteriores continuam no histórico. Estorno financeiro é para corrigir um registro indevido e reabre o saldo; não o use para esconder uma devolução.

**Financeiro** permite obrigações, pagamentos parciais, transferências, conciliação e conferência de caixa. Transferências entre suas contas não são faturamento. A conferência registra diferença entre previsto e contado e não cria ajuste automaticamente. Cadastre aportes/retiradas com categorias próprias. Não há integração bancária ou envio automático de cobranças.

Em **Estoque**, mantenha produtos e lotes separados do plantel. Use uma unidade consistente, até três casas decimais e custo em reais. Consumo/perda reduzem saldo; compra/devolução aumentam. Saldo negativo requer autorização e motivo. Uma compra no estoque ainda exige lançar sua despesa correspondente no Financeiro; não há vínculo automático de compra nesta versão.

## Relatórios, caderneta e artes

**Relatórios** oferece filtros, escolha de colunas, ordenação e exportação PDF/XLSX/CSV/DOCX. Confira período, espaço real/demo e notas do indicador. Valores vendidos, recebidos e devidos são distintos. Recorrências geram PDF ao acessar essa central; se o aplicativo estiver fechado, ficam pendentes. Exportações são privadas e o compartilhamento é manual.

Em **Caderneta do pet**, selecione a ave, venda opcional, páginas, formato A5/A6 e registros de saúde que deseja entregar. Confira a revisão antes de emitir. Custos e observações internas não entram. Os campos de tutor ficam em branco. Gere leitura normal ou livreto A4; o histórico preserva a versão emitida. Use primeiro uma impressão de prova conforme instruções da tela. Ordem do PDF foi testada; impressoras físicas ainda não foram testadas.

**Identidade visual** inclui 78 originais aprovados, com metadados e download individual ou em ZIP. Novas imagens podem ser arquivadas como anexos na categoria Identidade visual, com versões preservadas. Não há redesenho da marca nem vetor anunciado sem arquivo original.

## Backup e restauração

Em **Backup e recuperação**, crie e baixe o backup completo. Ele inclui ambos os espaços, anexos, documentos, configurações e artes. Guarde outra cópia fora do aparelho, junto da informação necessária para encontrar sua senha. O aplicativo guarda também cópias locais, mas elas não sobrevivem à perda física ou limpeza do armazenamento.

O backup automático acontece no próximo acesso quando o intervalo configurado vencer. Não funciona com o aplicativo fechado. Falhas deixam um aviso de execução pendente. Para restaurar em uma instalação limpa, crie a base usando **a mesma senha do backup**, selecione `.ra-backup`, verifique a prévia e confirme a substituição. Será guardada uma cópia da base anterior. Se a base mudar durante a preparação, repita a revisão; a alteração não será sobrescrita.

Importação CSV é diferente de restauração: baixe o modelo em Configurações, preencha as colunas, selecione o arquivo e revise os erros. Pais/mães usam identificações existentes ou presentes na mesma planilha. A confirmação faz backup e importa como uma operação única. Não há dados do banco D1 de produção dentro do ZIP de código recebido; uma migração completa depende de exportação autorizada desse banco.

## Usar dois aparelhos

Consulte [Hospedagem](HOSPEDAGEM.md) antes de configurar Sincronização. Use mesma senha, endereço HTTPS, identificador da base e token nos aparelhos. Na instalação vazia do segundo aparelho, escolha a base remota existente. Se os dois editarem sem rede, pode haver conflito: preserve cópias e decida qual base ficará ativa. Não há combinação automática de fichas.

## Atualização e problemas

Antes de instalar uma nova versão, faça um backup verificado. Use instalador da mesma identidade, esquema compatível e assinatura válida. Não desinstale para atualizar. O APK debug tem identidade de avaliação separada; para passar à identidade definitiva, faça backup e restaure na versão release. A distribuição online de instaladores ainda não está configurada.

Em **Reportar problema**, descreva passos, esperado e ocorrido; visualize o pacote e baixe-o para compartilhar manualmente. A exportação remove formatos comuns de e-mails, documentos, telefones e segredos, mas o texto precisa ser revisado: nomes e informações livres podem ser reconhecíveis. Banco completo, anexos e documentos não são incluídos automaticamente. O compartilhamento com suporte ou com o ChatGPT é feito por você.
