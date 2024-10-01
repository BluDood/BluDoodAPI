import { Request, Response } from 'express'

export async function get(req: Request, res: Response) {
  return res.send(req.headers['x-forwarded-for'] || req.ip)
}
