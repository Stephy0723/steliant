import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: path.resolve(__dirname),
  base: '/app/',
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, '../api/public/app'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'dashboard.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'dashboard.css';
          }

          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
