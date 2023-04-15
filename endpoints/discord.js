const { getPresence } = require('../lib/presence')
require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/discord',
  description: 'Get my current status on Discord.',
  handler: (req, res, next) => {
    const presence = getPresence()
    if (presence === null) return next()
    return res.status(200).send(presence)
  }
}
