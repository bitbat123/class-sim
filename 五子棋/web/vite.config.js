import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve('./web'),
  base: '/class-sim/gomoku/',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve('./shared'),
    },
  },
  server: { port: 5182 },
  build: { outDir: path.resolve('./dist'), emptyOutDir: true, chunkSizeWarningLimit: 4096 },
});