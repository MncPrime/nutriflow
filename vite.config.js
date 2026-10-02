import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];

// Ler VERSION para injetar no service worker
function getVersion() {
  try {
    const versionFile = path.join(process.cwd(), 'VERSION');
    return fs.readFileSync(versionFile, 'utf-8').trim();
  } catch (e) {
    return '1.0.0';
  }
}

// Plugin para injetar VERSION no service worker
function injectVersionPlugin() {
  let config;
  
  return {
    name: 'inject-version',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    transformIndexHtml(html) {
      const version = getVersion();
      // Injeta version como meta tag para acesso em JS
      return html.replace(
        '</head>',
        `  <meta name="version" content="${version}">\n</head>`
      );
    },
    resolveId(id) {
      if (id === 'virtual-version') {
        return id;
      }
    },
    load(id) {
      if (id === 'virtual-version') {
        const version = getVersion();
        return `export const APP_VERSION = '${version}'`;
      }
    },
    // Post-build hook para atualizar service worker
    async writeBundle() {
      if (config.command === 'build') {
        const version = getVersion();
        const swPath = path.join(config.build.outDir, 'sw.js');
        
        if (fs.existsSync(swPath)) {
          let swContent = fs.readFileSync(swPath, 'utf-8');
          // Atualizar versão no service worker (ex: nutriflow-v12 → nutriflow-1.1.0)
          swContent = swContent.replace(
            /const V = 'nutriflow-v[\d]+'/,
            `const V = 'nutriflow-${version}'`
          );
          fs.writeFileSync(swPath, swContent);
        }
      }
    }
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : '/',
  plugins: [
    tailwindcss(),
    injectVersionPlugin()
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
});
