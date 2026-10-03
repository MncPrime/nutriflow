# Fluxo de contribuição e publicação

Este documento descreve o fluxo atual do NutriFlow. Há uma única branch de
produção (`main`); não existe deploy de staging ou de branches de trabalho.

## Branches e commits

Crie uma branch a partir da `main` atualizada para cada mudança:

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/importador-pdf
```

Use prefixos que expressem a intenção:

- `feat/`: funcionalidade, por exemplo `feat/importador-pdf`
- `fix/`: correção, por exemplo `fix/cache-offline`
- `docs/`: documentação, por exemplo `docs/fluxo-publicacao`
- `chore/`: manutenção, por exemplo `chore/ci-workflows`

Mudanças paralelas ficam em branches separadas, todas criadas a partir de `main`.
Não faça commits diretamente em `main` nem use uma branch de feature como branch
de publicação.

Escreva mensagens de commit no formato `tipo(escopo): resumo`, usando um resumo
curto que descreva a mudança:

```text
feat(importador): reconhece rotinas do PDF
fix(sw): atualiza cache da aplicação
docs(fluxo): explica como confirmar publicação
test(importador): cobre alternativas sem quantidade
```

Tipos usuais: `feat`, `fix`, `docs`, `test`, `refactor` e `chore`.

## Do PR ao site publicado

1. Rode localmente `npm test` e `npm run build`. `npm run dev` serve apenas uma
   prévia local em `http://127.0.0.1:5173`.
2. Envie a branch e abra um PR com destino a `main`.
3. Aguarde o job **Tests & Build** do workflow **Pull Request Checks**. Ele
   executa testes e build; falha em qualquer etapa deve impedir o merge.
4. Use um título de PR no formato `tipo(escopo): resumo` e **Squash and merge**
   para manter uma mensagem clara por mudança em `main`.
5. Depois da revisão e dos checks, faça merge do PR em `main`.
6. O push em `main` inicia **Deploy GitHub Pages**, o único workflow que publica
   o app em `https://mncprime.github.io/nutriflow/`.

Configure a proteção da branch `main` nas configurações do GitHub para exigir PR
e o job **Tests & Build** do workflow **Pull Request Checks**. O workflow não
consegue impedir sozinho um push direto à branch. Configure a regra em
**Settings → Rules → Rulesets**, direcionada à branch `main`.

O workflow de validação de versão/snapshot, quando acionado por alterações de
release em `main`, é uma verificação pós-merge separada; a aprovação do PR é
controlada pelo check **Pull Request Checks**.

## Confirmar qual código foi publicado

Em **GitHub → Actions → Deploy GitHub Pages**, abra a execução concluída mais
recente. O resumo **Commit publicado** mostra o SHA completo integrado em
`main`, além da versão e URL.

Na página aberta, consulte o SHA do HTML realmente carregado no console do
navegador:

```js
document.querySelector('meta[name="build-commit"]')?.content
```

Compare os 7 caracteres com o início do SHA no resumo do deploy. `local`
significa que a página é uma prévia local, não o site publicado.

## Se o navegador ainda mostrar a versão anterior

1. Verifique se o deploy mais recente terminou com sucesso e compare os SHAs.
2. Atualize a página. Uma aba que já estava aberta pode continuar com o JavaScript
   antigo até ser recarregada.
3. No app instalado, feche-o completamente e abra-o novamente enquanto estiver
   online.
4. Se o SHA continuar antigo, use as ferramentas do navegador para atualizar ou
   remover o service worker e recarregue o site online.

Não use **Clear site data / Limpar dados do site** como primeiro recurso: isso
pode apagar o plano alimentar e outros dados locais.

## Versões e snapshots

`VERSIONING.md` explica MAJOR/MINOR/PATCH, snapshots e rollback. Atualize `VERSION`,
`package.json` e `CHANGELOG.md` quando a mudança for uma nova versão de release;
commits de manutenção não devem ser confundidos com confirmação de deploy. O SHA
do commit é a identificação precisa do build publicado.
