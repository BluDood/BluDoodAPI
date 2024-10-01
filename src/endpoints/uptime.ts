import { Request, Response } from 'express'

export const method = 'get'
export const name = '/uptime'

export const handler = (req: Request, res: Response) => {
  return res.status(200).json({
    uptime: process.uptime().toFixed(2)
  })
}
