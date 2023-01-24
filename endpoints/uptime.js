const fs = require('fs')
require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/uptime',
  description: 'Get uptime of the API.',
  handler: (req, res) => {
    const start = parseInt(fs.readFileSync('./start.txt'))
    const time = new Date()
    return res.status(200).json({
      uptime: ((time - start) / 1000).toFixed(2),
      unit: 'seconds'
    })
  }
}
