import { NextFunction, Request, Response } from 'express'
import spotify from '../lib/spotify.js'

export const method = 'get'
export const name = '/spotify'

export const handler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!spotify) return next()
  res.send(await spotify.getCurrent())
}
