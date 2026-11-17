import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 鐐稿脊浜哄ぇ璧涘墠绔細base 璁句负 /bomb-contest/锛岄儴缃插埌 GitHub Pages 鐨勫瓙璺緞
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



