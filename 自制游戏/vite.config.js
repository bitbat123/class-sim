import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 自制游戏平台：发布在 https://bitbat123.github.io/class-sim/custom-games/
export default defineConfig({
  base: '/class-sim/custom-games/',
  plugins: [react()],
  server: { port: 5197 },
});
