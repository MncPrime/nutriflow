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
- [ ] Feature branch merged to `develop` with `--no-ff`
- [ ] Develop branch merged to `main` with `--no-ff`
- [ ] Commit message format: "release: bump version to X.Y.Z"
- [ ] Tag will be auto-created: `git tag vX.Y.Z`

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

If this release causes issues in production:

```bash
# 1. Restore previous version
npm run rollback vX.Y.(Z-1)

# 2. Verify backup was applied
git log -1
git diff HEAD~1 dist/

# 3. Push to redeploy
git push origin main

# 4. GitHub Pages redeploy (automatic, ~1 min)
```

---

## Deployment

### GitHub Pages Auto-Deployment
- [ ] Trigger: GitHub Action on push to main with tag
- [ ] Build: `npm run build` → dist/
- [ ] Deploy: dist/ pushed to gh-pages branch
- [ ] CDN: Propagates in ~30 seconds
- [ ] Verification: Check https://mncprime.github.io/nutriflow/

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

### Rollback Decision
If issues arise within 1 hour of release:
1. Check severity (can be worked around? or breaks core feature?)
2. If critical: Execute rollback immediately
3. If minor: Create hotfix branch, merge to main as vX.Y.(Z+1)

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
