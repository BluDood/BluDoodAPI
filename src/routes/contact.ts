import axios from 'axios'
import { EmbedBuilder } from 'discord.js'
import { NextFunction, Request, Response } from 'express'
import { contactSchema } from '../lib/schemas.js'

const { DISCORD_WEBHOOK, DISCORD_USER_ID } = process.env

export async function post(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!DISCORD_WEBHOOK) return next()

  const parsed = contactSchema.safeParse(req.body)
  if (!parsed.success)
    return res.status(400).json({ message: 'Bad Request' })
  const { name, email, message } = parsed.data

  const embed = new EmbedBuilder()
    .setTitle(`${name} <${email}>`)
    .setDescription(message)
    .setColor('#0064FF')

  const hook = await axios.post(
    DISCORD_WEBHOOK,
    {
      embeds: [embed],
      content: DISCORD_USER_ID ? `<@${DISCORD_USER_ID}>` : ''
    },
    {
      validateStatus: () => true
    }
  )
  if (hook.status !== 204)
    return res.status(500).send('An unknown error occorred.')

  return res.send('Success')
}
