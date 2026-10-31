# Recanto das Asas 0.3.0 — com o novo design

Este pacote é o aplicativo completo (branch entrega/0.3.0) com o novo visual já integrado.
Nenhuma função, dado, sincronização, backup ou biometria foi alterada.

## O que mudou
- `aplicativo/src/design-asas.css` — novo visual (menu azul-marinho, animações sutis, cores da marca).
- `aplicativo/src/main.tsx` — uma linha a mais: `import './design-asas.css';`
- `aplicativo/public/fonts/Fraunces.ttf` e `OFL-Fraunces.txt` — fonte dos títulos (funciona sem internet) e sua licença.

Para voltar ao visual antigo, apague a linha `import './design-asas.css';` em `aplicativo/src/main.tsx`.

## Instaladores
A pasta `atualizacao-0.3.0` (instaladores antigos, sem o novo design) foi deixada de fora para o arquivo ficar leve.
Gere os novos instaladores de Android e Windows a partir da pasta `aplicativo`, pelo seu processo habitual
(`npm install` e depois os comandos de build descritos no README).
Instale por cima da versão atual, sem desinstalar, para manter seus dados.
