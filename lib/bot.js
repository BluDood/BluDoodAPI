const { Client, GatewayIntentBits, Events } = require('discord.js')
const { setPresence } = require('./presence')

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences]
})

client.on(Events.PresenceUpdate, (e, presence) => {
  if (!presence) return
  if (presence.user.id !== process.env.DISCORD_USER_ID) return
  setPresence(presence)
})

client.on(Events.ClientReady, async e => {
  console.log(`Discord logged in as ${e.user.tag}!`)

  const members = await Promise.all(client.guilds.cache.map(g => g.members.fetch(process.env.DISCORD_USER_ID)))
  const member = members.find(m => m.id === process.env.DISCORD_USER_ID)

  if (!member) {
    console.log(`User with ID ${process.env.DISCORD_USER_ID} does not share a server with the bot!`)
    return client.destroy()
  }

  setPresence(member.presence)
  console.log(`Cached user ${member.user.tag}!`)
})

module.exports = client
