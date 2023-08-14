import { Client, GatewayIntentBits, Events } from 'discord.js'
import { setPresence } from './presence.js'
import log from './log.js'

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences]
})

client.on(Events.PresenceUpdate, (e, presence) => {
  if (!presence) return
  if (presence.user.id !== process.env.DISCORD_USER_ID) return
  setPresence(presence)
})

client.on(Events.ClientReady, async e => {
  log(`Logged in as ${e.user.tag}`, 'Discord')

  const members = await Promise.all(client.guilds.cache.map(g => g.members.fetch(process.env.DISCORD_USER_ID)))
  const member = members.find(m => m.id === process.env.DISCORD_USER_ID)

  if (!member) {
    log(`User with ID ${process.env.DISCORD_USER_ID} does not share a server with the bot!`, 'Discord')
    return client.destroy()
  }

  setPresence(member.presence)
  log(`Cached user ${member.user.globalName}`, 'Discord')
})

export default client
