import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages sub-path: https://<user>.github.io/sareena/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/sareena/' : '/',
  server: {
    port: 5173,
    open: true,
  },
}));
