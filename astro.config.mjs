// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://felipetp-ctrl.github.io',
  output: 'static',
  integrations: [sitemap()],
});
