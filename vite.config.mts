import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// First Vite config file for this project (it previously ran on zero-config
// defaults). Only adds what the new React admin work needs — the existing
// Vue island / vanilla-JS public app are untouched and keep building exactly
// as before, since neither plugin here changes how non-React/non-Tailwind
// files are handled.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/admin/layout', import.meta.url)),
    },
  },
});
