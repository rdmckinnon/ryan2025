// Last.fm API utilities
const LASTFM_API_KEY = import.meta.env.LASTFM_API_KEY || '76596c37c25f3d0d6e10890ee4b83322';
const LASTFM_USERNAME = 'mcspinnin';

interface LastfmTrack {
  name: string;
  artist: {
    '#text': string;
  };
  '@attr'?: {
    nowplaying?: string;
  };
}

interface LastfmResponse {
  recenttracks: {
    track: LastfmTrack[];
  };
}

export async function getRecentTracks(limit: number = 3): Promise<string[]> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USERNAME}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Last.fm API request failed, using fallback');
      return ['spinning records', 'new music finds'];
    }

    const data: LastfmResponse = await response.json();
    const tracks = data.recenttracks?.track || [];

    return tracks.map(track => {
      const prefix = track['@attr']?.nowplaying ? 'now playing' : 'recently played';
      return `${prefix}: ${track.artist['#text']} - ${track.name}`;
    });
  } catch (error) {
    console.warn('Error fetching Last.fm data:', error);
    return ['spinning records', 'new music finds'];
  }
}