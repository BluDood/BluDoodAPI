import { NextFunction, Request, Response } from 'express'
import spotify from '../lib/spotify.js'

export async function get(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!spotify) return next()
  res.send(await spotify.getCurrent())
}
