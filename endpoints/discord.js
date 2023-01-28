const fs = require('fs')
require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/discord',
  description: 'Get my current status on Discord.',
  handler: (req, res) => {
    let status
    try {
      status = fs.readFileSync('./discord.json')
    } catch (error) {}
    return res.status(200).send(JSON.parse(status ?? "{}"))
  }
}
