const express = require('express')
const cors = require('cors')
const fs = require('fs')

const bot = require('./lib/bot')
const log = require('./lib/log')

require('dotenv').config()

const endpoints = fs.readdirSync('./endpoints').filter(f => f.endsWith('.js'))

const app = express()

app.use(express.json())
app.use(
  cors({
    origin: '*'
  })
)

app.get('/', (req, res) => {
  res.send('sup')
})

for (i in endpoints) {
  const endpoint = require(`./endpoints/${endpoints[i]}`)
  app[endpoint.method](endpoint.name, endpoint.handler)
}

app.use((req, res) => {
  res.status(404).send('Not Found')
})

app.use((err, req, res, next) => {
  log(`Error: ${err}`, 'Server')
  res.status(500).send('Internal Server Error')
})

const port = process.env.PORT || 1337

app.listen(port, () => {
  log(`Listening on port ${port}`, 'Server')
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_USER_ID) bot.login(process.env.DISCORD_BOT_TOKEN)
})
