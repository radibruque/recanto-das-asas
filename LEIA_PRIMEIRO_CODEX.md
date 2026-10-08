# Recanto das Asas para Android e Windows

Este pacote contém o código do painel web existente e o prompt completo para ampliá-lo em um sistema próprio. O objetivo é reaproveitar a base funcional e desenvolver os recursos descritos no prompt.

## Como começar

1. Extraia o ZIP em uma pasta de trabalho.
2. Disponibilize essa pasta ao Codex no ambiente de desenvolvimento.
3. Leia `PROMPT_DESENVOLVIMENTO.txt` e analise `painel-base/`.
4. Acrescente os arquivos aprovados da identidade visual quando disponíveis.
5. Desenvolva o aplicativo em uma cópia ou projeto separado. Preserve os arquivos da base para comparação e não altere a hospedagem atual.

## Conteúdo

- `PROMPT_DESENVOLVIMENTO.txt`: escopo completo com os dois painéis, relatórios, caderneta, anexos, backups, atualizações e validação.
- `painel-base/`: código-fonte exportado do painel existente, com os manifestos de dependências e arquivos de licença.
- `identidade-visual/LEIA-ME.txt`: instruções para acrescentar o pacote aprovado de artes. As artes não estão incluídas neste ZIP.

## Base disponível

A aplicação web usa React, TypeScript e Vinext, com Cloudflare Worker e D1. A tela principal está em `app/dashboard.tsx`, a API de gerenciamento em `app/api/manage/route.ts`, o modelo em `lib/model.ts` e o armazenamento em `db/`.

As funções existentes incluem aves, casais, posturas, ovos, eclosões, filhotes, parentesco básico e histórico de mutações. O README original detalha os fluxos verificados na versão web. Os novos recursos comerciais e documentais do prompt ainda precisam ser implementados.

## Adaptações necessárias

- Analise a lógica e os componentes antes de escolher a arquitetura para Android e Windows. Preserve os recursos úteis e adapte o que depende da hospedagem.
- O acesso privado do site é garantido pela plataforma de hospedagem. O código exportado, sozinho, não reproduz essa política. Implemente e valide o controle de acesso adequado ao aplicativo.
- O banco D1 é um serviço da implantação original. Defina o armazenamento para o aplicativo próprio conforme a decisão sobre uso local, online e sincronização.
- Os scripts originais incluem suporte ao ambiente Sites. Avalie dependências, disponibilidade e portabilidade antes de utilizá-los em outro computador.
- O pacote é código-fonte, não um instalador Android/Windows nem um backup do banco em produção.
- A demonstração fictícia está em `db/demo.ts`. Mantenha seu isolamento dos registros reais.
- Não publique, redeploye ou amplie o acesso do site existente para realizar esta adaptação.

## Procedência do código

O código foi exportado do commit `56c3516a73a9822654cbf154af44851a76be80b5` do projeto Recanto das Asas. Foram incluídos os arquivos versionados, exceto o cache gerado pelo TypeScript. A pasta Git, dependências instaladas, caches, banco local e arquivos temporários não fazem parte do pacote.

Mantenha os avisos e arquivos de licença das dependências. O identificador da implantação original é apenas metadado de contexto; não é uma autorização para alterar o site.
