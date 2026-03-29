import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The MCP SDK imports 'eventsource' (a Node polyfill).
      // Redirect to browser-native EventSource.
      eventsource: path.resolve(__dirname, 'src/eventsource-polyfill.js'),
    },
  },
});
