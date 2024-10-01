import axios from 'axios'
import { NextFunction, Request, Response } from 'express'

export const method = 'post'
export const name = '/contact'

export const handler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!process.env.DISCORD_WEBHOOK) return next()
  const { name, email, message } = req.body
  const hook = await axios.post(
    process.env.DISCORD_WEBHOOK,
    {
      embeds: [
        {
          title: `${name} <${email}>`,
          description: message,
          color: 25855
        }
      ],
      content: process.env.DISCORD_USER_ID
        ? `<@${process.env.DISCORD_USER_ID}>`
        : ''
    },
    {
      validateStatus: () => true
    }
  )
  if (hook.status !== 204)
    return res.status(500).send('An unknown error occorred.')

  return res.send('Success')
}
