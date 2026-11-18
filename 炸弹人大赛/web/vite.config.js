import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 炸弹人大赛前端：base 设为 /bomb-contest/
export default defineConfig({
  root: path.resolve('./web'),
  base: '/class-sim/bomb-contest/',
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve('./shared') },
  },
  server: { port: 5180 },
  build: {
    outDir: path.resolve('./dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4096,
  },
});



