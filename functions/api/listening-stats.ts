/**
 * Cloudflare Pages Function to query D1 listening stats
 * This runs at request time with proper D1 bindings
 */

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

    // Get stats in parallel
    const [
      totalResult,
      uniqueTracksResult,
      uniqueArtistsResult,
      topArtists,
      topTracks,
      recentScrobbles,
      allTimeTotal,
      allTimeTopArtist
    ] = await Promise.all([
      // Last 30 days total
      db.prepare('SELECT COUNT(*) as total FROM scrobbles WHERE played_at >= ?').bind(cutoffTimestamp).first(),

      // Unique tracks
      db.prepare('SELECT COUNT(DISTINCT track_id) as count FROM scrobbles WHERE played_at >= ?').bind(cutoffTimestamp).first(),

      // Unique artists
      db.prepare('SELECT COUNT(DISTINCT artist_id) as count FROM scrobbles WHERE played_at >= ?').bind(cutoffTimestamp).first(),

      // Top 10 artists
      db.prepare(`
        SELECT a.name, COUNT(*) as play_count
        FROM scrobbles s
        JOIN artists a ON s.artist_id = a.id
        WHERE s.played_at >= ?
        GROUP BY a.id, a.name
        ORDER BY play_count DESC
        LIMIT 10
      `).bind(cutoffTimestamp).all(),

      // Top 10 tracks
      db.prepare(`
        SELECT t.name, a.name as artist_name, COUNT(*) as play_count
        FROM scrobbles s
        JOIN tracks t ON s.track_id = t.id
        JOIN artists a ON t.artist_id = a.id
        WHERE s.played_at >= ?
        GROUP BY t.id, t.name, a.name
        ORDER BY play_count DESC
        LIMIT 10
      `).bind(cutoffTimestamp).all(),

      // Recent 20 scrobbles
      db.prepare(`
        SELECT t.name as track_name, a.name as artist_name, s.played_at
        FROM scrobbles s
        JOIN tracks t ON s.track_id = t.id
        JOIN artists a ON s.artist_id = a.id
        ORDER BY s.played_at DESC
        LIMIT 20
      `).all(),

      // All-time total
      db.prepare('SELECT COUNT(*) as total FROM scrobbles').first(),

      // All-time top artist
      db.prepare(`
        SELECT a.name, COUNT(*) as play_count
        FROM scrobbles s
        JOIN artists a ON s.artist_id = a.id
        GROUP BY a.id, a.name
        ORDER BY play_count DESC
        LIMIT 1
      `).first()
    ]);

    const stats = {
      last30Days: {
        totalScrobbles: totalResult?.total || 0,
        uniqueTracks: uniqueTracksResult?.count || 0,
        uniqueArtists: uniqueArtistsResult?.count || 0,
        topArtists: topArtists.results || [],
        topTracks: topTracks.results || [],
        recentScrobbles: recentScrobbles.results || []
      },
      allTime: {
        totalScrobbles: allTimeTotal?.total || 0,
        topArtist: allTimeTopArtist || null
      }
    };

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  } catch (error) {
    console.error('D1 query error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
