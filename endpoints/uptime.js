require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/uptime',
  description: 'Get uptime of the API.',
  handler: (req, res) => {
    if (process.env.STATISTICS_ENABLED !== 'true') return res.send('Statistics are disabled.')
    if (!process.env.STATISTICS_TYPES.split(',').includes('uptime')) return res.send('Uptime is disabled.')
    const start = require('../stats.json').start / 1000
    const time = new Date() / 1000
    return res.status(200).json({
      uptime: (time - start).toFixed(2),
      unit: 'seconds'
    })
  }
}
