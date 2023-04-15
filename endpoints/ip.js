require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/ip',
  description: 'Get your IP address.',
  handler: async (req, res) => {
    return res.send(req.headers['x-forwarded-for'] || req.ip)
  }
}
