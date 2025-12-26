import { Client, GatewayIntentBits, Events } from 'discord.js'
import presenceHandler from './presence.js'
import { logger } from './utils.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
})

client.on(Events.PresenceUpdate, (e, presence) => {
  if (!presence.user) return
  if (presence.user.id !== process.env.DISCORD_USER_ID) return
  presenceHandler.set(presence)
})

client.on(Events.ClientReady, async e => {
  logger.info(`Logged in as ${e.user.tag}`, 'Discord')

  const members = await Promise.all(
    client.guilds.cache.map(g =>
      g.members.fetch(process.env.DISCORD_USER_ID!)
    )
  )
  const member = members.find(m => m.id === process.env.DISCORD_USER_ID)

  if (!member) {
    logger.error(
      `User with ID ${process.env.DISCORD_USER_ID} does not share a server with the bot!`,
      'Discord'
    )
    return client.destroy()
  }

  if (member.presence) presenceHandler.set(member.presence)
  logger.info(`Cached user ${member.user.globalName}`, 'Discord')
})

export default client
