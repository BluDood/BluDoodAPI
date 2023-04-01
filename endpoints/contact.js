const { default: axios } = require('axios')

require('dotenv').config()

module.exports = {
  method: 'post',
  name: '/contact',
  description: 'Send me a message.',
  handler: async (req, res, next) => {
    if (!process.env.DISCORD_WEBHOOK) return next()
    const {name, email, message} = req.body
    const hook = await axios.post(process.env.DISCORD_WEBHOOK, {
      embeds: [{
        title: `${name} <${email}>`,
        description: message,
        color: 25855
      }]
    }, {
        validateStatus: false
    })
    if (hook.status !== 204) return res.status(500).send("An unknown error occorred.")
    
    return res.send("Success")
  }
}
