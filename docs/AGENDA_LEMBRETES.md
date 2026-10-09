# Agenda e lembretes

A Agenda reúne as tarefas por ave, com filtros de situação, ave e período. Aves sem tarefas nos filtros não aparecem na lista. Tarefas sem ave ficam em **Tarefas gerais**. Abra **Ver tarefas** e depois **Ver detalhes** para editar, concluir ou criar um lembrete.

## No Android 10 ou superior

1. Ao cadastrar ou editar a tarefa, informe sua data, o **Horário do lembrete (Brasília)** e a antecedência desejada.
2. Abra os detalhes da tarefa e toque em **Adicionar ao calendário**.
3. No calendário do telefone, confira a data e o horário. Escolha também a notificação ou lembrete. Alguns calendários ignoram a antecedência enviada pelo aplicativo.
4. Confirme em **Salvar** no próprio calendário.

Abrir a tela de calendário não significa que o evento foi salvo. Depois de confirmar, o calendário escolhido cuida do aviso mesmo com o Recanto das Asas fechado. As notificações dependem das permissões e das configurações desse calendário no telefone. Se não houver um calendário instalado, é possível baixar o lembrete `.ics` e importá-lo em um calendário compatível.

O calendário recebe somente o título, a referência da ave e as observações da tarefa escolhida. A integração não acessa a base de dados do calendário e não exige permissão de leitura ou escrita de calendário no Recanto das Asas.

## No Windows

1. Defina a data, o horário e a antecedência na tarefa.
2. Nos detalhes, toque em **Baixar lembrete (.ics)**.
3. Importe o arquivo no calendário que você utiliza e confira o horário e a notificação.

O arquivo inclui o evento e um aviso de calendário `VALARM`. O programa de calendário precisa oferecer suporte a importação e notificações. Ter somente o arquivo salvo no computador não ativa um alarme.

## Alterar ou concluir uma tarefa

O evento adicionado ao calendário é uma cópia independente. Editar, reabrir ou concluir a tarefa no Recanto das Asas **não altera nem cancela** o evento externo. Ajuste ou exclua também o evento no calendário. Evite adicionar o mesmo evento mais de uma vez.

Os horários do aplicativo são de Brasília. O arquivo `.ics` contém o instante correspondente em UTC, para que o calendário o converta corretamente ao seu próprio fuso horário. Tarefas antigas sem horário continuam válidas; basta editá-las para definir um horário se desejar um lembrete. A exportação de lembrete exige uma tarefa aberta com data e horário futuros.
