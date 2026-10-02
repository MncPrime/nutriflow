# 🔄 Sistema de Versionamento - NutriFlow

## Visão Geral

Sistema de versionamento semântico com Git Flow e rollback automático para regredir mudanças em produção de forma segura e rápida.

---

## 📋 Versioning Strategy

### Semantic Versioning (MAJOR.MINOR.PATCH)

- **MAJOR**: Mudanças quebra-compatibilidade (ex: novo modelo de dados)
- **MINOR**: Features novas, compatível com versões anteriores
- **PATCH**: Bugfixes críticos, sem features novas

Exemplo: `1.1.0` = v1 (inicial), v1.1 (meal insertion), v1.1.0 (patch 0)

**Versão Atual**: Leia em `VERSION` ou `package.json`

---

## 🌳 Git Flow

```
main (produção, tags v*.*.*)
  ↑ (merge com --no-ff)
develop (staging, build diário)
  ↑ (merge com --no-ff)
feature/* (branches de feature)
hotfix/* (branches de correção crítica direto de main)
```

### Regra de Merge

```bash
# Feature → develop
git checkout develop
git merge --no-ff feature/pdf-extraction
git push origin develop

# develop → main (release)
git checkout main
git merge --no-ff develop
git tag v1.1.0
git push origin main --tags
```

---

## 💾 Sistema de Snapshots

Cada build automático cria um **backup** com:
- `dist/` (código compilado)
- `metadata.json` (versão, commit, timestamp, test results)
- Armazenado em `.backups/v1.0.0/`, `.backups/v1.1.0/`, etc.

### Automatização

```bash
# Após cada build bem-sucedido:
npm run build
npm run snapshot  # Cria .backups/v1.1.0/dist/ + metadata
```

---

## 🔙 Rollback (Restauração Rápida)

Se algo quebrar em produção:

```bash
# 1. Listar versões disponíveis
npm run rollback --list

# 2. Restaurar versão anterior
npm run rollback v1.0.0

# 3. Verificar mudanças (git diff)
git status

# 4. Fazer commit e push
git commit -m "rollback: restore v1.0.0"
git push origin main

# 5. GitHub Pages redeploy (~1 min)
```

**Tempo total**: ~2-3 minutos vs. ~30 min para debug + fix + test + deploy

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

### Pre-Merge (develop ← feature)
- ✅ Rodar testes (`npm test`)
- ✅ Build sem erros (`npm run build`)
- ✅ Verificar linting

### Pre-Release (main ← develop)
- ✅ Todos testes passando
- ✅ CHANGELOG atualizado
- ✅ VERSION atualizado
- ✅ Snapshot validado
- ✅ Rollback testado

### Workflow Automático
Duas GitHub Actions:

1. **pre-merge.yml**: Roda on pull_request
   - Testa, linta, constrói PR
   - Comenta resultado no PR
   
2. **pre-release.yml**: Roda on push to main
   - Valida integridade
   - Cria snapshot
   - Dispara deploy automático

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
│   ├── pre-merge.yml           # Testes em PR
│   ├── pre-release.yml         # Validação antes de deploy
│   └── deploy.yml              # Deploy automático
└── .github/
    └── RELEASE_TEMPLATE.md     # Template para releases
```

---

## 🚀 Exemplo de Fluxo Completo

### 1. Desenvolver Feature

```bash
git checkout develop
git checkout -b feature/dark-mode-fix
# ... código, commits ...
git push origin feature/dark-mode-fix
```

### 2. Criar Pull Request

- PR: `develop` ← `feature/dark-mode-fix`
- GitHub Action `pre-merge.yml` roda testes
- Revisor aprova
- Merge com `--no-ff`

### 3. Release em Staging

```bash
git checkout develop
git pull origin develop
# Verificar builds e testes
git push origin develop  # Staging build automático
```

### 4. Release em Produção

```bash
git checkout main
git merge --no-ff develop
npm run build
npm run snapshot  # Cria backup (v1.1.1)
git tag v1.1.1
git push origin main --tags
# GitHub Action dispara deploy
```

### 5. Se Algo Quebrar

```bash
npm run rollback v1.1.0
# Restaura dist/ e git commit
git push origin main
# Redeploy automático em ~1 min
```

---

## 🔍 Verificação de Rollback

Testar regularmente (quinzenal):

```bash
# 1. Simular rollback
npm run rollback v1.0.0 --dry-run

# 2. Verificar integridade
cat dist/index.html | wc -l  # Comparar com backup original

# 3. Restaurar versão atual
npm run rollback v1.1.0
```

---

## 📞 Troubleshooting

### "npm run rollback: command not found"
→ Instalar scripts em `scripts/rollback.mjs`

### "Backup not found for v1.0.0"
→ Verificar `.backups/` ou criar a partir de git tags

### "Service worker still serving old version"
→ VERSION constante em `public/sw.js` deve mudar a cada build

---

## 📚 Referências

- [Semantic Versioning](https://semver.org/) - Guia oficial
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) - Modelo de branching
- [Changelog Convention](https://keepachangelog.com/) - Formato de CHANGELOG

---

## Autor & Feedback

Documento criado durante Fase 2 de versionamento. Atualizações necessárias após:
- Deploy da primeira versão
- Primeiro rollback em produção
- Feedback de usuários sobre processos
