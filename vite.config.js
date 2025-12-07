import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function staticContentPlugin() {
  const passthroughDirs = ['content', 'assets'];
  const mime = {
    '.md': 'text/markdown; charset=utf-8',
    '.bib': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4'
  };

  const sendFile = (dirRoot, req, res, next) => {
    const rel = decodeURIComponent((req.url || '').replace(/^\/+/, ''));
    const target = path.join(dirRoot, rel);
    if (!target.startsWith(dirRoot)) return next();
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      const ext = path.extname(target).toLowerCase();
      const type = mime[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      fs.createReadStream(target).pipe(res);
      return;
    }
    next();
  };

  return {
    name: 'static-content',
    configureServer(server) {
      passthroughDirs.forEach(dir => {
        const dirRoot = path.resolve(__dirname, dir);
        server.middlewares.use(`/${dir}`, (req, res, next) => sendFile(dirRoot, req, res, next));
      });
    },
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      passthroughDirs.forEach(dir => {
        const srcDir = path.resolve(__dirname, dir);
        if (!fs.existsSync(srcDir)) return;
        
        if (dir === 'assets') {
          // 对于 assets 目录，只复制源文件，不删除 Vite 生成的文件
          const destDir = path.join(distDir, dir);
          fs.cpSync(srcDir, destDir, { recursive: true });
        } else {
          // 对于其他目录（如 content），完全替换
          const destDir = path.join(distDir, dir);
          fs.rmSync(destDir, { recursive: true, force: true });
          fs.cpSync(srcDir, destDir, { recursive: true });
        }
      });
    }
  };
}

export default defineConfig({
  root: 'src',
  base: '/',
  plugins: [
    react(), 
    staticContentPlugin(),
    // Copy index.html to 404.html for GitHub Pages SPA support
    {
      name: 'copy-404',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist');
        const indexPath = path.join(distDir, 'index.html');
        const notFoundPath = path.join(distDir, '404.html');
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, notFoundPath);
        }
      }
    }
  ],
  server: {
    port: 3000,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
