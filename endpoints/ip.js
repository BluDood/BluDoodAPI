require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/ip',
  description: 'Get your IP address.',
  handler: async (req, res) => {
    return res.send(req.ip)
  }
}
