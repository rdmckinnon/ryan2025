# Ryan McKinnon – Astromax Astro Build

  A one-page Astro site styled after the Astromax (https://github.com/michael-andreuzza/astromax) theme,
  customized for Ryan McKinnon’s photo journal and mixtape notes. It sits alongside the Hugo rebuild so you can
  compare approaches.

  ## Project Structure

  astro-astromax/
  ├── astro.config.mjs           # Astro + Tailwind + sitemap config
  ├── package.json               # npm scripts (dev/build/preview)
  ├── tsconfig.json              # path aliases (`@/…`) and TS settings
  ├── public/
  │   └── images/
  │       ├── gallery/           # full-resolution originals (keep)
  │       │   └── web/           # optimized web copies (generated via ImageMagick)
  │       └── shared/            # profile/home hero images
  └── src/
      ├── components/
      │   ├── BaseHead.astro     # global head tags + fonts + Keen slider CSS
      │   ├── global/
      │   │   ├── Navigation.astro
      │   │   └── Footer.astro
      │   └── landing/
      │       ├── Banner.astro          # scrolling ticker
      │       ├── Hero.astro            # hero headline over gradient grid
      │       ├── Work.astro            # Keen slider (gallery preview)
      │       ├── Intro.astro           # “Notes” block
      │       ├── Music.astro           # “Now Playing” section (pulls markdown posts)
      │       └── Cta.astro             # email call-to-action banner
      ├── content/
      │   ├── blog/                     # Markdown posts (drafted)
      │   └── config.ts                 # Astro collection schema
      ├── data/
      │   └── gallery.ts                # Photo list (slug, title, image path)
      ├── layouts/
      │   └── BaseLayout.astro
      ├── pages/
      │   ├── index.astro               # Assembles all the landing sections
      │   ├── gallery/index.astro       # Shuffled gallery grid (image + title)
      │   ├── about/index.astro         # Simplified about page
      │   └── blog/index.astro          # Hidden blog page (shows when drafts flipped)
      └── styles/
          └── global.css                # Tailwind v4 imports + theme overrides

  ## Editing Sections

  ### Hero

  - File: src/components/landing/Hero.astro
  - Headline, description, and “highlights” list are hard-coded in the component. Edit the <h1> text or add/remove
  entries from the highlightItems array.

  ### Scrolling Ticker

  - File: src/components/landing/Banner.astro
  - Edit the messages array to change topics ("florida sunrise", "gallery update", etc.). The ticker is duplicated
  for seamless scrolling. CSS for animation is in src/styles/global.css (.marquee-wrapper, .marquee-track,
  @keyframes marquee-scroll).

  ### Gallery Slider (“Recent frames on repeat”)

  - File: src/components/landing/Work.astro
  - Uses galleryItems from src/data/gallery.ts. Titles display on an overlay; the array is shuffled each build
  (const shuffled = [...galleryItems].sort(() => Math.random() - 0.5)).
  - If you want runtime shuffling (on every reload), replace the .sort with a client-side randomization, otherwise
  current setup randomizes on build.

  ### Gallery Grid (full page)

  - File: src/pages/gallery/index.astro
  - Also uses a shuffled copy of galleryItems. Each card shows only the image with a title band.

  ### “Notes” text block

  - File: src/components/landing/Intro.astro
  - Update the copy inside the two <p> blocks to match new messaging.

  ### “Now Playing” / Music section

  - File: src/components/landing/Music.astro
  - Pulls markdown posts from src/content/blog/ where tags include "music" and draft is false.
  - View shows up to three newest posts sorted by date.

  ### Call To Action

  - File: src/components/landing/Cta.astro
  - Currently a flat cyan banner linking to mailto:hi@ryanmckinnon.com. Change the text inside the <a> to adjust
  phrasing.

  ### Navigation links

  - File: src/components/global/Navigation.astro
  - navLinks array defines the anchor order: intro → frames → notes → music → contact. Add new sections by
  appending to this array and adding the corresponding id to the section.

  ### Footer

  - File: src/components/global/Footer.astro
  - Uses orderedSocialKeys from src/data/social.ts. Links default to email/Twitter/Instagram/LinkedIn/RSS. Update
  the map or add new networks in that data file.

  ## Managing Gallery Photos

  1. Drop originals into public/images/gallery/.
  2. Generate optimized copies in public/images/gallery/web/ using ImageMagick:

     cd /Users/ryanmckinnon/docker/ryan/astro-astromax/public/images/gallery
     magick mogrify \
       -path web \
       -resize 2000x2000\> \
       -quality 80 \
       -strip \
       *.jpg *.JPG *.jpeg
      - Keeps originals intact; resizes only files larger than 2000 px.
      - -strip removes EXIF; drop it if you want to preserve metadata.
  3. Update src/data/gallery.ts. Since Slugs/titles are auto-generated from filenames by the script above, each
  entry looks like:

     { slug: "favorites-07", title: "Favorites 07", image: "/images/gallery/web/Favorites - 7 of 16.jpeg" },

     Change title to something meaningful (e.g., “Jupiter Pier Sunrise”). If you don’t want to point to the web
  copy, keep image referencing the original.

  ## Music Blog Posts

  - Markdown files live in src/content/blog/.
  - Frontmatter schema (src/content/config.ts) expects:

    ---
    title: "Track Title"
    date: YYYY-MM-DD
    summary: "One-line description"
    tags: ["music"]
    draft: true
    ---
    Body text…

    [Listen on Spotify](https://open.spotify.com/…)
  - Keep draft: true to hide posts. Flip to false to surface them in the “Now Playing” section and the blog list.
  - Add the music tag to ensure they’re picked up for the music panel.

  ## Blog Page

  - src/pages/blog/index.astro filters posts where draft !== true.
  - Until you publish a post, the page shows the placeholder empty state.

  ## Optimizing & Naming Slugs

  - Running magick mogrify … automatically generates smaller files but doesn’t update gallery.ts. To regenerate
  the data file based on current filenames, run the Python helper in the README’s generate slugs section (already
  added). It rewrites gallery.ts with slugs/title derived from filenames. After running, fine-tune the titles
  manually.

  ## Development Commands

  cd /Users/ryanmckinnon/docker/ryan/astro-astromax
  npm install         # once
  npm run dev         # start dev server (http://localhost:4321)
  npm run build       # production build to dist/
  npm run preview     # serve built output locally

  ## Deploying to Cloudflare Pages (Free Tier)

  1. Push repo to GitHub/GitLab.
  2. On Cloudflare Dashboard → Pages → Create a project.
      - Connect your repository.
      - Build command: npm run build
      - Output directory: dist
      - Environment: set NODE_VERSION (optional) or adjust build settings as needed.
  3. Trigger first deploy. Pages runs npm install then npm run build, serving the dist/ output on every push.
  4. Optional: Environment Variables. Add ASTRO_SITE or any API keys under Settings → Environment Variables.
  5. Custom domain: After first deploy, add your domain or subdomain; Cloudflare handles DNS and HTTPS
  automatically.

  ### Monitoring Builds

  - The free plan includes 500 build minutes/month. Astro builds generally complete in under a minute; you can set
  budget by limiting push frequency.

  ### Preview Deploys

  - Enable preview deploys (default) to get a unique URL per branch—useful when comparing with the Hugo rebuild.

  ## Tips

  - Image loading: Since you’re using large photos, consider lazy-loading beyond the slider with <img
  loading="lazy"> (already used).
  - Video/SVG assets: Place inside public/ and reference via absolute path.
  - PiP for slider: If transitions stutter, reduce file size (ImageOptim) or adjust Keen slider’s animation
  duration.
