# Recanto das Asas

Painel privado para cadastro de aves, casais, posturas, ovos, eclosões, filhotes e parentesco básico.

## Dados e acesso

- Registros reais e exemplos usam espaços separados no banco D1.
- A demonstração é inicializada uma única vez e sempre identificada como fictícia.
- A política de acesso da hospedagem permite apenas a conta proprietária.
- A plataforma protege a página e as APIs; nenhuma credencial fica no navegador ou no código.
- As consultas usam instruções preparadas e as operações compostas usam transações D1.

## Fluxos

Cadastre aves, forme um casal, abra uma postura e registre cada ovo. A eclosão cadastra automaticamente o filhote e vincula o ovo, a postura, a espécie e os pais. Mudanças de mutação geram um histórico individual. Encerrar casais e posturas mantém o histórico.

Identificações repetidas, vínculos incompatíveis, parentesco circular e datas incoerentes são rejeitados. O registro de casais com parentesco conhecido pede confirmação explícita no formulário. A interface não prevê mutações de cruzamentos nem infere genótipos.

## Verificação realizada

- Cadastro de macho e fêmea; formação de casal; postura; ovo; eclosão com filhote.
- Vínculos pai e mãe exibidos na ficha e no parentesco.
- Edição da mutação com conservação do registro anterior.
- Bloqueio do encerramento de postura com ovo ainda em incubação.
- Isolamento do espaço real e permanência dos exemplos após recarregar.
- Painel e formulário inspecionados com largura de 390 pixels.
- TypeScript e construção do Worker verificados.

O navegador de verificação não disponibilizou o contexto WebMCP; os fluxos foram testados pela interface.

## Desenvolvimento

Use os scripts originais do projeto e o fluxo do plugin Sites. As migrações em drizzle são geradas a partir de db/schema.ts. A identidade do projeto e a declaração lógica DB ficam em .openai/hosting.json. Os dados locais de verificação não entram no pacote de hospedagem.
