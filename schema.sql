-- Listening Habits Database Schema for Cloudflare D1

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  lastfm_mbid TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_artists_name ON artists(name);

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  artist_id INTEGER NOT NULL,
  album TEXT,
  lastfm_mbid TEXT,
  duration INTEGER,  -- in seconds
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (artist_id) REFERENCES artists(id),
  UNIQUE(name, artist_id)
);

CREATE INDEX idx_tracks_artist ON tracks(artist_id);
CREATE INDEX idx_tracks_name ON tracks(name);

-- Scrobbles (listening history)
CREATE TABLE IF NOT EXISTS scrobbles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  artist_id INTEGER NOT NULL,
  played_at INTEGER NOT NULL,  -- unix timestamp
  lastfm_timestamp INTEGER,    -- original Last.fm timestamp
  is_now_playing INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (track_id) REFERENCES tracks(id),
  FOREIGN KEY (artist_id) REFERENCES artists(id)
);

CREATE INDEX idx_scrobbles_played_at ON scrobbles(played_at DESC);
CREATE INDEX idx_scrobbles_track ON scrobbles(track_id);
CREATE INDEX idx_scrobbles_artist ON scrobbles(artist_id);
CREATE INDEX idx_scrobbles_now_playing ON scrobbles(is_now_playing, played_at DESC);

-- Daily listening stats (aggregated for performance)
CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD format
  total_scrobbles INTEGER DEFAULT 0,
  unique_tracks INTEGER DEFAULT 0,
  unique_artists INTEGER DEFAULT 0,
  top_artist_id INTEGER,
  top_track_id INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (top_artist_id) REFERENCES artists(id),
  FOREIGN KEY (top_track_id) REFERENCES tracks(id)
);

CREATE INDEX idx_daily_stats_date ON daily_stats(date DESC);

-- Sync metadata (track sync progress)
CREATE TABLE IF NOT EXISTS sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  last_sync_timestamp INTEGER,
  last_successful_sync INTEGER,
  total_scrobbles_synced INTEGER DEFAULT 0,
  sync_status TEXT,  -- 'pending', 'in_progress', 'completed', 'failed'
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Insert initial sync metadata record
INSERT INTO sync_metadata (sync_status, total_scrobbles_synced)
VALUES ('pending', 0)
ON CONFLICT DO NOTHING;
