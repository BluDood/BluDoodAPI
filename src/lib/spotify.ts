import axios from 'axios'
import EventEmitter from 'events'
import WebSocket from 'ws'
import { TOTP } from 'totp-generator'

import log from './log.js'

async function subscribe(connection_id: string, token: string) {
  return await axios.put(
    'https://api.spotify.com/v1/me/notifications/player',
    null,
    {
      params: {
        connection_id
      },
      headers: {
        Authorization: `Bearer ${token}`
      },
      validateStatus: () => true
    }
  )
}

async function generateTotp(): Promise<{
  otp: string
  version: string
} | null> {
  const res = await axios.get(
    `https://gist.github.com/BluDood/1c82e1086a21adfad5e121f255774d57/raw?${Date.now()}`
  )
  if (res.status !== 200) return null

  const totp = TOTP.generate(res.data.secret)

  return {
    otp: totp.otp,
    version: res.data.version
  }
}

async function getToken(sp_dc: string) {
  const totp = await generateTotp()
  if (!totp) throw new Error('Failed to generate TOTP')

  const res = await axios.get('https://open.spotify.com/api/token', {
    headers: {
      cookie: `sp_dc=${sp_dc};`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    },
    params: {
      reason: 'init',
      productType: 'web-player',
      totp: totp.otp,
      totpServer: totp.otp,
      totpVer: totp.version
    },
    validateStatus: () => true
  })

  if (res.status !== 200) throw new Error('Invalid sp_dc')

  if (!res.data.accessToken) throw new Error('Invalid sp_dc')

  return res.data.accessToken
}

export interface SpotifyCurrentPlayingResponse {
  is_playing: boolean
  progress_ms: number
  item: {
    name: string
    external_urls: {
      spotify: string
    }
    artists: {
      name: string
      external_urls: {
        spotify: string
      }
    }[]
    album: {
      name: string
      external_urls: {
        spotify: string
      }
      images: {
        url: string
        width: number
        height: number
      }[]
    }
    duration_ms: number
  }
}

interface FilteredSpotifyCurrentPlayingResponse {
  session: boolean
  playing?: boolean
  name?: string
  trackURL?: string
  artists?: {
    name: string
    url: string
  }[]
  album?: {
    name: string
    url: string
  }
  covers?: {
    url: string
    width: number
    height: number
  }[]
  duration?: {
    current: number
    total: number
  }
}

export function filterData(
  data: SpotifyCurrentPlayingResponse,
  lastUpdate = Number.MAX_SAFE_INTEGER
): FilteredSpotifyCurrentPlayingResponse {
  if (!data || !data.item) {
    return { session: false }
  }

  const { is_playing, item, progress_ms } = data

  const TIMEOUT = 1000 * 60 * 10 // 10 minutes
  if (!is_playing && lastUpdate <= Date.now() - TIMEOUT) {
    return { session: false }
  }

  const currentTime = Math.min(
    Math.max(
      is_playing && lastUpdate < Date.now()
        ? progress_ms + Math.floor(Date.now() - lastUpdate)
        : progress_ms,
      0
    ),
    item.duration_ms
  )

  return {
    session: true,
    playing: is_playing,
    name: item.name,
    trackURL: item.external_urls.spotify,
    artists: item.artists.map(a => ({
      name: a.name,
      url: a.external_urls.spotify
    })),
    album: {
      name: item.album.name,
      url: item.album.external_urls.spotify
    },
    covers: item.album.images,
    duration: {
      current: currentTime,
      total: item.duration_ms
    }
  }
}

class Spotify extends EventEmitter {
  sp_dc: string
  ws: WebSocket | null
  current: SpotifyCurrentPlayingResponse | null = null
  lastUpdate: number = 0

  constructor(sp_dc: string) {
    super()

    this.sp_dc = sp_dc
    this.ws = null
    this.setup()

    this.on('PLAYER_STATE_CHANGED', e => {
      this.current = e.state
      this.lastUpdate = Date.now()
    })

    this.on('DEVICE_STATE_CHANGED', e => {
      if (e.devices.length === 0) {
        this.emit('PLAYER_STATE_CHANGED', {
          state: null
        })
      }
    })

    this.on('ready', () => {
      log('Socket is ready!', 'Spotify')
    })

    this.on('error', err => {
      log(`Error: ${err.message}`, 'Spotify')
    })

    this.on('close', () => {
      log('Socket closed, reconnecting...', 'Spotify')
      this.setup()
    })
  }

  async setup() {
    if (this.ws) this.cleanup()

    const token = await getToken(this.sp_dc).catch(err => {
      this.emit('error', new Error('Failed to get Spotify token'))
      return null
    })
    if (!token) return

    this.ws = new WebSocket(
      `wss://dealer.spotify.com/?access_token=${token}`
    )
    const ping = () => this.ws!.send('{"type":"ping"}')

    this.ws.on('open', () => {
      ping()
      setInterval(ping, 15000)
    })

    this.ws.on('message', async d => {
      const msg = JSON.parse(d.toString())
      if (msg.headers?.['Spotify-Connection-Id']) {
        return await subscribe(msg.headers['Spotify-Connection-Id'], token)
          .then(() => this.emit('ready'))
          .catch(err => this.emit('error', err))
      }
      const event = msg.payloads?.[0]?.events?.[0]
      if (!event) return
      this.emit(event.type, event.event)
    })

    this.ws.on('close', () => this.emit('close'))

    this.ws.on('error', err => {
      this.emit('error', err)
      this.emit('close')
    })
  }

  cleanup() {
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.close()
      this.ws = null
    }
  }

  getCurrent(): FilteredSpotifyCurrentPlayingResponse {
    if (!this.current)
      return {
        session: false
      }
    return filterData(this.current, this.lastUpdate)
  }
}

const spotify = process.env.SPOTIFY_DC
  ? new Spotify(process.env.SPOTIFY_DC)
  : null

export default spotify
