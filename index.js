const express = require('express')
const cors = require('cors')
const fs = require('fs')
const endpoints = fs.readdirSync('./endpoints').filter(f => f.endsWith('.js'))
require('dotenv').config()

const app = express()
app.use(express.json())
app.use(
  cors({
    origin: '*'
  })
)

app.use(async (req, res, next) => {
  await require('./collect')(req)
  next()
})

app.get('/', (req, res) => {
  res.send('sup')
})

for (i in endpoints) {
  const endpoint = require(`./endpoints/${endpoints[i]}`)
  app[endpoint.method](endpoint.name, endpoint.handler)
}

app.use((req, res) => {
  res.status(404).send("i dunno man, this endpoint doesn't exist")
})

app.listen(process.env.PORT || 1337, () => {
  if (process.env.STATISTICS_TYPES.split(',').includes('uptime')) {
    if (!fs.existsSync('./stats.json')) fs.writeFileSync('./stats.json', '{}')
    const stats = JSON.parse(fs.readFileSync('./stats.json'))
    const time = Date.now()
    stats.start = time
    fs.writeFileSync('./stats.json', JSON.stringify(stats))
  }
  console.log('API is runnin yo\nhttp://localhost:1337\nhttps://api.bludood.com')
})
