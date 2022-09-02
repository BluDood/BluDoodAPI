const axios = require('axios').default
require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/spotify',
  description: 'Get info about my currently playing track on Spotify.',
  handler: async (req, res) => {
    const time = new Date() / 1000
    const { SPOTIFY_REFRESH_TOKEN, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env
    if (!SPOTIFY_REFRESH_TOKEN || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET)
      return res.send('Environment variables are not correctly set up')

    const token = (
      await axios({
        url: 'https://accounts.spotify.com/api/token',
        method: 'POST',
        params: {
          grant_type: 'refresh_token',
          refresh_token: SPOTIFY_REFRESH_TOKEN
        },
        headers: {
          Authorization: `Basic ${new Buffer.from(
            SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    ).data.access_token

    const { data } = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    
    if (!data)
      return res.send({
        session: false,
        time: (new Date() / 1000 - time).toFixed(3)
      })

    return res.status(200).json({
      session: true,
      time: (new Date() / 1000 - time).toFixed(3),
      playing: data.is_playing,
      name: data.item.name,
      trackURL: data.item.external_urls.spotify,
      artists: data.item.artists.map(a => ({ name: a.name, url: a.external_urls.spotify })),
      album: {
        name: data.item.album.name,
        url: data.item.album.href
      },
      covers: data.item.album.images,
      duration: {
        current: data.progress_ms,
        total: data.item.duration_ms
      }
    })
  }
}
