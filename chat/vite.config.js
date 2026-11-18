import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 独立的全屏聊天页：发布在 https://bitbat123.github.io/class-sim/chat/
export default defineConfig({
  base: '/class-sim/chat/',
  plugins: [react()],
  server: { port: 5190 },
});
