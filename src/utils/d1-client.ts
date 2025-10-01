/**
 * Cloudflare D1 Client for Listening Habits
 * Queries listening data from D1 at build time
 */

const D1_DATABASE_ID = import.meta.env.D1_DATABASE_ID || import.meta.env.PUBLIC_D1_DATABASE_ID;
const CLOUDFLARE_ACCOUNT_ID = import.meta.env.CLOUDFLARE_ACCOUNT_ID || import.meta.env.PUBLIC_CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = import.meta.env.CLOUDFLARE_API_TOKEN || import.meta.env.PUBLIC_CLOUDFLARE_API_TOKEN;

export interface Artist {
  id: number;
  name: string;
  play_count?: number;
}

export interface Track {
  id: number;
  name: string;
  artist_name: string;
  album?: string;
  play_count?: number;
}

export interface Scrobble {
  track_name: string;
  artist_name: string;
  played_at: number;
}

export interface ListeningStats {
  totalScrobbles: number;
  uniqueTracks: number;
  uniqueArtists: number;
  topArtists: Artist[];
  topTracks: Track[];
  recentScrobbles: Scrobble[];
  listeningByDay: { date: string; count: number }[];
  listeningByHour: { hour: number; count: number }[];
}

async function executeD1Query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!D1_DATABASE_ID || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    console.warn('D1 credentials not configured, returning mock data');
    return [];
  }

  try {
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
      throw new Error(`D1 query failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result?.[0]?.results || [];
  } catch (error) {
    console.error('D1 query error:', error);
    return [];
  }
}

export async function getListeningStats(days: number = 30): Promise<ListeningStats> {
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

  // Total scrobbles
  const totalResult = await executeD1Query<{ total: number }>(
    'SELECT COUNT(*) as total FROM scrobbles WHERE played_at >= ?',
    [cutoffTimestamp]
  );
  const totalScrobbles = totalResult[0]?.total || 0;

  // Unique tracks
  const uniqueTracksResult = await executeD1Query<{ count: number }>(
    'SELECT COUNT(DISTINCT track_id) as count FROM scrobbles WHERE played_at >= ?',
    [cutoffTimestamp]
  );
  const uniqueTracks = uniqueTracksResult[0]?.count || 0;

  // Unique artists
  const uniqueArtistsResult = await executeD1Query<{ count: number }>(
    'SELECT COUNT(DISTINCT artist_id) as count FROM scrobbles WHERE played_at >= ?',
    [cutoffTimestamp]
  );
  const uniqueArtists = uniqueArtistsResult[0]?.count || 0;

  // Top 10 artists
  const topArtists = await executeD1Query<Artist>(
    `SELECT
      a.id,
      a.name,
      COUNT(*) as play_count
    FROM scrobbles s
    JOIN artists a ON s.artist_id = a.id
    WHERE s.played_at >= ?
    GROUP BY a.id, a.name
    ORDER BY play_count DESC
    LIMIT 10`,
    [cutoffTimestamp]
  );

  // Top 10 tracks
  const topTracks = await executeD1Query<Track>(
    `SELECT
      t.id,
      t.name,
      a.name as artist_name,
      t.album,
      COUNT(*) as play_count
    FROM scrobbles s
    JOIN tracks t ON s.track_id = t.id
    JOIN artists a ON t.artist_id = a.id
    WHERE s.played_at >= ?
    GROUP BY t.id, t.name, a.name, t.album
    ORDER BY play_count DESC
    LIMIT 10`,
    [cutoffTimestamp]
  );

  // Recent 20 scrobbles
  const recentScrobbles = await executeD1Query<Scrobble>(
    `SELECT
      t.name as track_name,
      a.name as artist_name,
      s.played_at
    FROM scrobbles s
    JOIN tracks t ON s.track_id = t.id
    JOIN artists a ON s.artist_id = a.id
    ORDER BY s.played_at DESC
    LIMIT 20`
  );

  // Listening by day (last 30 days)
  const listeningByDay = await executeD1Query<{ date: string; count: number }>(
    `SELECT
      date(played_at, 'unixepoch') as date,
      COUNT(*) as count
    FROM scrobbles
    WHERE played_at >= ?
    GROUP BY date
    ORDER BY date DESC
    LIMIT 30`,
    [cutoffTimestamp]
  );

  // Listening by hour of day
  const listeningByHour = await executeD1Query<{ hour: number; count: number }>(
    `SELECT
      CAST(strftime('%H', played_at, 'unixepoch') AS INTEGER) as hour,
      COUNT(*) as count
    FROM scrobbles
    WHERE played_at >= ?
    GROUP BY hour
    ORDER BY hour`,
    [cutoffTimestamp]
  );

  return {
    totalScrobbles,
    uniqueTracks,
    uniqueArtists,
    topArtists,
    topTracks,
    recentScrobbles,
    listeningByDay,
    listeningByHour,
  };
}

export async function getAllTimeStats() {
  // Total all-time scrobbles
  const totalResult = await executeD1Query<{ total: number }>(
    'SELECT COUNT(*) as total FROM scrobbles'
  );

  // First and last scrobble dates
  const dateRangeResult = await executeD1Query<{ first_scrobble: number; last_scrobble: number }>(
    'SELECT MIN(played_at) as first_scrobble, MAX(played_at) as last_scrobble FROM scrobbles'
  );

  // All-time top artist
  const topArtistResult = await executeD1Query<Artist>(
    `SELECT
      a.id,
      a.name,
      COUNT(*) as play_count
    FROM scrobbles s
    JOIN artists a ON s.artist_id = a.id
    GROUP BY a.id, a.name
    ORDER BY play_count DESC
    LIMIT 1`
  );

  return {
    totalScrobbles: totalResult[0]?.total || 0,
    firstScrobble: dateRangeResult[0]?.first_scrobble,
    lastScrobble: dateRangeResult[0]?.last_scrobble,
    topArtist: topArtistResult[0],
  };
}
