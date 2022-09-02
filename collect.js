const fs = require('fs')
require('dotenv').config()

module.exports = async req => {
  if (process.env.STATISTICS_ENABLED == 'false') return
  const enabled = process.env.STATISTICS_TYPES.split(',')

  // create stats file if it does not exist
  if (!fs.existsSync('./stats.json')) fs.writeFileSync('./stats.json', '{}')
  const stats = JSON.parse(fs.readFileSync('./stats.json'))

  // increment requests
  if (enabled.includes('requests_count')) {
    if (!stats.requests) stats.requests = 0
    stats.requests++
  }

  // get hash of ip
  if (enabled.includes('ip_hash')) {
    const ip = req.headers['x-forwarded-for'] || req.ip.slice(req.ip.lastIndexOf(':') + 1)
    const hash = require('crypto').createHash('sha256').update(ip).digest('hex')
    if (!stats.ips) stats.ips = {}
    if (!stats.ips[hash]) stats.ips[hash] = 0
    stats.ips[hash]++
  }

  // save stats
  fs.writeFileSync('./stats.json', JSON.stringify(stats))
}
