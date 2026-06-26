import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('.', import.meta.url));
// PostCSS (Tailwind) config lives at the gallery package root, one level up.
const postcssDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  css: { postcss: postcssDir },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    // Dev: Vite serves the UI; the Express API runs on 3010.
    proxy: { '/api': 'http://localhost:3010' },
  },
});
