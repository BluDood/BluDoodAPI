import axios from 'axios'
import { NextFunction, Request, Response } from 'express'
import sharp from 'sharp'
import { getAvatarSchema } from '../lib/schemas.js'

let imageBuffer: Buffer
let imageSize: number
let lastFetch: number

async function fetchImage() {
  const res = await axios.get(process.env.AVATAR_URL!, {
    responseType: 'arraybuffer'
  })
  imageSize = (await sharp(res.data).metadata()).width!
  imageBuffer = res.data
  lastFetch = Date.now()
}

async function sizeImage(size = imageSize) {
  if (size >= imageSize) return imageBuffer
  return await sharp(imageBuffer)
    .resize({ width: size, height: size })
    .toBuffer()
}

export async function get(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!process.env.AVATAR_URL) return next()

  const parsed = getAvatarSchema.safeParse(req.query)
  if (!parsed.success)
    return res.status(400).json({ message: 'Bad Request' })
  const { size } = parsed.data

  // TTL of 12 hour
  if (!imageBuffer || lastFetch + 12 * 60 * 60 * 1000 <= Date.now())
    await fetchImage()

  res.contentType(
    `image/${
      process.env.AVATAR_URL.split('.')?.pop()?.toLowerCase() || 'png'
    }`
  )

  res.send(await sizeImage(size))
}
