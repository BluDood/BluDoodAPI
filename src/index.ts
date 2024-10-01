import 'dotenv/config'

import express, { NextFunction, Request, Response } from 'express'
import ws, { WebsocketRequestHandler } from 'express-ws'
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

const endpoints = fs
  .readdirSync('./dist/endpoints')
  .filter(f => f.endsWith('.js'))

type Endpoint = {
  method: 'get' | 'post' | 'ws'
  name: string
  handler: express.RequestHandler | WebsocketRequestHandler
}

for (const i in endpoints) {
  const endpoint: Endpoint = await import(`./endpoints/${endpoints[i]}`)
  if (endpoint.method === 'ws') {
    app.ws(endpoint.name, endpoint.handler as WebsocketRequestHandler)
  } else {
    app[endpoint.method](
      endpoint.name,
      endpoint.handler as express.RequestHandler
    )
  }
}

app.use((req, res) => {
  res.status(404).send('Not Found')
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  log(`Error: ${err.message}`, 'Server')
  res.status(500).send('Internal Server Error')
})

const port = process.env.PORT || 1337

app.listen(port, () => {
  log(`Listening on port ${port}`, 'Server')
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_USER_ID)
    bot.login(process.env.DISCORD_BOT_TOKEN)
})
