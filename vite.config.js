import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wgslVitePlugin from '@vgpu/wgsl/loader-vite';

export default defineConfig({
  plugins: [react(), wgslVitePlugin()],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['chart.js', 'react-chartjs-2'],
          motion: ['motion/react'],
          icons: ['lucide-react'],
          vgpu: ['vgpu'],
        },
      },
    },
  },
});
