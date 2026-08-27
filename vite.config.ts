import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { inlineCriticalCss } from './vite-plugin-inline-css.ts';

export default defineConfig({
  plugins: [react(), inlineCriticalCss()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    sourcemap: true,
    cssCodeSplit: false,
    minify: 'oxc',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react-router/') || id.includes('/node_modules/react-router-dom/')) return 'react-vendor';
          if (id.includes('/node_modules/lucide-react/')) return 'lucide';
          return undefined;
        },
      },
    },
  },
});
