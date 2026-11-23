import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 全能地铁线路设计器：发布在 https://bitbat123.github.io/class-sim/metro/
export default defineConfig({
  base: '/class-sim/metro/',
  plugins: [react()],
  server: { port: 5186 },
});
