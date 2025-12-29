import axios, { AxiosInstance } from 'axios'
import EventEmitter from 'events'
import WebSocket from 'ws'
import { TOTP } from 'totp-generator'

import { logger, random, safeParse } from './utils.js'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
const SEC_UA =
  '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"'
const CLIENT_VERSION = '1.2.81.13.gc3aea6b0'
const HARMONY_CLIENT_VERSION = '4.62.1-5dc29b8a7'

const BROWSER_HEADERS = {
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  'content-type': 'application/json',
  origin: 'https://open.spotify.com',
  priority: 'u=1, i',
  referer: 'https://open.spotify.com/',
  'sec-ch-ua': SEC_UA,
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': USER_AGENT
}

const SOCKET_HEADERS = {
  'accept-language': 'en-US,en;q=0.9',
  origin: 'https://open.spotify.com',
  'user-agent': USER_AGENT
}

async function generateTotp(): Promise<{
  otp: string
  version: string
} | null> {
  const res = await axios.get(
    `https://gist.github.com/BluDood/1c82e1086a21adfad5e121f255774d57/raw?${Date.now()}`
  )
  if (res.status !== 200) return null

  const totp = await TOTP.generate(res.data.secret)

  return {
    otp: totp.otp,
    version: res.data.version
  }
}

async function getToken(sp_dc: string) {
  const totp = await generateTotp()
  if (!totp) {
    logger.error('Failed to generate TOTP', 'Spotify')
    return null
  }

  const res = await axios.get('https://open.spotify.com/api/token', {
    headers: {
      ...BROWSER_HEADERS,
      cookie: `sp_dc=${sp_dc};`
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

  if (res.status !== 200) {
    logger.error(`Failed to get Spotify token: ${res.status}`, 'Spotify')
    return
  }

  if (!res.data.accessToken) {
    logger.error('No access token received from Spotify', 'Spotify')
    return
  }

  return {
    accessToken: res.data.accessToken,
    clientId: res.data.clientId
  }
}

async function getClientToken(clientId: string) {
  const res = await axios.post(
    'https://clienttoken.spotify.com/v1/clienttoken',
    {
      client_data: {
        client_version: CLIENT_VERSION,
        client_id: clientId,
        js_sdk_data: {
          device_brand: 'unknown',
          device_model: 'unknown',
          os: 'windows',
          os_version: 'NT 10.0',
          device_id: crypto.randomUUID(),
          device_type: 'computer'
        }
      }
    },
    {
      headers: {
        ...BROWSER_HEADERS
      },
      validateStatus: () => true
    }
  )

  if (res.status !== 200) {
    logger.error(
      `Failed to get Spotify client token: ${res.status}`,
      'Spotify'
    )
    return
  }

  return res.data.granted_token.token
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    {},
    {
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      validateStatus: () => true
    }
  )

  if (res.status !== 200) return null

  return res.data.access_token
}

interface SpotifyTrackItem {
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
    href: string
    images: {
      url: string
      width: number
      height: number
    }[]
  }
  duration_ms: number
}

interface SpotifyEpisodeItem {
  name: string
  external_urls: {
    spotify: string
  }
  images: {
    url: string
    width: number
    height: number
  }[]
  show: {
    name: string
    publisher: string
    external_urls: {
      spotify: string
    }
    href: string
    images: {
      url: string
      width: number
      height: number
    }[]
  }
  duration_ms: number
}

export interface SpotifyCurrentPlayingResponse {
  context: {
    external_urls: {
      spotify: string
    }
    href: string
    type: string
    uri: string
  }
  timestamp: number
  progress_ms: number
  currently_playing_type: 'track' | 'episode'
  is_playing: boolean
  item: SpotifyTrackItem | SpotifyEpisodeItem
}

export type FilteredSpotifyCurrentPlayingResponse =
  | { session: false }
  | {
      session: true
      playing: boolean
      name: string
      trackURL: string
      artists: {
        name: string
        url: string
      }[]
      album: {
        name: string
        url: string
      }
      covers: {
        url: string
        width: number
        height: number
      }[]
      duration: {
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

  const { is_playing, item, progress_ms, currently_playing_type } = data

  if (currently_playing_type === 'track') {
    const track = item as SpotifyTrackItem

    return {
      session: true,
      playing: is_playing,
      name: track.name,
      trackURL: track.external_urls.spotify,
      artists: track.artists.map(a => ({
        name: a.name,
        url: a.external_urls.spotify
      })),
      album: {
        name: track.album.name,
        url: track.album.external_urls.spotify
      },
      covers: track.album.images,
      duration: {
        current: progress_ms,
        total: track.duration_ms
      }
    }
  } else if (currently_playing_type === 'episode') {
    const episode = item as SpotifyEpisodeItem

    return {
      session: true,
      playing: is_playing,
      name: episode.name,
      trackURL: episode.external_urls.spotify,
      artists: [
        {
          name: episode.show.name,
          url: episode.show.external_urls.spotify
        }
      ],
      album: {
        name: episode.show.name,
        url: episode.show.external_urls.spotify
      },
      covers: episode.images,
      duration: {
        current: progress_ms,
        total: episode.duration_ms
      }
    }
  } else {
    return { session: false }
  }
}

class Spotify extends EventEmitter {
  private sp_dc: string | null = null
  private clientId: string | null = null
  private clientSecret: string | null = null
  private refreshToken: string | null = null

  private ws: WebSocket | null = null

  accessToken: string | null = null
  private webToken: string | null = null
  private clientToken: string | null = null

  private retriedLogin = false

  instance: AxiosInstance = axios.create({
    baseURL: 'https://api.spotify.com/v1',
    validateStatus: () => true
  })

  webInstance: AxiosInstance = axios.create({
    headers: {
      ...BROWSER_HEADERS
    },
    validateStatus: () => true
  })

  constructor() {
    super()

    this.instance.interceptors.request.use(config => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`
      }

      return config
    })

    this.instance.interceptors.response.use(async res => {
      if (res.status === 401) {
        logger.info('Refreshing token...', 'Spotify')
        this.accessToken = await refreshAccessToken(
          this.clientId!,
          this.clientSecret!,
          this.refreshToken!
        ).catch(err => {
          this.emit('error', err)
          return null
        })

        if (!this.accessToken) return res
        return this.instance!(res.config)
      }

      return res
    })

    this.webInstance.interceptors.request.use(config => {
      if (this.webToken && this.clientToken) {
        config.headers.Authorization = `Bearer ${this.webToken}`
        config.headers['client-token'] = this.clientToken
      }

      return config
    })

    this.webInstance.interceptors.response.use(async response => {
      if (response.status === 401) {
        if (this.retriedLogin) {
          logger.error('Spotify re-authentication failed', 'Spotify')
          this.retriedLogin = false
          return response
        }

        logger.info(
          'Spotify token expired, re-authenticating...',
          'Spotify'
        )
        await this.loginWeb()
        this.retriedLogin = true
        const request = response.config
        return this.webInstance.request(request)
      } else if (response.status >= 400 && response.status < 600) {
        logger.warn(
          `Spotify API returned status ${response.status} for ${response.config.url}`,
          'Spotify'
        )
      }

      this.retriedLogin = false

      return response
    })

    this.on('DEVICE_STATE_CHANGED', async e => {
      if (!e.active_device_id) {
        this.emit('update', {
          session: false
        })
      }

      if (e.player_state) {
        const current = await this.getCurrent()
        if (current.session) {
          logger.debug(
            `Player state updated: ${current.name} (${
              current.playing ? 'playing' : 'paused'
            })`,
            'Spotify'
          )
        } else {
          logger.debug('No active Spotify session', 'Spotify')
        }
        this.emit('update', current)
      }
    })

    this.on('DEVICES_DISAPPEARED', e => {
      if (!e.active_device_id) {
        this.emit('update', {
          session: false
        })
      }
    })

    this.on('ready', () => {
      logger.info('Socket is ready!', 'Spotify')
    })

    this.on('error', err => {
      logger.error(`Error: ${err.message}`, 'Spotify')
    })

    this.on('close', () => {
      logger.warn('Socket closed, reconnecting...', 'Spotify')
      this.setup().catch(() => {})
    })
  }

  async setup({
    sp_dc,
    clientId,
    clientSecret,
    refreshToken
  }: {
    sp_dc?: string
    clientId?: string
    clientSecret?: string
    refreshToken?: string
  } = {}) {
    if (this.ws) this.cleanup()

    sp_dc = sp_dc || this.sp_dc!
    clientId = clientId || this.clientId!
    clientSecret = clientSecret || this.clientSecret!
    refreshToken = refreshToken || this.refreshToken!

    if (!sp_dc) {
      logger.error('sp_dc not set', 'Spotify')
      return
    }

    if (!clientId || !clientSecret || !refreshToken) {
      logger.error('Spotify client credentials not set', 'Spotify')
      return
    }

    this.sp_dc = sp_dc
    this.clientId = clientId || null
    this.clientSecret = clientSecret || null
    this.refreshToken = refreshToken || null

    this.ws = null

    await this.login()
    await this.loginWeb()

    logger.debug('Connecting to Spotify WebSocket...', 'Spotify')

    this.ws = new WebSocket(
      `wss://dealer.spotify.com/?access_token=${this.webToken}`,
      {
        headers: {
          ...SOCKET_HEADERS
        }
      } as WebSocket.ClientOptions
    )

    const ping = () => this.ws!.send('{"type":"ping"}')

    let pingInterval: NodeJS.Timeout | undefined

    this.ws.on('open', () => {
      ping()
      pingInterval = setInterval(ping, 15000)
    })

    this.ws.on('message', async d => {
      const msg = safeParse(d.toString())
      if (!msg) return

      if (msg.headers?.['Spotify-Connection-Id']) {
        await this.subscribe(msg.headers['Spotify-Connection-Id'])
          .then(() => this.emit('ready'))
          .catch(err => this.emit('error', err))
        return
      }

      const event = msg.payloads?.[0]
      if (!event) return

      logger.debug(`Received event: ${event.update_reason}`, 'Spotify')
      this.emit(event.update_reason, event.cluster)
    })

    this.ws.on('close', () => {
      if (pingInterval) {
        clearInterval(pingInterval)
        pingInterval = undefined
      }

      this.emit('close')
    })

    this.ws.on('error', err => {
      this.emit('error', err)
      this.emit('close')
    })
  }

  async loginWeb() {
    if (!this.sp_dc) {
      logger.error('sp_dc not set', 'Spotify')
      return
    }
    this.webToken = null
    this.clientToken = null

    logger.debug('Logging in to Spotify...', 'Spotify')
    const token = await getToken(this.sp_dc)
    if (!token) return
    this.webToken = token.accessToken

    logger.debug('Obtaining Spotify client token...', 'Spotify')
    const clientToken = await getClientToken(token.clientId)
    if (!clientToken) return
    this.clientToken = clientToken
  }

  async login() {
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      logger.error('Spotify client credentials not set', 'Spotify')
      return
    }

    this.accessToken = null

    logger.debug('Logging in to Spotify API...', 'Spotify')
    const accessToken = await refreshAccessToken(
      this.clientId,
      this.clientSecret,
      this.refreshToken
    )
    if (!accessToken) return
    this.accessToken = accessToken
  }

  async subscribe(connectionId: string) {
    const deviceId = random(40)

    logger.debug(`Creating device with ID ${deviceId}`, 'Spotify')

    const deviceRes = await this.webInstance.post(
      'https://gew4-spclient.spotify.com/track-playback/v1/devices',
      {
        device: {
          brand: 'spotify',
          capabilities: {
            change_volume: true,
            enable_play_token: true,
            supports_file_media_type: true,
            play_token_lost_behavior: 'pause',
            disable_connect: true,
            audio_podcasts: true,
            video_playback: true,
            manifest_formats: [
              'file_ids_mp3',
              'file_urls_mp3',
              'manifest_urls_audio_ad',
              'manifest_ids_video',
              'file_urls_external',
              'file_ids_mp4',
              'file_ids_mp4_dual',
              'manifest_urls_audio_ad'
            ],
            supports_preferred_media_type: true,
            supports_playback_offsets: true,
            supports_playback_speed: true
          },
          device_id: deviceId,
          device_type: 'computer',
          metadata: {},
          model: 'web_player',
          name: 'Web Player (Chrome)',
          platform_identifier:
            'web_player windows 10;chrome 142.0.0.0;desktop',
          is_group: false
        },
        outro_endcontent_snooping: false,
        connection_id: connectionId,
        client_version: `harmony:${HARMONY_CLIENT_VERSION}`,
        volume: 65535
      },
      {
        headers: {
          ...BROWSER_HEADERS
        }
      }
    )

    if (deviceRes.status !== 200) {
      logger.error(
        `Failed to create device: ${deviceRes.status}`,
        'Spotify'
      )
      return
    }

    logger.debug(
      `Updating connection state of device hobs_${deviceId.slice(0, 34)}`,
      'Spotify'
    )

    const connectRes = await this.webInstance.put(
      `https://gew4-spclient.spotify.com/connect-state/v1/devices/hobs_${deviceId.slice(
        0,
        34
      )}`,
      {
        member_type: 'CONNECT_STATE',
        device: {
          device_info: {
            capabilities: {
              can_be_player: false,
              hidden: true,
              needs_full_player_state: false
            }
          }
        }
      },
      {
        headers: {
          ...BROWSER_HEADERS,
          'X-Spotify-Connection-Id': connectionId
        }
      }
    )

    if (connectRes.status !== 200) {
      logger.error(
        `Failed to update device: ${connectRes.status}`,
        'Spotify'
      )
      return
    }
  }

  cleanup() {
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.close()
      this.ws = null
    }
  }

  async getCurrent(): Promise<FilteredSpotifyCurrentPlayingResponse> {
    const res = await this.instance!.get('/me/player', {
      params: {
        additional_types: 'episode'
      }
    })

    if (!res.data || res.status !== 200)
      return {
        session: false
      }

    return filterData(res.data)
  }
}

let spotify: Spotify | null = null
if (
  process.env.SPOTIFY_DC &&
  process.env.SPOTIFY_CLIENT_ID &&
  process.env.SPOTIFY_CLIENT_SECRET &&
  process.env.SPOTIFY_REFRESH_TOKEN
) {
  spotify = new Spotify()
  spotify.setup({
    sp_dc: process.env.SPOTIFY_DC,
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
  })
}

export default spotify
