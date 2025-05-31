import 'dotenv/config'

import express, { NextFunction, Request, Response } from 'express'
import createRouter from 'express-file-routing'
import ws from 'express-ws'
import cors from 'cors'
import path from 'path'

import bot from './lib/bot.js'
import log from './lib/log.js'

const app = express()
app.use(express.json())
app.use(cors())
ws(app)

app.get('/', (req, res) => {
  res.send('sup')
})

await createRouter(app, {
  additionalMethods: ['ws'],
  directory: path.join(process.cwd(), 'dist/routes')
})

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
