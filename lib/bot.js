const fs = require('fs')
const { Client, GatewayIntentBits, Events } = require('discord.js')

const client = new Client({
  intents: [GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers]
})

client.on(Events.PresenceUpdate, (e, presence) => {
  if (!presence) return
  if (presence.user.id !== process.env.DISCORD_USER_ID) return

  const filtered_activities = ['Spotify', 'Custom Status']
  const activities = presence.activities.filter(a => !filtered_activities.includes(a.name))

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
  if (!user) {
    console.log(`User with ID ${process.env.DISCORD_USER_ID} was not found!`)
    return client.destroy()
  }
  const { username, discriminator, id, avatar } = user
  if (!client.guilds.cache.some(async u => (await u.members.list()).has(id))) {
    client.destroy()
    return console.log(
      `${user.tag} does not share a server with the bot! Please use this link to add it to a server, and then restart the API:\nhttps://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=0&scope=bot`
    )
  }

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

module.exports = client
