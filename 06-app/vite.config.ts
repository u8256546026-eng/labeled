import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — приложение можно выложить в любую папку статического хостинга.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
});
