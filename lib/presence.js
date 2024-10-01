import { EventEmitter } from 'events'

class PresenceHandler extends EventEmitter {
  constructor() {
    super()
    this.presence = null
  }

  set(presence) {
    if (!presence) return

    const filtered_activities = ['Spotify', 'Custom Status']
    const activities = presence.activities.filter(a => !filtered_activities.includes(a.name))

    const { status } = presence
    const { username, globalName, id, avatar } = presence.user
    const isMobile = presence.clientStatus?.mobile !== undefined

    this.presence = {
      user: {
        username,
        globalName,
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
    }

    this.emit('update', this.presence)
  }

  get() {
    return this.presence
  }
}

const presenceHandler = new PresenceHandler()

export default presenceHandler
