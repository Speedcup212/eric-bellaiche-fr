import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    sourcemap: true,
    cssCodeSplit: true,
    minify: 'oxc',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react-router/') || id.includes('/node_modules/react-router-dom/')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
