const fs = require('fs')
require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/discord',
  description: 'Get my current status on Discord.',
  handler: (req, res, next) => {
    if (!fs.existsSync('./discord.json')) return next()
    const status = fs.readFileSync('./discord.json')
    return res.status(200).send(JSON.parse(status))
  }
}
