import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { inlineCriticalCss } from './vite-plugin-inline-css';

export default defineConfig({
  plugins: [react(), inlineCriticalCss()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    sourcemap: true,
    cssCodeSplit: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'lucide': ['lucide-react'],
        },
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
});
