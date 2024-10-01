import axios from 'axios'
import sharp from 'sharp'

let imageBuffer
let imageSize
let lastFetch

async function fetchImage() {
  const res = await axios.get(process.env.AVATAR_URL, {
    responseType: 'arraybuffer'
  })
  imageSize = (await sharp(res.data).metadata()).width
  imageBuffer = res.data
  lastFetch = Date.now()
}

async function sizeImage(size = 256) {
  return await sharp(imageBuffer)
    .resize({ width: size, height: size })
    .toBuffer()
}

export const method = 'get'
export const name = '/avatar'

export const handler = async (req, res, next) => {
  if (!process.env.AVATAR_URL) return next()
  const size = parseInt(req.query.size) || null
  // TTL of 12 hour
  if (!imageBuffer || lastFetch + 12 * 60 * 60 * 1000 <= Date.now())
    await fetchImage()
  if (size > imageSize) return res.send('Size too large')
  res.contentType(
    `image/${
      process.env.AVATAR_URL.split('.')?.pop()?.toLowerCase() || 'png'
    }`
  )
  res.send(Buffer.from(await sizeImage(size), 'binary'))
}
