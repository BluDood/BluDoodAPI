import spotify from '../lib/spotify.js'

export const method = 'get'
export const name = '/spotify'

export const handler = async (req, res, next) => {
  if (!process.env.SPOTIFY_DC) return next()
  res.send(await spotify.getCurrent())
}
