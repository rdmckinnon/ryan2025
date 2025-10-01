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

    // Additional queries for charts
    const [
      listeningByDay,
      listeningByHour,
      listeningByDayOfWeek,
      artistDiversity,
      oldestScrobble,
      listeningByDecade
    ] = await Promise.all([
      // Daily activity (last 90 days)
      db.prepare(`
        SELECT date(played_at, 'unixepoch') as date, COUNT(*) as count
        FROM scrobbles
        WHERE played_at >= ?
        GROUP BY date
        ORDER BY date ASC
      `).bind(Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60)).all(),

      // Listening by hour of day
      db.prepare(`
        SELECT CAST(strftime('%H', played_at, 'unixepoch') AS INTEGER) as hour, COUNT(*) as count
        FROM scrobbles
        GROUP BY hour
        ORDER BY hour ASC
      `).all(),

      // Listening by day of week (0=Sunday, 6=Saturday)
      db.prepare(`
        SELECT CAST(strftime('%w', played_at, 'unixepoch') AS INTEGER) as day, COUNT(*) as count
        FROM scrobbles
        GROUP BY day
        ORDER BY day ASC
      `).all(),

      // Artist diversity (top 10 vs rest)
      db.prepare(`
        SELECT
          SUM(CASE WHEN rn <= 10 THEN play_count ELSE 0 END) as top10_plays,
          SUM(CASE WHEN rn > 10 THEN play_count ELSE 0 END) as other_plays
        FROM (
          SELECT COUNT(*) as play_count, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rn
          FROM scrobbles
          GROUP BY artist_id
        )
      `).first(),

      // Oldest scrobble for streak calculation
      db.prepare(`
        SELECT MIN(played_at) as oldest
        FROM scrobbles
      `).first(),

      // Listening by decade (based on when tracks were released - approximation using years)
      db.prepare(`
        SELECT
          CASE
            WHEN strftime('%Y', played_at, 'unixepoch') >= '2020' THEN '2020s'
            WHEN strftime('%Y', played_at, 'unixepoch') >= '2010' THEN '2010s'
            WHEN strftime('%Y', played_at, 'unixepoch') >= '2000' THEN '2000s'
            WHEN strftime('%Y', played_at, 'unixepoch') >= '1990' THEN '1990s'
            WHEN strftime('%Y', played_at, 'unixepoch') >= '1980' THEN '1980s'
            WHEN strftime('%Y', played_at, 'unixepoch') >= '1970' THEN '1970s'
            ELSE 'Pre-1970s'
          END as decade,
          COUNT(*) as count
        FROM scrobbles
        GROUP BY decade
        ORDER BY
          CASE decade
            WHEN '2020s' THEN 1
            WHEN '2010s' THEN 2
            WHEN '2000s' THEN 3
            WHEN '1990s' THEN 4
            WHEN '1980s' THEN 5
            WHEN '1970s' THEN 6
            ELSE 7
          END
      `).all()
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
        topArtist: allTimeTopArtist || null,
        oldestScrobble: oldestScrobble?.oldest || null
      },
      charts: {
        listeningByDay: listeningByDay.results || [],
        listeningByHour: listeningByHour.results || [],
        listeningByDayOfWeek: listeningByDayOfWeek.results || [],
        artistDiversity: artistDiversity || { top10_plays: 0, other_plays: 0 },
        listeningByDecade: listeningByDecade.results || []
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
