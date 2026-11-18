import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve('./web'),
  base: '/class-sim/racing/',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve('./shared'),
    },
  },
  server: { port: 5183 },
  build: { outDir: path.resolve('./dist'), emptyOutDir: true, chunkSizeWarningLimit: 4096 },
});