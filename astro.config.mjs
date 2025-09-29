import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },
  site: "https://ryanmckinnon.com",
  compressHTML: true,
  integrations: [sitemap()]
});
