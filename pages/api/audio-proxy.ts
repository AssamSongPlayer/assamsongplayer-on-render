// /pages/api/audio-proxy.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import https from 'https'

const token = 'fE93KkZMjhg7ZtHMudQY9CHj5m8MDH3CFxLEKsw1y'

// In-memory link cache: fileid → direct stream URL
const audioLinkCache = new Map<string, string>()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fileid } = req.query

  if (!fileid || typeof fileid !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid fileid' })
  }

  try {
    let streamUrl = audioLinkCache.get(fileid)

    // If not cached, fetch from pCloud
    if (!streamUrl) {
      const response = await fetch(`https://api.pcloud.com/getfilelink?fileid=${fileid}&auth=${token}`)
      const data = await response.json()

      if (data.result !== 0 || !data.hosts?.length || !data.path) {
        return res.status(500).json({ error: 'Failed to fetch pCloud link' })
      }

      streamUrl = `https://${data.hosts[0]}${data.path}`
      audioLinkCache.set(fileid, streamUrl)
    }

    // Proxy the audio from pCloud and stream to client
    https.get(streamUrl, (pcloudRes) => {
      if (pcloudRes.statusCode !== 200) {
        return res.status(pcloudRes.statusCode || 500).end()
      }

      // Copy headers (minimal, just set mp3 and cache)
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      })

      // Pipe audio from pCloud to client
      pcloudRes.pipe(res)
    }).on('error', (err) => {
      console.error('Streaming error:', err)
      res.status(500).end('Failed to stream audio')
    })

  } catch (err) {
    console.error('Audio proxy error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
