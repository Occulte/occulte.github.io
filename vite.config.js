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
    writeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      passthroughDirs.forEach(dir => {
        const srcDir = path.resolve(__dirname, dir);
        const destDir = path.join(distDir, dir);
        if (!fs.existsSync(srcDir)) return;
        fs.rmSync(destDir, { recursive: true, force: true });
        fs.cpSync(srcDir, destDir, { recursive: true });
      });
    }
  };
}

export default defineConfig({
  root: 'src',
  base: '/',
  plugins: [react(), staticContentPlugin()],
  server: {
    port: 3000,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
