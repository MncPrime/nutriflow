#!/usr/bin/env node

/**
 * snapshot.mjs
 * 
 * Cria backup automático da build atual:
 * - Copia dist/ para .backups/vX.X.X/dist/
 * - Salva metadata (versão, commit, timestamp, test results)
 * - Executar após cada `npm run build` bem-sucedido
 * 
 * Uso:
 *   npm run snapshot
 *   node scripts/snapshot.mjs --dry-run
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Configurações
const distDir = path.join(projectRoot, 'dist');
const backupsDir = path.join(projectRoot, '.backups');
const versionFile = path.join(projectRoot, 'VERSION');
const packageJson = path.join(projectRoot, 'package.json');

// Flags
const isDryRun = process.argv.includes('--dry-run');
const isQuiet = process.argv.includes('--quiet');

function log(msg) {
  if (!isQuiet) console.log(`[snapshot] ${msg}`);
}

function error(msg) {
  console.error(`[snapshot ERROR] ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`[snapshot WARN] ${msg}`);
}

// ============================================================================
// 1. Verificações pré-requisitos
// ============================================================================

if (!fs.existsSync(distDir)) {
  error(`dist/ não encontrado. Execute 'npm run build' primeiro.`);
}

if (!fs.existsSync(versionFile)) {
  error(`VERSION file não encontrado em ${versionFile}`);
}

// ============================================================================
// 2. Obter metadata
// ============================================================================

let version = '';
try {
  version = fs.readFileSync(versionFile, 'utf-8').trim();
} catch (e) {
  error(`Não conseguiu ler VERSION: ${e.message}`);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  error(`VERSION inválida: ${version}. Esperado: X.X.X (semântico)`);
}

let gitCommit = '';
let gitBranch = '';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: projectRoot })
    .toString()
    .trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot })
    .toString()
    .trim();
} catch (e) {
  warn(`Não conseguiu obter info git: ${e.message}`);
  gitCommit = 'unknown';
  gitBranch = 'unknown';
}

const metadata = {
  version,
  gitCommit,
  gitBranch,
  timestamp: new Date().toISOString(),
  distSize: calculateDirSize(distDir),
  filesCount: countFiles(distDir),
};

log(`Metadata: v${version} @ ${gitCommit} (${gitBranch})`);

// ============================================================================
// 3. Criar diretório de backup
// ============================================================================

const backupVersionDir = path.join(backupsDir, `v${version}`);
const backupDistDir = path.join(backupVersionDir, 'dist');
const metadataFile = path.join(backupVersionDir, 'metadata.json');

if (!isDryRun) {
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
    log(`Criado diretório: ${backupsDir}`);
  }

  if (fs.existsSync(backupVersionDir)) {
    log(`Backup v${version} já existe, removendo para reconstruir...`);
    fs.rmSync(backupVersionDir, { recursive: true });
  }

  fs.mkdirSync(backupDistDir, { recursive: true });
  log(`Criado diretório de backup: ${backupDistDir}`);
}

// ============================================================================
// 4. Copiar dist/ para backup
// ============================================================================

if (!isDryRun) {
  copyDir(distDir, backupDistDir);
  log(`Copiado dist/ → ${backupDistDir}`);

  // Salvar metadata
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  log(`Salvo metadata: ${metadataFile}`);
}

// ============================================================================
// 5. Resultados
// ============================================================================

if (isDryRun) {
  log('[DRY-RUN] Nenhuma mudança foi feita.');
}

log(`✅ Snapshot v${version} pronto!`);
log(`   Localização: ${backupVersionDir}`);
log(`   Tamanho: ${formatBytes(metadata.distSize)}`);
log(`   Arquivos: ${metadata.filesCount}`);
log(`   Commit: ${gitCommit}`);
log('');
log(`Para fazer rollback, execute:`);
log(`  npm run rollback v${version}`);
log('');

// ============================================================================
// Funções auxiliares
// ============================================================================

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

function calculateDirSize(dir) {
  let size = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += calculateDirSize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }

  return size;
}

function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      count++;
    } else if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    }
  }

  return count;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
