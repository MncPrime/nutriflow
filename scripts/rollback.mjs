#!/usr/bin/env node

/**
 * rollback.mjs
 * 
 * Restaura um snapshot de build local:
 * - Lista versões disponíveis (--list)
 * - Restaura dist/ de um backup
 * - Faz commit automático com mensagem de rollback
 * - Não restaura código-fonte nem publica no GitHub Pages
 * 
 * Uso:
 *   npm run rollback --list           # Lista versões
 *   npm run rollback v1.0.0           # Restaura v1.0.0
 *   npm run rollback v1.0.0 --dry-run # Simula rollback
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Configurações
const backupsDir = path.join(projectRoot, '.backups');
const distDir = path.join(projectRoot, 'dist');
const versionFile = path.join(projectRoot, 'VERSION');

// Flags
const command = process.argv[2];
const isDryRun = process.argv.includes('--dry-run');
const isQuiet = process.argv.includes('--quiet');
const autoCommit = !process.argv.includes('--no-commit');

function log(msg) {
  if (!isQuiet) console.log(`[rollback] ${msg}`);
}

function error(msg) {
  console.error(`[rollback ERROR] ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`[rollback WARN] ${msg}`);
}

// ============================================================================
// COMANDO: --list (Listar versões)
// ============================================================================

if (command === '--list' || command === '-l' || !command) {
  listVersions();
  process.exit(0);
}

// ============================================================================
// COMANDO: rollback vX.X.X
// ============================================================================

const targetVersion = command;

if (!/^v\d+\.\d+\.\d+$/.test(targetVersion)) {
  error(`Versão inválida: ${targetVersion}. Use: npm run rollback --list`);
}

log(`Iniciando rollback para ${targetVersion}...`);

// Verificar se backup existe
const backupVersionDir = path.join(backupsDir, targetVersion);
const backupDistDir = path.join(backupVersionDir, 'dist');
const metadataFile = path.join(backupVersionDir, 'metadata.json');

if (!fs.existsSync(backupVersionDir)) {
  error(`Backup ${targetVersion} não encontrado em ${backupVersionDir}`);
}

if (!fs.existsSync(backupDistDir)) {
  error(`Pasta dist não encontrada no backup: ${backupDistDir}`);
}

// Ler metadata
let metadata = {};
if (fs.existsSync(metadataFile)) {
  try {
    const content = fs.readFileSync(metadataFile, 'utf-8');
    metadata = JSON.parse(content);
  } catch (e) {
    warn(`Não conseguiu ler metadata: ${e.message}`);
  }
}

log(`Versão: ${metadata.version || targetVersion}`);
log(`Commit: ${metadata.gitCommit || 'unknown'}`);
log(`Timestamp: ${metadata.timestamp || 'unknown'}`);

if (isDryRun) {
  log('[DRY-RUN] Simulando rollback...');
}

// ============================================================================
// 1. Fazer backup de dist/ atual (antes de restaurar)
// ============================================================================

if (!isDryRun) {
  const tmpBackupDir = path.join(projectRoot, '.rollback-tmp');
  if (fs.existsSync(tmpBackupDir)) {
    fs.rmSync(tmpBackupDir, { recursive: true });
  }

  if (fs.existsSync(distDir)) {
    fs.mkdirSync(tmpBackupDir, { recursive: true });
    copyDir(distDir, tmpBackupDir);
    log(`Backup temporário criado: ${tmpBackupDir}`);
  }
}

// ============================================================================
// 2. Restaurar dist/ do backup
// ============================================================================

if (!isDryRun) {
  // Remover dist/ atual
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }

  // Copiar backup para dist/
  fs.mkdirSync(distDir, { recursive: true });
  copyDir(backupDistDir, distDir);
  log(`✅ dist/ restaurado de ${backupVersionDir}`);
}

// ============================================================================
// 3. Atualizar VERSION file
// ============================================================================

const versionFromBackup = targetVersion.replace(/^v/, '');

if (!isDryRun) {
  fs.writeFileSync(versionFile, versionFromBackup + '\n');
  log(`✅ VERSION atualizado para ${versionFromBackup}`);
}

// ============================================================================
// 4. Fazer git commit (se autoCommit=true)
// ============================================================================

if (!isDryRun && autoCommit) {
  try {
    execSync(`git add dist/ VERSION`, { cwd: projectRoot, stdio: 'inherit' });
    const commitMsg = `fix(rollback): restaura ${targetVersion}\n\nRestored from backup snapshot.`;
    execSync(`git commit -m "${commitMsg}"`, { cwd: projectRoot, stdio: 'inherit' });
    log(`✅ Commit criado`);
  } catch (e) {
    warn(`Não conseguiu fazer commit: ${e.message}`);
    log(`Faça manualmente:`);
    log(`  git add dist/ VERSION`);
    log(`  git commit -m "rollback: restore ${targetVersion}"`);
  }
}

// ============================================================================
// 5. Próximos passos
// ============================================================================

log('');
if (isDryRun) {
  log('[DRY-RUN] Nenhuma mudança foi feita.');
} else {
  log('✅ Rollback concluído!');
}

log('');
log('Próximos passos:');
log(`  git log -1                   # Verificar commit`);
log(`  git push origin main          # Deploy em ~1 min`);
log('');
log('Se algo der errado:');
log(`  npm run rollback --list       # Ver versões disponíveis`);
log(`  npm run rollback vX.X.X       # Restaurar outra versão`);
log('');

// ============================================================================
// Funções auxiliares
// ============================================================================

function listVersions() {
  if (!fs.existsSync(backupsDir)) {
    log('Nenhum backup encontrado. Execute: npm run build && npm run snapshot');
    return;
  }

  const versions = fs.readdirSync(backupsDir)
    .filter(f => /^v\d+\.\d+\.\d+$/.test(f))
    .sort()
    .reverse();

  if (versions.length === 0) {
    log('Nenhum backup encontrado.');
    return;
  }

  log('Versões disponíveis para rollback:');
  log('');

  for (const version of versions) {
    const metaPath = path.join(backupsDir, version, 'metadata.json');
    let meta = {};

    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch (e) {
        // Ignorar erro
      }
    }

    const timestamp = meta.timestamp
      ? new Date(meta.timestamp).toLocaleString('pt-BR')
      : 'unknown';
    const commit = meta.gitCommit || 'unknown';
    const size = meta.distSize ? formatBytes(meta.distSize) : 'unknown';

    console.log(`  ${version}`);
    console.log(`    Timestamp: ${timestamp}`);
    console.log(`    Commit:    ${commit}`);
    console.log(`    Size:      ${size}`);
    console.log('');
  }

  log('Para restaurar:');
  log('  npm run rollback vX.X.X');
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
