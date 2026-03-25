import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
  ],
  root: '.', // project root
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'hud.html',
    },
  },
  server: {
    open: '/hud.html',
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
