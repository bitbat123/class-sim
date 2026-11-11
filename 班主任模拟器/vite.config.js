import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages 子路径：https://bitbat123.github.io/class-sim/
  base: '/class-sim/',
  plugins: [react()],
  server: {
    watch: {
      // 忽略编辑工具产生的临时目录，避免 EBUSY 导致 dev server 退出
      ignored: ['**/*.tmpdir/**', '**/*.tmp'],
    },
  },
});
