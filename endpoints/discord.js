import presenceHandler from '../lib/presence.js'

export const method = 'get'
export const name = '/discord'

export const handler = (req, res, next) => {
  const presence = presenceHandler.get()
  if (presence === null) return next()
  return res.status(200).send(presence)
}
