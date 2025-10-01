/**
 * Convert CSV to SQL dump for ultra-fast D1 import
 * Run with: npx tsx scripts/csv-to-sql.ts data/scrobbles-cleaned.csv > import.sql
 */

import * as fs from 'fs';

interface CSVRow {
  artist: string;
  track: string;
  album?: string;
  timestamp: string;
}

function parseTimestamp(timestampStr: string): number {
  // Try parsing as unix timestamp first (should be 10 digits for seconds)
  const unixTimestamp = parseInt(timestampStr);
  if (!isNaN(unixTimestamp)) {
    // If it's already in seconds (10 digits), use it directly
    if (unixTimestamp > 1000000000 && unixTimestamp < 2000000000) {
      return unixTimestamp;
    }
    // If it's in milliseconds (13 digits), convert to seconds
    if (unixTimestamp > 10000000000) {
      return Math.floor(unixTimestamp / 1000);
    }
  }

  // Try parsing as ISO date
  const isoDate = new Date(timestampStr);
  if (!isNaN(isoDate.getTime())) {
    return Math.floor(isoDate.getTime() / 1000);
  }

  console.error(`Warning: Could not parse timestamp: ${timestampStr}, using current time`);
  return Math.floor(Date.now() / 1000);
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));

  console.error('Detected headers:', headers);

  // Find artist column (not artist_mbid)
  const artistIndex = headers.findIndex(h => h === 'artist');
  // Find track column (not track_mbid)
  const trackIndex = headers.findIndex(h => h === 'track');
  // Find album column (not album_mbid)
  const albumIndex = headers.findIndex(h => h === 'album');
  // Find timestamp column (prefer uts over utc_time)
  const timestampIndex = headers.findIndex(h => h === 'uts' || h === 'utc_time' || h.includes('time'));

  console.error(`Column indexes - artist: ${artistIndex}, track: ${trackIndex}, album: ${albumIndex}, timestamp: ${timestampIndex}`);

  if (artistIndex === -1 || trackIndex === -1 || timestampIndex === -1) {
    throw new Error(`Could not detect required columns. Found headers: ${headers.join(', ')}`);
  }

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by comma but respect quoted values
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim().replace(/^["']|["']$/g, ''));

    if (values[artistIndex] && values[trackIndex]) {
      rows.push({
        artist: values[artistIndex],
        track: values[trackIndex],
        album: albumIndex >= 0 ? values[albumIndex] : undefined,
        timestamp: values[timestampIndex],
      });
    }
  }

  return rows;
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: npx tsx scripts/csv-to-sql.ts path/to/csv > import.sql');
  process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const rows = parseCSV(csvContent);

console.log('-- Auto-generated SQL import from CSV');
console.log(`-- Total records: ${rows.length}`);
console.log('-- Generated at: ' + new Date().toISOString());
console.log('');

// Create maps to deduplicate artists and tracks
const artistMap = new Map<string, number>();
const trackMap = new Map<string, number>();
let artistId = 1;
let trackId = 1;

// First pass: collect unique artists and tracks
for (const row of rows) {
  const artistKey = row.artist.toLowerCase();
  if (!artistMap.has(artistKey)) {
    artistMap.set(artistKey, artistId++);
  }

  const trackKey = `${row.artist.toLowerCase()}|||${row.track.toLowerCase()}`;
  if (!trackMap.has(trackKey)) {
    trackMap.set(trackKey, trackId++);
  }
}

console.log('-- Insert artists');

for (const [artistName, id] of artistMap.entries()) {
  // Find original casing
  const original = rows.find(r => r.artist.toLowerCase() === artistName)!.artist;
  console.log(`INSERT INTO artists (id, name) VALUES (${id}, '${escapeSQL(original)}');`);
}

console.log('');

console.log('-- Insert tracks');

for (const [trackKey, id] of trackMap.entries()) {
  const [artistLower, trackLower] = trackKey.split('|||');
  const original = rows.find(r =>
    r.artist.toLowerCase() === artistLower &&
    r.track.toLowerCase() === trackLower
  )!;

  const artistId = artistMap.get(artistLower)!;
  const album = original.album ? `'${escapeSQL(original.album)}'` : 'NULL';

  console.log(`INSERT INTO tracks (id, name, artist_id, album) VALUES (${id}, '${escapeSQL(original.track)}', ${artistId}, ${album});`);
}

console.log('');

console.log('-- Insert scrobbles');

let scrobbleId = 1;
for (const row of rows) {
  const artistKey = row.artist.toLowerCase();
  const trackKey = `${row.artist.toLowerCase()}|||${row.track.toLowerCase()}`;
  const artistId = artistMap.get(artistKey)!;
  const trackId = trackMap.get(trackKey)!;
  const playedAt = parseTimestamp(row.timestamp);

  console.log(`INSERT INTO scrobbles (id, track_id, artist_id, played_at, lastfm_timestamp) VALUES (${scrobbleId++}, ${trackId}, ${artistId}, ${playedAt}, ${playedAt});`);
}
console.log('');

console.log('-- Update sync metadata');
console.log(`UPDATE sync_metadata SET sync_status = 'completed', last_successful_sync = unixepoch(), total_scrobbles_synced = ${rows.length}, updated_at = unixepoch() WHERE id = 1;`);

console.error(`\n✅ Generated SQL with ${artistMap.size} artists, ${trackMap.size} tracks, ${rows.length} scrobbles`);
