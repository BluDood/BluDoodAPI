const fs = require('fs')
require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/discord',
  description: 'Get my current status on Discord.',
  handler: (req, res) => {
    const status = JSON.parse(fs.readFileSync('./discord.json'))
    return res.status(200).json(status)
  }
}
