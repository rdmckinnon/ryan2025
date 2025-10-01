/**
 * Last.fm to Cloudflare D1 Sync Script
 *
 * Fetches listening history from Last.fm and syncs to D1 database
 * Run with: npx tsx scripts/sync-lastfm.ts
 */

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '76596c37c25f3d0d6e10890ee4b83322';
const LASTFM_USERNAME = 'mcspinnin';
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

interface LastfmTrack {
  name: string;
  artist: {
    '#text': string;
    mbid?: string;
  };
  album?: {
    '#text': string;
  };
  mbid?: string;
  date?: {
    uts: string;
  };
  '@attr'?: {
    nowplaying: string;
  };
}

interface LastfmResponse {
  recenttracks: {
    track: LastfmTrack[];
    '@attr': {
      page: string;
      totalPages: string;
      total: string;
    };
  };
}

async function executeD1Query(sql: string, params: any[] = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`D1 query failed: ${response.statusText}`);
  }

  return response.json();
}

async function getOrCreateArtist(artistName: string, mbid?: string): Promise<number> {
  // Try to find existing artist
  const selectResult = await executeD1Query(
    'SELECT id FROM artists WHERE name = ?',
    [artistName]
  );

  if (selectResult.result?.[0]?.results?.length > 0) {
    return selectResult.result[0].results[0].id;
  }

  // Create new artist
  const insertResult = await executeD1Query(
    'INSERT INTO artists (name, lastfm_mbid) VALUES (?, ?) RETURNING id',
    [artistName, mbid || null]
  );

  return insertResult.result?.[0]?.results?.[0]?.id;
}

async function getOrCreateTrack(
  trackName: string,
  artistId: number,
  album?: string,
  mbid?: string
): Promise<number> {
  // Try to find existing track
  const selectResult = await executeD1Query(
    'SELECT id FROM tracks WHERE name = ? AND artist_id = ?',
    [trackName, artistId]
  );

  if (selectResult.result?.[0]?.results?.length > 0) {
    return selectResult.result[0].results[0].id;
  }

  // Create new track
  const insertResult = await executeD1Query(
    'INSERT INTO tracks (name, artist_id, album, lastfm_mbid) VALUES (?, ?, ?, ?) RETURNING id',
    [trackName, artistId, album || null, mbid || null]
  );

  return insertResult.result?.[0]?.results?.[0]?.id;
}

async function insertScrobble(
  trackId: number,
  artistId: number,
  playedAt: number,
  isNowPlaying: boolean = false
) {
  await executeD1Query(
    `INSERT INTO scrobbles (track_id, artist_id, played_at, lastfm_timestamp, is_now_playing)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
    [trackId, artistId, playedAt, playedAt, isNowPlaying ? 1 : 0]
  );
}

async function fetchLastfmPage(page: number = 1, limit: number = 200): Promise<LastfmResponse> {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USERNAME}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}&page=${page}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Last.fm API request failed: ${response.statusText}`);
  }

  return response.json();
}

async function getLastSyncTimestamp(): Promise<number | null> {
  const result = await executeD1Query(
    'SELECT MAX(played_at) as last_timestamp FROM scrobbles'
  );
  return result.result?.[0]?.results?.[0]?.last_timestamp || null;
}

async function syncLastfmData(maxPages: number = 10, incrementalOnly: boolean = true) {
  console.log('🎵 Starting Last.fm incremental sync...');

  let totalProcessed = 0;
  let page = 1;
  let lastSyncTimestamp: number | null = null;

  try {
    // Get the last sync timestamp if doing incremental sync
    if (incrementalOnly) {
      lastSyncTimestamp = await getLastSyncTimestamp();
      if (lastSyncTimestamp) {
        const lastSyncDate = new Date(lastSyncTimestamp * 1000).toISOString();
        console.log(`📅 Last sync was at: ${lastSyncDate}`);
        console.log(`   Only fetching tracks newer than this\n`);
      } else {
        console.log('⚠️  No previous sync found, fetching all available history\n');
      }
    }

    // Update sync status to in_progress
    await executeD1Query(
      `UPDATE sync_metadata SET sync_status = 'in_progress', updated_at = unixepoch() WHERE id = 1`
    );

    let shouldContinue = true;

    while (page <= maxPages && shouldContinue) {
      console.log(`📄 Fetching page ${page}...`);
      const data = await fetchLastfmPage(page);

      const tracks = data.recenttracks?.track || [];
      if (tracks.length === 0) {
        console.log('No more tracks to process');
        break;
      }

      for (const track of tracks) {
        try {
          const artistName = track.artist['#text'];
          const trackName = track.name;
          const album = track.album?.['#text'];
          const isNowPlaying = !!track['@attr']?.nowplaying;
          const playedAt = track.date?.uts ? parseInt(track.date.uts) : Math.floor(Date.now() / 1000);

          // Stop if we've reached tracks we already have (incremental sync)
          if (incrementalOnly && lastSyncTimestamp && playedAt <= lastSyncTimestamp) {
            console.log(`\n⏭️  Reached previously synced tracks at ${new Date(playedAt * 1000).toISOString()}`);
            shouldContinue = false;
            break;
          }

          // Get or create artist
          const artistId = await getOrCreateArtist(artistName, track.artist.mbid);

          // Get or create track
          const trackId = await getOrCreateTrack(trackName, artistId, album, track.mbid);

          // Insert scrobble
          await insertScrobble(trackId, artistId, playedAt, isNowPlaying);

          totalProcessed++;

          if (totalProcessed % 50 === 0) {
            console.log(`  ✓ Processed ${totalProcessed} new scrobbles...`);
          }
        } catch (error) {
          console.error(`Error processing track: ${track.name}`, error);
        }
      }

      if (!shouldContinue) break;

      const totalPages = parseInt(data.recenttracks['@attr'].totalPages);
      console.log(`  Completed page ${page}/${Math.min(maxPages, totalPages)}\n`);

      if (page >= totalPages) {
        break;
      }

      page++;

      // Rate limiting: wait 250ms between requests
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Update sync metadata
    await executeD1Query(
      `UPDATE sync_metadata
       SET sync_status = 'completed',
           last_successful_sync = unixepoch(),
           total_scrobbles_synced = total_scrobbles_synced + ?,
           updated_at = unixepoch()
       WHERE id = 1`,
      [totalProcessed]
    );

    console.log(`\n✅ Sync completed! Processed ${totalProcessed} new scrobbles.`);
  } catch (error) {
    console.error('❌ Sync failed:', error);

    await executeD1Query(
      `UPDATE sync_metadata
       SET sync_status = 'failed',
           error_message = ?,
           updated_at = unixepoch()
       WHERE id = 1`,
      [error instanceof Error ? error.message : 'Unknown error']
    );

    throw error;
  }
}

// Run sync
if (!D1_DATABASE_ID || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('   - D1_DATABASE_ID');
  console.error('   - CLOUDFLARE_ACCOUNT_ID');
  console.error('   - CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

syncLastfmData(10).catch(console.error);
