const express = require('express')
const cors = require('cors')
const fs = require('fs')
const bot = require('./lib/bot')

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
  console.log(err)
  res.status(500).send('Internal Server Error')
})

app.listen(process.env.PORT || 1337, () => {
  console.log(`API started!\nhttp://localhost:${process.env.PORT || 1337}`)
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_USER_ID) bot.login(process.env.DISCORD_BOT_TOKEN)
})
