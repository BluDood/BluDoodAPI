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

function base32FromBytes(bytes: Uint8Array, secretSauce: string): string {
  let t = 0
  let n = 0
  let r = ''

  for (let i = 0; i < bytes.length; i++) {
    n = (n << 8) | bytes[i]
    t += 8
    while (t >= 5) {
      r += secretSauce[(n >>> (t - 5)) & 31]
      t -= 5
    }
  }

  if (t > 0) {
    r += secretSauce[(n << (5 - t)) & 31]
  }

  return r
}

function cleanBuffer(e: string): Uint8Array {
  e = e.replace(' ', '')
  const buffer = new Uint8Array(e.length / 2)
  for (let i = 0; i < e.length; i += 2) {
    buffer[i / 2] = parseInt(e.substring(i, i + 2), 16)
  }
  return buffer
}

async function generateTotp(): Promise<{
  otp: string
  timestamp: number
}> {
  const secretSauce = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

  const secretCipherBytes = [
    12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54
  ].map((e, t) => e ^ ((t % 33) + 9))

  const secretBytes = cleanBuffer(
    new TextEncoder()
      .encode(secretCipherBytes.join(''))
      .reduce((acc, val) => acc + val.toString(16).padStart(2, '0'), '')
  )

  const secret = base32FromBytes(secretBytes, secretSauce)

  const res = await axios.get('https://open.spotify.com/server-time')
  const timestamp = res.data.serverTime * 1000

  const totp = TOTP.generate(secret, {
    timestamp
  })

  return {
    otp: totp.otp,
    timestamp
  }
}

async function getToken(sp_dc: string) {
  const totp = await generateTotp()

  const res = await axios.get(
    'https://open.spotify.com/get_access_token',
    {
      headers: {
        cookie: `sp_dc=${sp_dc};`,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      params: {
        reason: 'init',
        productType: 'web-player',
        totp: totp.otp,
        totpVer: '5',
        ts: totp.timestamp
      },
      validateStatus: () => true
    }
  )

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
      href: string
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
  data: SpotifyCurrentPlayingResponse
): FilteredSpotifyCurrentPlayingResponse {
  if (!data || !data.item) {
    return { session: false }
  }

  const { is_playing, item, progress_ms } = data

  if (!is_playing || !item) return { session: false }

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
      url: item.album.href
    },
    covers: item.album.images,
    duration: {
      current: progress_ms,
      total: item.duration_ms
    }
  }
}

class Spotify extends EventEmitter {
  sp_dc: string
  token: string | null
  ws: WebSocket | null

  constructor(sp_dc: string) {
    super()

    this.sp_dc = sp_dc
    this.token = null
    this.ws = null
    this.start()
  }

  start = async () => {
    this.token = await getToken(this.sp_dc).catch(err => {
      log(`Error: ${err.message}`, 'Spotify')
      return null
    })

    if (!this.token) return null

    this.ws = new WebSocket(
      `wss://dealer.spotify.com/?access_token=${this.token}`
    )

    this.setup()
  }

  setup() {
    if (!this.ws) return
    const ping = () => this.ws!.send('{"type":"ping"}')

    this.ws.on('open', () => {
      ping()
      setInterval(ping, 15000)
    })

    this.ws.on('message', async d => {
      const msg = JSON.parse(d.toString())
      if (msg.headers?.['Spotify-Connection-Id']) {
        return await subscribe(
          msg.headers['Spotify-Connection-Id'],
          this.token!
        )
          .then(() => this.emit('ready'))
          .catch(err => this.emit('error', err))
      }
      const event = msg.payloads?.[0]?.events?.[0]
      if (!event) return
      this.emit(event.type, event.event)
    })

    this.ws.on('close', () => this.emit('close'))

    this.ws.on('error', err => this.emit('error', err))
  }

  async getCurrent(): Promise<FilteredSpotifyCurrentPlayingResponse> {
    const res = await axios.get(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          Authorization: `Bearer ${this.token}`
        },
        validateStatus: () => true
      }
    )

    if (res.status === 401) {
      this.token = await getToken(this.sp_dc).catch(err => {
        log(`Error: ${err.message}`, 'Spotify')
        return null
      })
      if (!this.token) return { session: false }
      this.ws = new WebSocket(
        `wss://dealer.spotify.com/?access_token=${this.token}`
      )
      this.setup()
      return this.getCurrent()
    }

    if (!res.data)
      return {
        session: false
      }

    return filterData(res.data)
  }
}

const spotify = process.env.SPOTIFY_DC
  ? new Spotify(process.env.SPOTIFY_DC)
  : null

export default spotify
