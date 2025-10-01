# Listening Habits Setup Guide

This guide walks through setting up your listening habits tracking with Cloudflare D1 and Last.fm.

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://cloudflare.com)
2. **Last.fm Account** - Your username is already configured: `mcspinnin`
3. **Last.fm API Key** - Already in env: `76596c37c25f3d0d6e10890ee4b83322`

## Step 1: Install Dependencies

```bash
npm install -g wrangler
npm install tsx
```

## Step 2: Create Cloudflare D1 Database

```bash
# Login to Cloudflare
wrangler login

# Create the D1 database
wrangler d1 create listening-habits

# This will output your DATABASE_ID - save it!
# Example output:
# ✅ Successfully created DB 'listening-habits'
#
# [[d1_databases]]
# binding = "DB"
# database_name = "listening-habits"
# database_id = "abc123-def456-ghi789"
```

## Step 3: Update wrangler.toml

Open `wrangler.toml` and replace `YOUR_DATABASE_ID` with the actual database_id from Step 2:

```toml
[[d1_databases]]
binding = "DB"
database_name = "listening-habits"
database_id = "abc123-def456-ghi789"  # <-- Replace this
```

## Step 4: Initialize Database Schema

```bash
# Apply the schema to your D1 database
wrangler d1 execute listening-habits --file=./schema.sql
```

## Step 5: Set Environment Variables

Create a `.env` file in the project root:

```bash
# Cloudflare Credentials
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
D1_DATABASE_ID=your_database_id

# Last.fm (already configured)
LASTFM_API_KEY=76596c37c25f3d0d6e10890ee4b83322
```

### Getting Cloudflare Credentials

1. **Account ID**: Found in your Cloudflare dashboard URL: `dash.cloudflare.com/YOUR_ACCOUNT_ID`

2. **API Token**:
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template
   - Add D1 permissions: `D1:Edit`
   - Click "Continue to summary" → "Create Token"
   - Copy the token (you won't see it again!)

## Step 6: Import Your CSV Data

```bash
# Import your historical listening data
npx tsx scripts/import-csv.ts /path/to/your-listening-data.csv
```

### CSV Format

Your CSV should have these columns (column names are flexible):
- **Artist** or **artistname**
- **Track**, **song**, or **name**
- **Album** (optional)
- **Time**, **date**, or **played** (timestamp)

Example CSV:
```csv
artist,track,album,time
The Beatles,Here Comes The Sun,Abbey Road,2024-01-15T10:30:00Z
Fleetwood Mac,Dreams,Rumours,2024-01-15T10:35:00Z
```

## Step 7: Sync Recent Last.fm Data

After importing your CSV, sync new tracks from Last.fm:

```bash
# Fetch tracks newer than your CSV data
npx tsx scripts/sync-lastfm.ts
```

This will:
- ✅ Only fetch tracks newer than your CSV data (incremental sync)
- ✅ Automatically stop when it reaches tracks you already have
- ✅ Update your database with the latest listening history

## Step 8: Schedule Regular Syncs (Optional)

To keep your listening page up-to-date, schedule the sync script:

### Option A: GitHub Actions (Recommended for Cloudflare Pages)

Create `.github/workflows/sync-lastfm.yml`:

```yaml
name: Sync Last.fm Data

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Sync Last.fm
        env:
          D1_DATABASE_ID: ${{ secrets.D1_DATABASE_ID }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          npm install tsx
          npx tsx scripts/sync-lastfm.ts

      - name: Trigger Cloudflare Pages Rebuild
        run: |
          curl -X POST "${{ secrets.CLOUDFLARE_DEPLOY_HOOK }}"
```

Add these secrets to your GitHub repo:
- `D1_DATABASE_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_DEPLOY_HOOK` (from Cloudflare Pages settings)

### Option B: Local Cron

```bash
# Edit crontab
crontab -e

# Add this line to sync every 6 hours
0 */6 * * * cd /path/to/ryannew && npx tsx scripts/sync-lastfm.ts
```

## Step 9: Build & Deploy

Add environment variables to Cloudflare Pages:

1. Go to your Cloudflare Pages project
2. Settings → Environment variables
3. Add:
   - `D1_DATABASE_ID`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
   - `LASTFM_API_KEY`

Then deploy:

```bash
npm run build
# Cloudflare Pages will auto-deploy if connected to GitHub
```

## Viewing Your Stats

Visit: `https://yourdomain.com/listening`

Your listening page shows:
- 📊 All-time stats (total scrobbles, days listening, top artist)
- 📅 Last 30 days activity
- 🎵 Top 10 artists and tracks
- ⏱️ Recently played tracks

## Troubleshooting

### "No listening data yet"
- Make sure you've run the CSV import or Last.fm sync
- Check that environment variables are set correctly
- Verify D1 database was created and schema applied

### Sync script errors
- Confirm Cloudflare API token has D1 permissions
- Check that DATABASE_ID matches wrangler.toml
- Verify Last.fm API is working: `curl "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=mcspinnin&api_key=YOUR_KEY&format=json&limit=1"`

### Build-time data not showing
- Environment variables must be set in Cloudflare Pages
- The data fetches at build time, so trigger a rebuild after syncing new data

## Maintenance

### Check Sync Status
```bash
wrangler d1 execute listening-habits --command="SELECT * FROM sync_metadata"
```

### View Recent Scrobbles
```bash
wrangler d1 execute listening-habits --command="SELECT * FROM scrobbles ORDER BY played_at DESC LIMIT 10"
```

### Database Stats
```bash
wrangler d1 execute listening-habits --command="SELECT COUNT(*) as total_scrobbles FROM scrobbles"
wrangler d1 execute listening-habits --command="SELECT COUNT(DISTINCT artist_id) as unique_artists FROM scrobbles"
```

## Next Steps

- 🎨 Customize the listening page design in `src/pages/listening/index.astro`
- 📈 Add more visualizations (listening by hour, day of week, etc.)
- 🔄 Set up automated syncs with GitHub Actions
- 🎵 Share your music taste with the world!
