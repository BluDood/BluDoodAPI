const { Client, GatewayIntentBits, Events } = require('discord.js')
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

const client = new Client({
  intents: [GatewayIntentBits.GuildPresences]
})

client.on(Events.PresenceUpdate, (e, presence) => {
  if (!presence) return
  if (presence.user.id !== process.env.DISCORD_USER_ID) return

  const activities = presence.activities.filter(a => a.name !== 'Spotify')
  const { status } = presence
  const { username, discriminator, id, avatar } = presence.user
  const isMobile = presence.clientStatus?.mobile !== undefined

  fs.writeFileSync(
    './discord.json',
    JSON.stringify({
      user: {
        username,
        discriminator,
        avatar: `https://cdn.discordapp.com/avatars/${id}/${avatar}`
      },
      status: isMobile ? 'mobile' : status,
      activities: activities.map(({ name, details, state, assets, timestamps, applicationId }) => {
        return {
          name,
          details,
          state,
          assets: {
            largeText: assets?.largeText,
            smallText: assets?.smallText,
            largeImage: assets?.largeImage ? `https://cdn.discordapp.com/app-assets/${applicationId}/${assets.largeImage}.png` : null,
            smallImage: assets?.largeImage ? `https://cdn.discordapp.com/app-assets/${applicationId}/${assets.smallImage}.png` : null
          },
          timestamps: {
            start: timestamps?.start ? new Date(timestamps?.start).getTime() : null,
            end: timestamps?.end ? new Date(timestamps?.end).getTime() : null
          }
        }
      })
    })
  )
})

client.on(Events.ClientReady, async e => {
  console.log(`Discord logged in as ${e.user.tag}!`)
  const user = await client.users.fetch(process.env.DISCORD_USER_ID).catch(() => null)
  if (!user) return console.log(`User with ID ${process.env.DISCORD_USER_ID} was not found! Make sure the bot shares a server with the user.`)
  const { username, discriminator, id, avatar } = user
  fs.writeFileSync(
    './discord.json',
    JSON.stringify({
      user: {
        username,
        discriminator,
        avatar: `https://cdn.discordapp.com/avatars/${id}/${avatar}`
      }
    })
  )
  console.log(`Cached user ${user.tag}!`)
})

app.listen(process.env.PORT || 1337, () => {
  fs.writeFileSync('./start.txt', Date.now().toString())
  console.log(`API started!\nhttp://localhost:${process.env.PORT || 1337}`)
  if (process.env.DISCORD_BOT_TOKEN) client.login(process.env.DISCORD_BOT_TOKEN)
  else {
    console.log('Please set up environment variables for Discord.')
    if (fs.existsSync('./discord.json')) fs.rmSync('./discord.json')
  }
})
