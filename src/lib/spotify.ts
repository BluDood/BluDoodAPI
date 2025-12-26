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

  const totp = TOTP.generate(res.data.secret)

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

export interface SpotifyCurrentPlayingResponse {
  is_paused: boolean
  position_as_of_timestamp: string
  track: {
    uri: string
    metadata: ArtistNames &
      ArtistUris & {
        title: string
        album_title: string
        album_uri: string
        image_url: string
        image_small_url: string
        duration: string
      }
  }
}

type PrefixedNumericKeys<Prefix extends string> =
  | Prefix
  | `${Prefix}:${number}`

type ArtistKey = PrefixedNumericKeys<'artist_name'>
type ArtistNames = Partial<Record<ArtistKey, string>>

type ArtistUrisKey = PrefixedNumericKeys<'artist_uri'>
type ArtistUris = Partial<Record<ArtistUrisKey, string>>

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
  data: SpotifyCurrentPlayingResponse,
  lastUpdate = Number.MAX_SAFE_INTEGER
): FilteredSpotifyCurrentPlayingResponse {
  if (!data || !data.track) {
    return { session: false }
  }

  const { is_paused, track, position_as_of_timestamp } = data

  const TIMEOUT = 1000 * 60 * 10 // 10 minutes
  if (is_paused && lastUpdate <= Date.now() - TIMEOUT) {
    return { session: false }
  }

  const progress = parseInt(position_as_of_timestamp) || 0
  const duration = parseInt(track.metadata.duration) || 0

  const currentTime = Math.min(
    Math.max(
      !is_paused && lastUpdate < Date.now()
        ? progress + Math.floor(Date.now() - lastUpdate)
        : progress,
      0
    ),
    duration
  )

  const trackId = track.uri.split(':').pop()
  const albumId = track.metadata.album_uri.split(':').pop()

  const artists = Object.entries(track.metadata)
    .filter(([key]) => key.startsWith('artist_name'))
    .map(([key, name]) => {
      const index = key.includes(':') ? parseInt(key.split(':')[1]) : 0
      const uriKey = key.replace(
        'artist_name',
        'artist_uri'
      ) as ArtistUrisKey
      const uri = track.metadata[uriKey] || ''
      const artistId = uri.split(':').pop() || ''
      return { index, name: name ?? 'Unknown Artist', artistId }
    })
    .sort((a, b) => a.index - b.index)

  return {
    session: true,
    playing: !is_paused,
    name: track.metadata.title,
    trackURL: `https://open.spotify.com/track/${trackId}`,
    artists: artists.map(artist => ({
      name: artist.name,
      url: `https://open.spotify.com/artist/${artist.artistId}`
    })),
    album: {
      name: track.metadata.album_title,
      url: `https://open.spotify.com/album/${albumId}`
    },
    covers: [
      {
        url: track.metadata.image_url,
        width: 300,
        height: 300
      },
      {
        url: track.metadata.image_small_url,
        width: 64,
        height: 64
      }
    ],
    duration: {
      current: currentTime,
      total: duration
    }
  }
}

class Spotify extends EventEmitter {
  private sp_dc: string | null = null

  private ws: WebSocket | null = null
  private current: SpotifyCurrentPlayingResponse | null = null
  private lastUpdate: number = 0

  private token: string | null = null
  private clientToken: string | null = null

  private retriedLogin = false

  instance: AxiosInstance = axios.create({
    headers: {
      ...BROWSER_HEADERS
    },
    validateStatus: () => true
  })

  constructor() {
    super()

    this.instance.interceptors.request.use(config => {
      if (this.token && this.clientToken) {
        config.headers.Authorization = `Bearer ${this.token}`
        config.headers['client-token'] = this.clientToken
      }

      return config
    })

    this.instance.interceptors.response.use(async response => {
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
        await this.login()
        this.retriedLogin = true
        const request = response.config
        return this.instance.request(request)
      } else if (response.status >= 400 && response.status < 600) {
        logger.warn(
          `Spotify API returned status ${response.status} for ${response.config.url}`,
          'Spotify'
        )
      }

      this.retriedLogin = false

      return response
    })

    this.on('DEVICE_STATE_CHANGED', e => {
      if (!e.active_device_id) {
        this.emit('update', {
          session: false
        })
      }

      if (e.player_state) {
        this.current = e.player_state
        this.lastUpdate = Date.now()
        const current = this.getCurrent()
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

  async setup(sp_dc: string | null = null) {
    if (this.ws) this.cleanup()

    sp_dc = sp_dc || this.sp_dc!

    if (!sp_dc) {
      logger.error('sp_dc not set', 'Spotify')
      return
    }

    this.sp_dc = sp_dc
    this.ws = null

    await this.login()

    logger.debug('Connecting to Spotify WebSocket...', 'Spotify')

    this.ws = new WebSocket(
      `wss://dealer.spotify.com/?access_token=${this.token}`,
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

  async login() {
    if (!this.sp_dc) {
      logger.error('sp_dc not set', 'Spotify')
      return
    }
    this.token = null
    this.clientToken = null

    logger.debug('Logging in to Spotify...', 'Spotify')
    const token = await getToken(this.sp_dc)
    if (!token) return
    this.token = token.accessToken

    logger.debug('Obtaining Spotify client token...', 'Spotify')
    const clientToken = await getClientToken(token.clientId)
    if (!clientToken) return
    this.clientToken = clientToken
  }

  async subscribe(connectionId: string) {
    const deviceId = random(40)

    logger.debug(`Creating device with ID ${deviceId}`, 'Spotify')

    const deviceRes = await this.instance.post(
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

    const connectRes = await this.instance.put(
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

  getCurrent(): FilteredSpotifyCurrentPlayingResponse {
    if (!this.current)
      return {
        session: false
      }

    return filterData(this.current, this.lastUpdate)
  }
}

let spotify: Spotify | null = null
if (process.env.SPOTIFY_DC) {
  spotify = new Spotify()
  spotify.setup(process.env.SPOTIFY_DC)
}

export default spotify
