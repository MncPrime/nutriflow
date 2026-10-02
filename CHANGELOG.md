# Changelog

Todas as mudanças notáveis neste projeto estão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/),
e este projeto segue [Semantic Versioning](https://semver.org/).

---

## [1.1.0] - 2024 - Meal Insertion System & Versioning

### Added
- **PDF Extraction**: Sistema offline de extração de texto de PDF (PDF.js + CDN fallback)
- **Smart Parser**: Normalizador de formatos variados de plano alimentar
- **Meal Wizard**: Autocomplete de alimentos + validação de quantidades
- **Versioning System**: Git Flow + Semantic Versioning + Snapshot/Rollback
- `npm run snapshot`: Cria backup automático de builds
- `npm run rollback`: Restaura versão anterior em minutos
- `VERSIONING.md`: Guia completo de estratégia de versionamento
- `CHANGELOG.md`: Este arquivo

### Modified
- `package.json`: Adicionados version, homepage, repository, scripts snapshot/rollback
- `index.html`: Importações dos novos módulos + UI para PDF + food autocomplete
- `public/sw.js`: Preparado para injeção de VERSION (cache busting)

### Tech Details
- **pdf-extractor.js** (3.9 KB): Extração offline com window.pdfjsLib + cdnjs fallback
- **smart-parser.js** (6.4 KB): Normalização de formatos (PDF, digitação manual)
- **meal-wizard.js** (3.6 KB): Autocomplete + validação + formatação
- Build: 377.80 kB / 108.47 kB (gzip)

### Tests
- ✅ Text parsing: 3 refeições detectadas, 10 items
- ✅ Smart parser: 100% confidence em dados estruturados
- ✅ Meal wizard: UI funcional, todos campos testados
- ✅ Plan application: Dados persistidos em localStorage
- ⏳ PDF real: Pronto para teste com cliente
- ⏳ Mobile testing: Interface pronta para validação

### Breaking Changes
Nenhuma. Versão 1.0.0 totalmente compatível (off/moff zerados ao reparar).

### Known Issues
- Preços iniciais são estimativas em DEFP
- Detecção de categoria por palavra-chave pode errar em novos nomes (cai em "out")
- Sem testes automatizados de cálculo (validar com DEF antes de deploy)

---

## [1.0.0] - Initial Release

### Added
- Meal plan parsing com parser customizado
- Gerador de marmitas por dia (almoço/jantar)
- Alternância de opções por dia (outros lanches)
- Shopping list com agregação por item + embalagem
- Cálculo de custos por marmita
- Conversão peso cozido ↔ peso cru (fatores em CATS)
- Dark mode + Light mode (CSS variables)
- Offline PWA com service worker (rede primeiro, cache fallback)
- GitHub Pages deployment

### Features Core
- **Parser**: Inteligência para ler planos em texto (refeições, opções, alternativas)
- **Cooking Factors**: Proteína 0.75, Arroz 2.5, Feijão 2.8, Macarrão 2.2, Outros 1.0
- **Meal Planning**: Marmitas diárias para almoço/jantar, opções alternadas
- **Shopping List**: Agregação por nome + unidade (g ou unidades)
- **Cost Calculator**: Custo por item × quantidade + rateio por marmita

### Architecture
- Single-file HTML + CSS inline (index.html ~600 linhas)
- localStorage: chave `nf2`, objeto S (text, days, mode, budget, tab, theme, off, moff, prices)
- Service worker: Cache-first para offline, rede quando disponível
- Tailwind CSS para estilos (via Vite)

### Known Limitations
- Entrada manual de plano (sem PDF)
- Sem autocomplete de alimentos
- Sem histórico de versões
- Sem sistema de rollback

---

## Guia de Versioning

Ver [VERSIONING.md](/VERSIONING.md) para detalhes completos sobre:
- Semantic versioning strategy
- Git Flow branching
- Snapshot/Rollback process
- CI/CD safeguards

---

## Como Contribuir

1. Sempre criar branch de feature: `feature/sua-feature`
2. Fazer commits pequenos e descritivos
3. Ao completar, criar PR para `develop`
4. CI/CD testa automaticamente
5. Após aprovação, fazer merge com `--no-ff`
6. Release para main (tags v*.*.*)

Veja [VERSIONING.md](/VERSIONING.md#git-flow) para detalhes.

---

**Última atualização**: Fase 2 do Sistema de Versionamento
