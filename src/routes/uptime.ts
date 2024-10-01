import { Request, Response } from 'express'

export async function get(req: Request, res: Response) {
  return res.status(200).json({
    uptime: process.uptime().toFixed(2)
  })
}
