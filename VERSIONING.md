# 🔄 Sistema de Versionamento - NutriFlow

## Visão Geral

Versionamento semântico para releases, com branches de trabalho integradas por
PR em `main`. O deploy do site é separado da prévia local e ocorre somente após
mudanças chegarem à branch de produção.

---

## 📋 Versioning Strategy

### Semantic Versioning (MAJOR.MINOR.PATCH)

- **MAJOR**: Mudanças quebra-compatibilidade (ex: novo modelo de dados)
- **MINOR**: Features novas, compatível com versões anteriores
- **PATCH**: Bugfixes críticos, sem features novas

Exemplo: `1.1.0` = v1 (inicial), v1.1 (meal insertion), v1.1.0 (patch 0)

**Versão Atual**: Leia em `VERSION` ou `package.json`

---

## 🌳 Branches, commits e publicação

```
main (produção)
  ↑ PR revisado e validado
feat/*, fix/*, docs/*, chore/* (trabalho e mudanças paralelas)
```

Crie uma branch por mudança a partir de `main`. Não faça commits diretamente em
`main`; branches de trabalho não têm deploy. Use nomes curtos como
`feat/importador-pdf` e `fix/cache-offline`.

Use mensagens no formato `tipo(escopo): resumo`, por exemplo:

```text
feat(importador): reconhece rotinas do PDF
fix(sw): atualiza cache da aplicação
docs(fluxo): explica como confirmar publicação
```

Envie a branch e abra um PR com destino `main`. Use título no formato
`tipo(escopo): resumo` e **Squash and merge** para manter uma mensagem clara por
mudança no histórico de `main`. Após os checks e a revisão, integre o PR em
`main`; esse push inicia a publicação do site. Não há branch `develop` nem site
de staging neste fluxo.

---

## 💾 Sistema de Snapshots

O snapshot é criado pelo workflow de validação de release quando os arquivos de
versão são atualizados em `main`. Ele contém:
- `dist/` (código compilado)
- `metadata.json` (versão, commit, timestamp, test results)
- Armazenado em `.backups/v1.0.0/`, `.backups/v1.1.0/`, etc.

### Criação manual para inspeção local

```bash
npm run build
npm run snapshot  # Cria .backups/v1.1.0/dist/ + metadata
```

---

## 🔙 Snapshots e reversão de produção

`npm run rollback` restaura um snapshot local em `dist/` e atualiza `VERSION`;
ele não restaura o código-fonte. Como o GitHub Pages recompila o código-fonte,
esse comando sozinho não reverte uma publicação.

```bash
# Listar snapshots locais disponíveis
npm run rollback --list

# Restaurar um artefato local para inspeção
npm run rollback v1.0.0
```

Para reverter código em produção, reverta o código-fonte em uma branch `fix/...`,
valide e abra um PR para `main`. O merge aciona o deploy normal.

---

## 📝 CHANGELOG

Mantém histórico de todas as versões:

```markdown
## v1.1.0 (Meal Insertion System)
- Feature: PDF text extraction (offline)
- Feature: Smart parser para formatos variados
- Feature: Autocomplete de alimentos
- Bugfix: showSuccess() not exported
- Tests: 3 refeições, 10 items verified

## v1.0.0 (Initial Release)
- Feature: Meal plan parsing e gerador de marmitas
- Feature: Shopping list with costs
- Feature: Dark mode + offline PWA
```

---

## 🔐 CI/CD Safeguards

### Workflows do GitHub Actions

- `pre-merge.yml` (`Pull Request Checks`): roda `npm test` e `npm run build`
  para PRs destinados a `main`. Configure `Tests & Build` como check obrigatório.
- `pages.yml` (`Deploy GitHub Pages`): publica somente em push para `main` e
  registra SHA, versão e URL em `Commit publicado` no resumo da execução.
- Configure a proteção de `main` no GitHub para exigir PR e o check
  `Tests & Build` (Settings → Rules → Rulesets). O workflow não substitui a
  regra de proteção.
- Para identificar a página aberta, compare os 7 caracteres da meta
  `document.querySelector('meta[name="build-commit"]')?.content` com o início
  do SHA no resumo do deploy. Uma prévia local mostra `local`.

---

## 📂 Estrutura de Arquivos

```
nutriflow/
├── VERSION                      # Versão atual (1.1.0)
├── package.json                 # version, homepage, repository
├── CHANGELOG.md                 # Histórico de releases
├── VERSIONING.md               # Este arquivo
├── .backups/                   # Snapshots de cada versão
│   ├── v1.0.0/
│   │   ├── dist/              # Build compilado
│   │   └── metadata.json       # Metadata do backup
│   └── v1.1.0/
│       ├── dist/
│       └── metadata.json
├── scripts/
│   ├── snapshot.mjs            # Cria backup após build
│   └── rollback.mjs            # Restaura versão anterior
├── .github/workflows/
│   ├── pre-merge.yml           # Testes e build em PR para main
│   ├── pre-release.yml         # Validações/snapshot de versão
│   └── pages.yml               # Deploy somente a partir de main
└── .github/
    └── RELEASE_TEMPLATE.md     # Template para releases
```

---

## 🚀 Exemplo de Fluxo Completo

### 1. Desenvolver uma mudança

```bash
git switch main
git pull origin main
git switch -c feat/dark-mode-fix
# ... código e commits ...
git push -u origin feat/dark-mode-fix
```

### 2. Criar Pull Request

Abra um PR de `feat/dark-mode-fix` para `main`. Aguarde `Pull Request Checks`
passar e faça merge pelo GitHub.

### 3. Confirmar publicação

```bash
# Verifique a execução Deploy GitHub Pages em Actions.
# O resumo informa o SHA publicado; compare-o com a meta build-commit no site.
```

Não use `npm run dev` como confirmação de publicação: ele serve somente uma
prévia local.

---

## 🔍 Inspeção de snapshots

```bash
# Listar snapshots disponíveis
npm run rollback --list

# Simular restauração local sem alterar arquivos
npm run rollback v1.0.0 --dry-run
```

---

## 📞 Troubleshooting

### "npm run rollback: command not found"
→ Instalar scripts em `scripts/rollback.mjs`

### "Backup not found for v1.0.0"
→ Verificar `.backups/` ou criar a partir de git tags

### "Service worker still serving old version"
→ Confirme o SHA publicado no Actions e compare com a meta `build-commit` da
página. Atualize ou remova o service worker e recarregue online, sem limpar os
dados do site, para preservar o plano salvo localmente.

---

## 📚 Referências

- [Semantic Versioning](https://semver.org/) - Guia oficial
- [Fluxo de contribuição](./WORKFLOW_GUIDE.md) - Branches, PRs e deploy
- [Changelog Convention](https://keepachangelog.com/) - Formato de CHANGELOG

---

## Autor & Feedback

Documento criado durante Fase 2 de versionamento. Atualizações necessárias após:
- Deploy da primeira versão
- Primeiro rollback em produção
- Feedback de usuários sobre processos
