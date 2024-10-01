import 'dotenv/config'

import express from 'express'
import ws from 'express-ws'
import cors from 'cors'
import fs from 'fs'

import bot from './lib/bot.js'
import log from './lib/log.js'

const app = express()
app.use(express.json())
app.use(cors())
ws(app)

app.get('/', (req, res) => {
  res.send('sup')
})

const endpoints = fs.readdirSync('./endpoints').filter(f => f.endsWith('.js'))
for (const i in endpoints) {
  const endpoint = await import(`./endpoints/${endpoints[i]}`)
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
