const axios = require('axios').default
require('dotenv').config()

const { SPOTIFY_REFRESH_TOKEN, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env

async function getToken() {
  const res = await axios({
    url: 'https://accounts.spotify.com/api/token',
    method: 'POST',
    params: {
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN
    },
    headers: {
      Authorization: `Basic ${new Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
  return res.data.access_token
}

let token

module.exports = {
  method: 'get',
  name: '/spotify',
  description: 'Get info about my currently playing track on Spotify.',
  handler: async (req, res, next) => {
    if (!SPOTIFY_REFRESH_TOKEN || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return next()

    const time = new Date() / 1000
    if (!token) token = await getToken()

    let spot = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      validateStatus: false
    })

    if (spot.status === 401) {
      token = await getToken()
      spot = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        validateStatus: false
      })
    }

    if (!spot.data)
      return res.send({
        session: false,
        time: (new Date() / 1000 - time).toFixed(3)
      })

    return res.status(200).json({
      session: true,
      time: (new Date() / 1000 - time).toFixed(3),
      playing: spot.data.is_playing,
      name: spot.data.item.name,
      trackURL: spot.data.item.external_urls.spotify,
      artists: spot.data.item.artists.map(a => ({ name: a.name, url: a.external_urls.spotify })),
      album: {
        name: spot.data.item.album.name,
        url: spot.data.item.album.href
      },
      covers: spot.data.item.album.images,
      duration: {
        current: spot.data.progress_ms,
        total: spot.data.item.duration_ms
      }
    })
  }
}
