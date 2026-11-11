import { defineConfig } from 'vite';
import site from './site.config.js';

// Replaces {{key}} placeholders in index.html with values from site.config.js
const siteConfig = () => ({
  name: 'site-config',
  transformIndexHtml: (html) => html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in site ? site[k] : m)),
});

export default defineConfig({
  // GitHub Pages serves the site from /christianlawas/
  base: process.env.BASE_PATH ?? '/christianlawas/',
  plugins: [siteConfig()],
  server: { host: true, port: 5173 },
  build: { assetsInlineLimit: 0 },
});
