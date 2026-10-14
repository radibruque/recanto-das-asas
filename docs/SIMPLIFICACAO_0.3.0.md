# Evolução do aplicativo — 0.3.0

## Base e preservação

Base funcional: versão 0.2.3, commit `72cbd1b`, branch `fix/atalhos-android-0.2.3`, sem alterações locais. Não foi encontrado `AGENTS.md`. A implementação foi isolada na branch `feature/simplificacao-0.3.0`; o ponto recuperável local `checkpoint/pre-simplificacao-0.2.3` conserva a base anterior. A branch principal, os arquivos originais e os registros de usuários não são substituídos. Nenhuma publicação, contratação ou mensagem a terceiros faz parte desta entrega.

Tecnologias existentes: React 19, TypeScript, Vite, Lucide, CSS com tokens e temas, Capacitor 8 no Android e Electron no Windows. A navegação usa estado React. A base local IndexedDB é criptografada por PBKDF2/AES-GCM; backups e anexos usam a infraestrutura atual. Sincronização por snapshots cifrados, revisão otimista, fila idempotente e conflitos preservados. Os instaladores atuais mantêm as origens `https://localhost` e `app://recanto` e identidades de instalação.

O PDF comparativo não está disponível no ambiente. O escopo autossuficiente do pedido autoriza as etapas abaixo e é a referência de implementação.

## Diagnóstico inicial

Os 20 módulos existentes já oferecem cadastro/histórico de aves, fontes e parentesco, casais/posturas/ovos/eclosão, saúde e peso, agenda manual, contatos, operações comerciais, financeiro, estoque, relatórios, anexos, caderneta, auditoria, backup e sincronização. A apresentação precisa reduzir troca de contexto, repetição de operações multiave e perda de filtros ao trocar de menu. Resumos misturam os setores; busca é genérica e indicadores não aplicam os critérios anunciados.

Ainda não existem catálogo de espécies com IDs estáveis, tarefas derivadas vinculadas à reprodução e compra atômica ligada ao financeiro. A configuração de estimativas usa JSON. Estas integrações exigem migração versionada do esquema interno 2 para 3, sem converter movimentos antigos em compras nem atribuir fatos desconhecidos. O envelope criptográfico e o formato dos backups permanecem os mesmos. O servidor precisa reconhecer clientes compatíveis antes de receber a nova base.

No login, há bloqueio por inatividade após dez minutos. Minimizar não encerra o processo, mas o temporizador pede autenticação ao retornar. A sessão deve continuar somente na memória enquanto o processo existir; o bloqueio explícito e a autenticação na reabertura permanecem. Biometria Android pode utilizar `BiometricPrompt` e Android Keystore sem serviços ou dependências novas. Windows/navegador mantêm senha; não haverá botão de biometria ilustrativo.

## Plano incremental

1. **Navegação:** setores Criatório/Comercial, sidebar contextual no desktop, Hoje/Aves/Reprodução/Comercial/Mais no celular e + Novo contextual. Busca global por metadados locais e abertura direta; indicadores filtrados; contexto/filtros/rolagem em memória da sessão. Casais e parentesco continuam consultáveis. Checkpoint de build e testes antes de avançar.
2. **Trabalho com aves:** cadastro essencial com complementos, ficha compacta, ações diretas e pesagem rápida; gráfico apenas de valores reais; reprodução contínua com registros individuais preservados. Verificar persistência, vínculo de filhote único e usabilidade observada.
3. **Integração:** catálogo/formulário de parâmetros, tarefas derivadas configuráveis e idempotentes, compra vinculada a estoque/obrigação/pagamento e revisão de entrega/documentos. Migração, backup e bloqueio de clientes incompatíveis devem ter testes próprios.
4. **Acesso:** sessão mantida ao minimizar, login biométrico Android opcional protegido pelo Keystore, senha como alternativa, ausência de sessão persistida em claro. Autenticação real e teclado nativo exigem confirmação em aparelho físico.
5. **Entrega:** matriz de escopo, capturas antes/depois nos dois temas, testes existentes e novos, instruções de atualização/recuperação e artefatos locais de Android/Windows/navegador gerados pelos scripts atuais.

## Fora do escopo

Não adicionar calculadora genética/COI, QR, incubadoras, transferência de ovos, novos modelos independentes de fases das aves, multiusuário, integrações bancárias/fiscais, marketplace, rateios avançados ou mensagens automáticas. Recursos já existentes permanecem disponíveis.

## Progresso

- Auditoria e ponto de recuperação concluídos.
- Etapa 1 validada: build TypeScript/Vite, 30 testes unitários específicos e 9 fluxos de navegador em produção, sem falhas na rodada final. Busca no retorno e estado aberto dos filtros foram corrigidos. Etapas 2 e 3 em integração.
- Validação e matriz detalhada serão atualizadas com resultados observados, distinguindo simulação, build e teste físico.
