# Recanto das Asas — atualização 0.2.0

Esta atualização acrescenta anexos diretamente nos registros, reorganiza os históricos por ave e passa a emitir somente a caderneta digital de quatro páginas, usando o modelo enviado. Atualize **Android e Windows antes de voltar a editar ou sincronizar**: a nova versão utiliza o esquema de dados 2, que as versões antigas não reconhecem.

## 1. Guardar os dados antes de atualizar

1. Nos dois aplicativos, abra **Backup e recuperação → Criar e baixar backup completo**.
2. Guarde os arquivos `.ra-backup` fora dos aplicativos, em um pendrive ou armazenamento privado. Preserve separadamente a senha da base; ela será necessária para recuperar o backup.
3. Se houver alterações pendentes ou diferenças entre os aparelhos, preserve o backup de cada um. A atualização não combina automaticamente essas diferenças.
4. Feche os aplicativos Windows e Android. Mantenha o servidor e o Tailscale como estão.

Não desinstale o aplicativo, não limpe seus dados e não crie outra base como procedimento de atualização. O backup dos registros é o arquivo `.ra-backup`; o ZIP do código-fonte não contém sua base privada.

## 2. Baixar e extrair a atualização

1. Entre no GitHub com a conta que tem acesso ao repositório privado.
2. Abra a entrega **v0.2.0-avaliacao**: `https://github.com/radibruque/recanto-das-asas/releases/tag/v0.2.0-avaliacao`.
3. Em **Assets**, baixe **Source code (zip)**. Nesta entrega, esse ZIP contém o pacote de atualização: APK, instalador Windows dividido em três partes, comandos de preparação e verificações de integridade.
4. No Windows, clique com o botão direito no ZIP e abra **Propriedades**. Se houver **Desbloquear**, marque e confirme.
5. Escolha **Extrair tudo** e use uma pasta curta, por exemplo `C:\Recanto-Atualizacao`. Mantenha os arquivos e subpastas juntos.

Execute os comandos na pasta extraída, fora da visualização do ZIP. Não é necessário instalar Node.js, npm ou ferramentas de desenvolvimento.

## 3. Atualizar o Windows

1. Confirme que o Recanto das Asas está fechado e que você está no **mesmo usuário Windows** usado na instalação anterior.
2. Na pasta extraída, execute **01-Preparar-Windows.cmd**. O comando usa **Preparar-Windows.ps1**, reúne as três partes do instalador e confere seu SHA-256.
3. Aguarde a confirmação de preparação. Se aparecer erro de integridade ou de leitura, não execute um instalador incompleto; extraia novamente o ZIP completo.
4. Execute o arquivo gerado **Recanto-das-Asas-0.2.0-x64-Setup.exe** e conclua a instalação sobre a versão existente.
5. Aguarde a atualização do Android antes de abrir os aplicativos para editar ou sincronizar.

O instalador atende Windows 10/11 x64 e mantém a pasta de dados `%APPDATA%\RecantoDasAsas`. A instalação usa o mesmo usuário, identidade e atalhos das versões anteriores.

O EXE de avaliação não tem assinatura Authenticode. Se o Windows mostrar um aviso de origem, confira o pacote e a integridade do arquivo. Não desative o antivírus ou outras proteções. Em caso de bloqueio, preserve a mensagem apresentada.

## 4. Atualizar o Android

1. Transfira **Recanto-das-Asas-0.2.0-debug.apk** do pacote extraído para o telefone, por cabo USB ou armazenamento privado.
2. Abra o APK no aplicativo **Arquivos** do telefone.
3. Se necessário, permita a instalação somente pelo aplicativo usado para abrir o arquivo.
4. O Android deve oferecer **Atualizar**. Confirme e aguarde a conclusão. **Não desinstale a versão atual.**
5. Se aparecer “Aplicativo não instalado”, conflito de assinatura ou uma instalação separada, preserve a mensagem e interrompa essa tentativa sem apagar os dados.

Este APK de avaliação atende Android 10 ou superior. A identidade continua `br.com.recantodasasas.app.debug`; o código de versão passa de 1000/1001 para 2000. A compatibilidade da assinatura deve ser conferida no pacote entregue e na atualização realizada pelo aparelho.

## 5. Conferir e retomar a sincronização

1. Depois de atualizar **os dois aparelhos**, abra os aplicativos e confira **0.2.0** no rodapé ou em **Atualizações**.
2. Desbloqueie com a senha existente. Confira as aves, os registros e os anexos antes de alterar a base.
3. Se aparecer uma tela para criar uma base nova onde antes existiam registros, pare e confira o usuário Windows ou a instalação Android. Não crie outra base nem apague a anterior para tentar corrigir.
4. Confira **Sincronização**: mantenha o mesmo endereço HTTPS, o mesmo identificador da base — por exemplo, `principal`, com a mesma grafia — e a mesma chave de acesso.
5. Como seu uso principal é no telefone, sincronize primeiro nele. Depois sincronize o aplicativo Windows para receber a base do servidor.
6. Se surgir conflito, examine o resumo antes de escolher. A base do telefone pode substituir a remota somente se contiver os registros que você deseja manter; registros exclusivos do Windows não são combinados automaticamente. Preserve os backups dos dois lados.
7. Faça um novo backup depois de conferir a atualização e a sincronização.

**O servidor local e o Tailscale não precisam ser reinstalados ou reconfigurados.** O desktop deve continuar ligado, com seu usuário conectado, internet, Tailscale e servidor ativos para o telefone sincronizar fora de casa.

A senha da base e a chave do servidor continuam sendo informações diferentes. Não envie nenhuma delas em capturas de tela ou relatos de problema.

## O que mudou

| Área | Como usar na versão 0.2.0 |
| --- | --- |
| Aves | Anexe fotos e documentos durante o cadastro ou a edição. **Escolher foto principal** define a foto da ficha e da caderneta. Os campos de documento de apoio, data/motivo da movimentação e motivo da situação foram retirados do formulário. O histórico existente é preservado. |
| Ficha da ave | Ações e informações reorganizadas. O resumo mostra o peso mais recente registrado no manejo. A evolução do peso permanece em **Saúde e peso**. |
| Saúde e manejo | A lista mostra as aves que têm registros. Abra **Ver histórico**, depois um registro para consultar informações completas, fotos e documentos. Anexe novos arquivos no próprio registro. |
| Documentos | Acervo dos arquivos anexados nos outros cadastros, com agrupamento por ave, categoria, contato, operação ou origem. Use os filtros, **Ver arquivos → Detalhes**, a prévia, **Visualizar** e **Baixar original**. Observações e informações podem ser editadas preservando o arquivo original. |
| Agenda | Tarefas agrupadas por ave ou em tarefas gerais, filtros e detalhes. Defina data, horário e antecedência para preparar um lembrete no calendário. |
| Clientes e fornecedores | **Histórico / transações** mostra operações, aves, entregas e contas vinculadas ao contato. |
| Vendas e reservas | Botões separados **VENDA** e **RESERVA** abrem seus respectivos formulários. O histórico comercial é organizado por ave. |
| Financeiro | **Contas a receber** e **Contas a pagar** abrem listas próprias. Registre um pagamento parcial ou use **Usar saldo total**, selecione a conta financeira e confirme somente o dinheiro efetivamente recebido ou pago. O fechamento de caixa mostra valores previstos, contados, diferença e movimentos considerados. |
| Caderneta do pet | Somente emissão digital de quatro páginas verticais, com os dados do modelo enviado e a foto encaixada na moldura. Histórico organizado por ave, com cada original preservado. |

O estoque e os relatórios mantêm seus fluxos de uso. As melhorias de exportação de arquivos também são usadas pelas funções que salvam documentos.

## Emitir a nova caderneta

1. Abra **Caderneta do pet** e selecione a ave.
2. Revise os campos das quatro páginas: identificação, identidade/origem, desenvolvimento e saúde/contatos. Dados adicionais podem ser guardados em **Salvar dados da caderneta**.
3. Confira a foto cadastrada ou use **Escolher foto principal** para anexar outra diretamente. A imagem inteira é ajustada à moldura, mantendo sua proporção. Fotos grandes recebem uma cópia preparada para a ficha e o PDF; o original fica no acervo.
4. Confira os registros de peso. Consultas e exames são copiados somente quando selecionados e revisados; o modelo dispõe de duas linhas para esses registros.
5. Toque em **Emitir caderneta digital**. No Android, escolha uma pasta e confirme o salvamento no seletor do sistema.
6. Abra o PDF salvo e confira as quatro páginas e a foto. Se cancelar o salvamento ou o destino falhar, o documento já emitido pode ser recuperado em **Cadernetas emitidas por ave → Ver cadernetas → Baixar original**.

Não há opção de livreto ou preparação para impressão física nesta versão. PDFs antigos arquivados não são alterados: emita uma nova caderneta para usar o novo modelo.

## Lembretes da agenda

No Android, abra os detalhes de uma tarefa com horário e toque em **Adicionar ao calendário**. O aplicativo abre o calendário do aparelho com os dados da tarefa: **confira o horário e o lembrete e confirme em Salvar no calendário**. O calendário escolhido será responsável pelo aviso; confira também suas permissões de notificação.

No Windows, use **Baixar lembrete (.ics)** e importe o arquivo no calendário que você utiliza. Confira o evento, a antecedência e a notificação após importar. Os horários registrados no Recanto das Asas usam Brasília.

Editar ou concluir uma tarefa no Recanto das Asas não altera um evento já salvo no calendário. Ajuste ou remova esse evento no calendário também. Evite importar a mesma tarefa repetidamente para não criar eventos duplicados.

## Verificação após instalar

Antes de voltar ao uso habitual, confira seus registros, abra um anexo existente, faça uma alteração fictícia em **Demonstração**, sincronize entre os aparelhos e emita uma caderneta digital. No Android, confira o salvamento completo e a abertura do PDF; no Windows, confirme que o saldo financeiro e os registros anteriores continuam corretos.

Foram executados testes automatizados de dados, anexos, exportação, integridade e fluxos de navegador. O plugin de arquivos Android também foi executado em uma JVM com adaptadores controlados para simular sucesso, cancelamento e falhas de gravação. **Isso não equivale a validar a instalação, a atualização, os seletores de arquivo ou as notificações em um Android físico.** Esses passos precisam ser conferidos nos seus aparelhos.

Depois que a base passar ao esquema 2, não use as versões 0.1.0/0.1.1 para abrir, editar ou sincronizar essa base. Preserve os backups anteriores. Um retorno de versão exige uma base e um backup compatíveis; instalar a versão antiga por cima não desfaz a migração.

Se ocorrer uma falha, preserve a mensagem e os dados. Use **Reportar problema** para revisar um relato antes de compartilhar, sem senha, chave de acesso, documentos pessoais ou backup privado.
