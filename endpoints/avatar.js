const { default: axios } = require('axios')
const sharp = require('sharp')

require('dotenv').config()

async function fetchImage() {
  const res = await axios.get(process.env.AVATAR_URL, { responseType: "arraybuffer" })
  imageSize = (await sharp(res.data).metadata()).width
  imageBuffer = res.data
  lastFetch = Date.now()
}

async function sizeImage(size = 256) {
  return await sharp(imageBuffer).resize({ width: size, height: size }).toBuffer()
}

let imageBuffer
let imageSize
let lastFetch

module.exports = {
  method: 'get',
  name: '/avatar',
  description: 'Get my avatar in a custom size.',
  handler: async (req, res, next) => {
    if (!process.env.AVATAR_URL) return next()
    const size = parseInt(req.query.size) || null
    // TTL of 1 hour
    if (!imageBuffer || lastFetch + 60 * 60 * 1000 <= Date.now() ) await fetchImage()
    if (size > imageSize) return res.send("Size too large")
    res.contentType(`image/${process.env.AVATAR_URL.split(".")?.pop()?.toLowerCase() || "png"}`)
    res.send(Buffer.from(await sizeImage(size), "binary"))
  }
}
