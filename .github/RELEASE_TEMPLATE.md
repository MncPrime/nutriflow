# Release Checklist: v X.Y.Z

<!-- 
This template is used when creating a new GitHub release.
Copy this checklist and fill in the version and details.
-->

## Pre-Release Validation

Before creating this release, verify all items below:

### Code & Testing
- [ ] All tests passing (`npm test`)
- [ ] Build successful (`npm run build` - no errors)
- [ ] No console.log() debug statements left
- [ ] Mobile responsive (tested on actual device)
- [ ] Dark mode working correctly
- [ ] Offline functionality verified (PWA)

### Documentation
- [ ] CHANGELOG.md updated with v X.Y.Z entry
- [ ] VERSION file updated to X.Y.Z
- [ ] package.json version matches VERSION file
- [ ] Commit messages are descriptive
- [ ] No security issues in dependencies

### Backup & Rollback
- [ ] Snapshot created: `npm run snapshot`
- [ ] Snapshot verified: `.backups/vX.Y.Z/` exists with metadata.json
- [ ] Rollback tested (dry-run): `npm run rollback vX.Y.Z --dry-run`
- [ ] Previous version snapshot available (fallback)

### Git & Versioning
- [ ] Release changes are in a branch created from the current `main`
- [ ] Pull request targets `main`; `Pull Request Checks` passed
- [ ] Commit messages use `tipo(escopo): resumo`
- [ ] No direct push to `main`

### Production Safety
- [ ] Service worker version updated (injected at build time)
- [ ] GitHub Pages deployment configured to use GitHub Actions
- [ ] Pre-release validation workflow passed (check CI/CD logs)
- [ ] Cache busting verified in dist/sw.js

---

## Release Details

**Version**: vX.Y.Z  
**Branch**: main  
**Type**: [Major / Minor / Patch]

### Semantic Versioning Guide
- **Major** (X.0.0): Breaking changes (ex: new data model)
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bugfixes, no features

### Features Included
- Feature 1: Brief description
- Feature 2: Brief description
- Bugfix 1: What was fixed

### Breaking Changes
- List any backward-incompatible changes, if any

### Known Issues
- Any remaining known issues for this release

---

## Rollback Instructions

If this release causes issues in production, revert the source changes in a
`fix/...` branch, validate them, and open a PR to `main`. The `npm run rollback`
script only restores a local `dist/` snapshot; it does not restore source code
used by the Pages build.

---

## Deployment

### GitHub Pages Auto-Deployment
- [ ] Trigger: `Deploy GitHub Pages` on push to `main`
- [ ] Build: `npm run build` → dist/
- [ ] Deploy: GitHub Pages deployment environment
- [ ] Verification: deployment succeeded and its summary shows the expected SHA
- [ ] Browser meta `build-commit` matches the deployed SHA

### Cache Invalidation
- Service worker cache name: `nutriflow-X.Y.Z`
- Old caches: Cleaned up automatically
- Clients: Updated on next app open or forced refresh

---

## Post-Release

- [ ] Monitor GitHub Pages deployment (1-2 minutes)
- [ ] Test in production (https://mncprime.github.io/nutriflow/)
- [ ] Verify service worker activated (DevTools → Application → Service Workers)
- [ ] Check browser console for errors
- [ ] Monitor GitHub Issues for user reports

### Recovery Decision
If issues arise within 1 hour of release:
1. Check severity (can be worked around? or breaks core feature?)
2. If critical: revert source changes through a `fix/...` PR to `main`
3. If minor: create a `fix/...` branch and open a PR to `main`

---

## Communication

- [ ] Update GitHub release notes with CHANGELOG excerpt
- [ ] Notify users (if applicable - Twitter, Slack, etc.)
- [ ] Document lessons learned if anything went wrong

---

## Sign-Off

**Released By**: @username  
**Released At**: YYYY-MM-DD HH:MM:SS UTC  
**Deployment Status**: [ ] Success [ ] Rolled back

---

## Appendix: Quick Commands

```bash
# View available versions for rollback
npm run rollback --list

# Simulate rollback without making changes
npm run rollback vX.Y.Z --dry-run

# Verify service worker version
grep "const V = " dist/sw.js

# Check backup metadata
cat .backups/vX.Y.Z/metadata.json | jq .
```

---

**Template Version**: 1.0  
**Last Updated**: 2024  
**GitHub Repository**: [nutriflow](https://github.com/MncPrime/nutriflow)
