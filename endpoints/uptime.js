require('dotenv').config()

module.exports = {
  method: 'get',
  name: '/uptime',
  description: 'Get uptime of the API.',
  handler: (req, res) => {
    return res.status(200).json({
      uptime: process.uptime().toFixed(2)
    })
  }
}
