// /pages/api/audio-proxy.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const token = 'fE93KkZMjhg7ZtHMudQY9CHj5m8MDH3CFxLEKsw1y';

// In-memory link cache: fileid → direct stream URL
const audioLinkCache = new Map<string, string>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fileid } = req.query;

  if (!fileid || typeof fileid !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid fileid' });
  }

  try {
    // Check cache first
    let cachedLink = audioLinkCache.get(fileid);

    if (!cachedLink) {
      // Fetch pCloud stream URL
      const response = await fetch(`https://api.pcloud.com/getfilelink?fileid=${fileid}&auth=${token}`);
      const data = await response.json();

      if (data.result !== 0 || !data.hosts?.length || !data.path) {
        return res.status(500).json({ error: 'Failed to fetch stream link' });
      }

      cachedLink = `https://${data.hosts[0]}${data.path}`;
      audioLinkCache.set(fileid, cachedLink);
    }

    // Redirect client to the cached direct stream URL
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.redirect(302, cachedLink);

  } catch (err) {
    console.error('Audio proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
