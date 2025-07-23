// /pages/api/audio-proxy.ts

import type { NextApiRequest, NextApiResponse } from 'next'

const AUTH_TOKEN = 'fE93KkZMjhg7ZtHMudQY9CHj5m8MDH3CFxLEKsw1y'

// Optional: in-memory link cache
const audioLinkCache = new Map<string, string>()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fileid = req.query.fileid as string

  if (!fileid) {
    return res.status(400).json({ error: 'Missing fileid' })
  }

  try {
    let fileUrl = audioLinkCache.get(fileid)

    if (!fileUrl) {
      const meta = await fetch(`https://api.pcloud.com/getfilelink?fileid=${fileid}&auth=${AUTH_TOKEN}`)
      const json = await meta.json()

      if (json.result !== 0 || !json.hosts?.length || !json.path) {
        return res.status(500).json({ error: 'Failed to fetch pCloud stream link' })
      }

      fileUrl = `https://${json.hosts[0]}${json.path}`
      audioLinkCache.set(fileid, fileUrl)
    }

    // Fetch audio as stream
    const audioRes = await fetch(fileUrl, {
      headers: {
        // Pass through range headers for seeking
        range: req.headers.range || '',
      },
    })

    // Forward all headers needed for media playback
    res.status(audioRes.status)
    audioRes.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    // Pipe stream to client
    if (!audioRes.body) {
      return res.status(500).end('No audio body')
    }

    const reader = audioRes.body.getReader()
    const encoder = new TextEncoder()

    res.setHeader('Cache-Control', 'public, max-age=3600')

    const push = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) res.write(Buffer.from(value))
      }
      res.end()
    }

    push()

  } catch (err) {
    console.error('Audio proxy error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
