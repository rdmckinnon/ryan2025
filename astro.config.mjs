import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from "@astrojs/sitemap";

import react from '@astrojs/react';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.D1_DATABASE_ID': JSON.stringify(process.env.D1_DATABASE_ID),
      'import.meta.env.CLOUDFLARE_ACCOUNT_ID': JSON.stringify(process.env.CLOUDFLARE_ACCOUNT_ID),
      'import.meta.env.CLOUDFLARE_API_TOKEN': JSON.stringify(process.env.CLOUDFLARE_API_TOKEN),
      'import.meta.env.LASTFM_API_KEY': JSON.stringify(process.env.LASTFM_API_KEY),
    }
  },
  site: "https://ryanmckinnon.com",
  compressHTML: true,
  integrations: [sitemap(), react()]
});