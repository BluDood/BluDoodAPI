const fs = require('fs')
require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/stats',
  description: 'Get stats of the API.',
  handler: (req, res) => {
    if (process.env.STATISTICS_ENABLED !== 'true') return res.send('Statistics are disabled.')
    if (
      !(
        process.env.STATISTICS_TYPES.split(',').includes('uptime') ||
        process.env.STATISTICS_TYPES.split(',').includes('requests_count')
      )
    )
      return res.send('No visible stats enabled.')
    const stats = JSON.parse(fs.readFileSync('./stats.json'))
    const time = new Date() / 1000
    return res.status(200).json({
      requests: stats.requests,
      uptime: (time - stats.start / 1000).toFixed(2)
    })
  }
}
