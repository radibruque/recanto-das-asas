# Capturas e evidências — 0.3.0

Antes: aplicativo 0.2.3, commit `72cbd1b`. Depois: aplicativo 0.3.0, build `index-CmGD_SQM.js` / `index-Cv0drBPW.css`. Os contextos e dados são fictícios, isolados da produção; nenhuma pesquisa ou registro foi enviado a serviço externo.

As capturas do desktop usam o navegador, e as do Android simulam a ponte de plataforma em Chromium. Não são fotografias de aparelhos físicos. Capturas de página inteira podem mostrar a barra fixa na posição do primeiro quadro visível; no uso ela acompanha a janela durante a rolagem.

| Plataforma | Tema | Tela | Antes | Depois |
| --- | --- | --- | --- | --- |
| Desktop no navegador (1440 px) | Claro | Hoje | [Antes](antes/desktop-web-light-hoje.png) | [Depois](depois/desktop-web-light-hoje.png) |
| Desktop no navegador (1440 px) | Claro | Aves | [Antes](antes/desktop-web-light-aves.png) | [Depois](depois/desktop-web-light-aves.png) |
| Desktop no navegador (1440 px) | Claro | Ficha | [Antes](antes/desktop-web-light-ficha.png) | [Depois](depois/desktop-web-light-ficha.png) |
| Desktop no navegador (1440 px) | Claro | Financeiro | [Antes](antes/desktop-web-light-financeiro.png) | [Depois](depois/desktop-web-light-financeiro.png) |
| Desktop no navegador (1440 px) | Escuro | Hoje | [Antes](antes/desktop-web-dark-hoje.png) | [Depois](depois/desktop-web-dark-hoje.png) |
| Desktop no navegador (1440 px) | Escuro | Aves | [Antes](antes/desktop-web-dark-aves.png) | [Depois](depois/desktop-web-dark-aves.png) |
| Desktop no navegador (1440 px) | Escuro | Ficha | [Antes](antes/desktop-web-dark-ficha.png) | [Depois](depois/desktop-web-dark-ficha.png) |
| Desktop no navegador (1440 px) | Escuro | Financeiro | [Antes](antes/desktop-web-dark-financeiro.png) | [Depois](depois/desktop-web-dark-financeiro.png) |
| Android simulado (390 px) | Claro | Hoje | [Antes](antes/android-simulated-light-hoje.png) | [Depois](depois/android-simulated-light-hoje.png) |
| Android simulado (390 px) | Claro | Aves | [Antes](antes/android-simulated-light-aves.png) | [Depois](depois/android-simulated-light-aves.png) |
| Android simulado (390 px) | Claro | Ficha | [Antes](antes/android-simulated-light-ficha.png) | [Depois](depois/android-simulated-light-ficha.png) |
| Android simulado (390 px) | Claro | Financeiro | [Antes](antes/android-simulated-light-financeiro.png) | [Depois](depois/android-simulated-light-financeiro.png) |
| Android simulado (390 px) | Escuro | Hoje | [Antes](antes/android-simulated-dark-hoje.png) | [Depois](depois/android-simulated-dark-hoje.png) |
| Android simulado (390 px) | Escuro | Aves | [Antes](antes/android-simulated-dark-aves.png) | [Depois](depois/android-simulated-dark-aves.png) |
| Android simulado (390 px) | Escuro | Ficha | [Antes](antes/android-simulated-dark-ficha.png) | [Depois](depois/android-simulated-dark-ficha.png) |
| Android simulado (390 px) | Escuro | Financeiro | [Antes](antes/android-simulated-dark-financeiro.png) | [Depois](depois/android-simulated-dark-financeiro.png) |

## Resultado final

- **408 testes unitários aprovados**, nenhuma falha/omissão: [relatório](evidencias/unitarios-final.json).
- **92 cenários Playwright aprovados em produção**, nenhuma falha, omissão ou instabilidade na rodada final: [relatório](evidencias/playwright-final.json). Inclui os 20 módulos, temas, larguras de 360 a 1440 px, teclado/foco, texto com contraste AA nas superfícies verificadas, cadastro/anexos, pesagem, reprodução, derivação de tarefas, comercial, backup, recuperação e offline.
- A meta de pesagem foi observada: **um clique/toque de navegação da ficha ao formulário**, em 390 e 1440 px, nos dois temas. A unidade e a ave já vêm definidas; os valores registrados alimentam a mesma saúde geral/individual.
- Build TypeScript/Vite aprovado. O aviso de importação dinâmica de exports coexistindo com importação estática permanece: esse módulo não é separado por esse import. Não foram adicionadas dependências.
- APK, EXE e servidor ZIP gerados e verificados localmente; os dois aplicativos contêm os **94 arquivos exatos** do build web: [artefatos](evidencias/artefatos-nativos.json).
- Android mantém identidade/certificado e código 3000 superior ao 2004 anterior. Lint sem Error/Fatal ativos; 33 avisos e 5 sugestões. A baseline já existente do Capacitor filtra 6 erros da dependência e não foi modificada.
- Windows: NSIS 0.3.0, PE/CRC e payload comprimido verificados; origem e perfil de dados preservados. EXE de avaliação sem assinatura Authenticode.
- Servidor: programa, scripts, manifesto e Node oficial conferidos; 29 checks PowerShell em Linux aprovados. Credenciais e dados privados não são incluídos no pacote.
- **32 capturas** (16 antes e 16 depois), nenhum erro de página ou rolagem horizontal nas capturas posteriores. Os manifestos registram dimensões, hashes e a natureza simulada das plataformas.

A primeira rodada completa localizou três verificações de teste que precisavam acompanhar a apresentação atual: o texto de uma opção legítima do editor não deve contar como grupo do acervo; miniaturas são preparadas quando a linha entra no campo de visão. Os seletores foram corrigidos mantendo as verificações de metadados, vínculos e bytes; a nova rodada completa passou. A aplicação não foi alterada para contornar essas verificações.

Biometria/sensor/Keystore, teclado e políticas de energia Android, atualização sobre instalações físicas, DPAPI e início automático Windows e conexão real Tailscale/4G permanecem no [roteiro manual](../ATUALIZACAO_0.3.0.md). A aprovação automática não comprova esses passos e não garante ausência universal de bugs.
