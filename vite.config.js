import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/BOM-Allocation-Simulator/',
  test: {
    environment: 'node',
    globals: true,
  },
});
