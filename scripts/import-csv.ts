/**
 * CSV Import Script for Listening History
 *
 * Imports historical listening data from CSV to Cloudflare D1
 * Run with: npx tsx scripts/import-csv.ts path/to/your-data.csv
 */

import * as fs from 'fs';
import * as path from 'path';

const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

interface CSVRow {
  artist: string;
  track: string;
  album?: string;
  timestamp: string; // Can be various formats
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
      body: JSON.stringify({ sql, params }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`D1 query failed: ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

async function getOrCreateArtist(artistName: string): Promise<number> {
  const selectResult = await executeD1Query(
    'SELECT id FROM artists WHERE name = ?',
    [artistName]
  );

  if (selectResult.result?.[0]?.results?.length > 0) {
    return selectResult.result[0].results[0].id;
  }

  const insertResult = await executeD1Query(
    'INSERT INTO artists (name) VALUES (?) RETURNING id',
    [artistName]
  );

  return insertResult.result?.[0]?.results?.[0]?.id;
}

async function getOrCreateTrack(
  trackName: string,
  artistId: number,
  album?: string
): Promise<number> {
  const selectResult = await executeD1Query(
    'SELECT id FROM tracks WHERE name = ? AND artist_id = ?',
    [trackName, artistId]
  );

  if (selectResult.result?.[0]?.results?.length > 0) {
    return selectResult.result[0].results[0].id;
  }

  const insertResult = await executeD1Query(
    'INSERT INTO tracks (name, artist_id, album) VALUES (?, ?, ?) RETURNING id',
    [trackName, artistId, album || null]
  );

  return insertResult.result?.[0]?.results?.[0]?.id;
}

async function insertScrobble(
  trackId: number,
  artistId: number,
  playedAt: number
) {
  await executeD1Query(
    `INSERT INTO scrobbles (track_id, artist_id, played_at, lastfm_timestamp)
     VALUES (?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
    [trackId, artistId, playedAt, playedAt]
  );
}

function parseTimestamp(timestampStr: string): number {
  // Try parsing as ISO date
  const isoDate = new Date(timestampStr);
  if (!isNaN(isoDate.getTime())) {
    return Math.floor(isoDate.getTime() / 1000);
  }

  // Try parsing as unix timestamp
  const unixTimestamp = parseInt(timestampStr);
  if (!isNaN(unixTimestamp)) {
    // If it's in milliseconds, convert to seconds
    return unixTimestamp > 10000000000 ? Math.floor(unixTimestamp / 1000) : unixTimestamp;
  }

  console.warn(`Could not parse timestamp: ${timestampStr}, using current time`);
  return Math.floor(Date.now() / 1000);
}

function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

  // Detect column names (support various CSV formats)
  const artistIndex = headers.findIndex(h =>
    h.includes('artist') || h.includes('artistname')
  );
  const trackIndex = headers.findIndex(h =>
    h.includes('track') || h.includes('song') || h.includes('name')
  );
  const albumIndex = headers.findIndex(h =>
    h.includes('album')
  );
  const timestampIndex = headers.findIndex(h =>
    h.includes('time') || h.includes('date') || h.includes('played')
  );

  if (artistIndex === -1 || trackIndex === -1 || timestampIndex === -1) {
    throw new Error(`Could not detect required columns. Found headers: ${headers.join(', ')}`);
  }

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));

    rows.push({
      artist: values[artistIndex],
      track: values[trackIndex],
      album: albumIndex >= 0 ? values[albumIndex] : undefined,
      timestamp: values[timestampIndex],
    });
  }

  return rows;
}

async function importCSV(csvPath: string) {
  console.log(`📁 Reading CSV file: ${csvPath}`);

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);

  console.log(`📊 Found ${rows.length} records in CSV`);
  console.log(`🎵 Starting import to D1...\n`);

  let totalProcessed = 0;
  let errors = 0;

  try {
    await executeD1Query(
      `UPDATE sync_metadata SET sync_status = 'in_progress', updated_at = unixepoch() WHERE id = 1`
    );

    for (const row of rows) {
      try {
        const playedAt = parseTimestamp(row.timestamp);
        const artistId = await getOrCreateArtist(row.artist);
        const trackId = await getOrCreateTrack(row.track, artistId, row.album);
        await insertScrobble(trackId, artistId, playedAt);

        totalProcessed++;

        if (totalProcessed % 100 === 0) {
          console.log(`  ✓ Processed ${totalProcessed}/${rows.length} records...`);
        }
      } catch (error) {
        errors++;
        console.error(`Error processing row ${totalProcessed + 1}:`, error);
      }
    }

    await executeD1Query(
      `UPDATE sync_metadata
       SET sync_status = 'completed',
           last_successful_sync = unixepoch(),
           total_scrobbles_synced = ?,
           updated_at = unixepoch()
       WHERE id = 1`,
      [totalProcessed]
    );

    console.log(`\n✅ Import completed!`);
    console.log(`   Successfully imported: ${totalProcessed} records`);
    console.log(`   Errors: ${errors}`);
  } catch (error) {
    console.error('❌ Import failed:', error);

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

// Validate environment
if (!D1_DATABASE_ID || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('   - D1_DATABASE_ID');
  console.error('   - CLOUDFLARE_ACCOUNT_ID');
  console.error('   - CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

// Get CSV path from command line
const csvPath = process.argv[2];
if (!csvPath) {
  console.error('❌ Usage: npx tsx scripts/import-csv.ts path/to/your-data.csv');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`❌ File not found: ${csvPath}`);
  process.exit(1);
}

importCSV(csvPath).catch(console.error);
