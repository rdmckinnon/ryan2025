# Ryan McKinnon – Personal Portfolio

A one-page Astro site showcasing dad life, golf, coastal photography, and music. Built with the [Astromax](https://github.com/michael-andreuzza/astromax) theme and customized for a modern, lifestyle-focused portfolio.

## Project Structure

```
astro-astromax/
├── astro.config.mjs           # Astro + Tailwind + sitemap config
├── package.json               # npm scripts (dev/build/preview)
├── tsconfig.json              # path aliases (@/) and TS settings
├── public/
│   └── images/
│       ├── gallery/           # full-resolution originals
│       │   └── web/           # optimized web copies (ImageMagick)
│       └── shared/            # profile/hero images
└── src/
    ├── components/
    │   ├── BaseHead.astro
    │   ├── global/
    │   │   ├── Navigation.astro
    │   │   └── Footer.astro
    │   └── landing/
    │       ├── Banner.astro          # scrolling ticker with Last.fm
    │       ├── Hero.astro            # hero headline
    │       ├── Work.astro            # Keen slider gallery preview
    │       ├── Intro.astro           # notes block
    │       ├── Music.astro           # now playing section
    │       └── Cta.astro             # email CTA
    ├── content/
    │   ├── blog/                     # markdown posts
    │   └── config.ts                 # collection schema
    ├── data/
    │   └── gallery.ts                # 287 photos with titles
    ├── utils/
    │   └── lastfm.ts                 # Last.fm API integration
    ├── layouts/
    │   └── BaseLayout.astro
    ├── pages/
    │   ├── index.astro               # landing page
    │   ├── gallery/index.astro       # randomized photo grid
    │   ├── about/index.astro
    │   └── blog/index.astro
    └── styles/
        └── global.css                # Tailwind v4 + custom animations
```

## Key Features

### 🎵 Last.fm Integration
- **File:** `src/utils/lastfm.ts` & `src/components/landing/Banner.astro`
- Fetches your 3 most recent tracks at build time
- Mixes music with static messages in the scrolling ticker
- Fallback messages if API fails
- Set `LASTFM_API_KEY` in `.env` or Cloudflare environment variables

### 📸 Gallery with Smart Titles
- **File:** `src/data/gallery.ts`
- 287 photos with descriptive titles (auto-generated slugs)
- Randomized order on each build
- Categories: golf, beach, sunset, aerial, desert, city
- View on slider (homepage) and full grid (`/gallery`)

### 🎨 Modern Design
- Dad/family/golf/ocean focused copy
- Scrolling ticker with Last.fm tracks
- Keen slider gallery preview
- Subtle CTA with hover effects
- Tailwind v4 styling

## Editing Sections

### Hero
**File:** `src/components/landing/Hero.astro`
- Edit the `<h1>` headline
- Modify `highlightItems` array for bullet points

### Scrolling Ticker (with Last.fm)
**File:** `src/components/landing/Banner.astro`
- Edit `staticMessages` array for custom messages
- Last.fm tracks automatically mixed in
- Animation speed: `global.css` (40s duration)

### Gallery Slider
**File:** `src/components/landing/Work.astro`
- Pulls from `src/data/gallery.ts`
- Shuffled on build: `[...galleryItems].sort(() => Math.random() - 0.5)`
- Displays 6 random photos with titles

### Notes Section
**File:** `src/components/landing/Intro.astro`
- Update the `<p>` block text

### Now Playing / Music
**File:** `src/components/landing/Music.astro`
- Pulls markdown from `src/content/blog/`
- Filters: `tags: ["music"]` and `draft: false`
- Shows 3 newest posts

### Call-to-Action
**File:** `src/components/landing/Cta.astro`
- Styled card with email link
- Background color: `#415a77`
- Edit heading, description, and button text

### Navigation
**File:** `src/components/global/Navigation.astro`
- Edit `navLinks` array for menu items

### Footer
**File:** `src/components/global/Footer.astro`
- Social links from `src/data/social.ts`

## Managing Gallery Photos

### 1. Add Original Photos
Drop high-res originals into `public/images/gallery/`

### 2. Optimize with ImageMagick
Generate web-optimized copies:
```bash
cd public/images/gallery
magick mogrify \
  -path web \
  -resize 2000x2000\> \
  -quality 80 \
  -strip \
  *.jpg *.JPG *.jpeg
```
- Keeps originals intact
- Only resizes files larger than 2000px
- `-strip` removes EXIF (remove flag to keep metadata)

### 3. Update Gallery Data
Add entries to `src/data/gallery.ts`:
```typescript
{ title: "Coastal Sunrise", image: "/images/gallery/web/photo.jpg" }
```
- **No slug needed** - auto-generated from title
- Use descriptive 2-4 word titles
- Examples: "Wave Patterns", "Fairway View", "Desert Vista"

## Music Blog Posts

Create markdown files in `src/content/blog/`:

```markdown
---
title: "Track Title"
date: 2025-01-15
summary: "One-line description"
tags: ["music"]
draft: false
---

Body text with thoughts on the track.

[Listen on Spotify](https://open.spotify.com/...)
```

- Set `draft: false` to show in "Now Playing" section
- Must include `tags: ["music"]` to appear

## Development Commands

```bash
npm install         # install dependencies
npm run dev         # dev server at localhost:4321
npm run build       # production build to dist/
npm run preview     # preview built output locally
```

## Deploying to Cloudflare Pages

1. **Push repo to GitHub**

2. **Create Cloudflare Pages project:**
   - Connect your repository
   - Build command: `npm run build`
   - Output directory: `dist`

3. **Environment Variables:**
   - Add `LASTFM_API_KEY` under Settings → Environment Variables

4. **Custom domain:**
   - Add your domain in Pages settings
   - Cloudflare handles DNS and HTTPS automatically

### Features
- ✅ 500 build minutes/month (free tier)
- ✅ Automatic deployments on push
- ✅ Preview URLs for branches
- ✅ Fast global CDN

## Tips

- **Images:** Already using `loading="lazy"` for performance
- **Slider performance:** If stuttering, reduce image file size
- **Last.fm updates:** Rebuild site to fetch latest tracks
- **Gallery randomization:** Happens at build time, not runtime