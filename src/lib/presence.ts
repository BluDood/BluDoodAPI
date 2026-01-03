import { Presence } from 'discord.js'
import { EventEmitter } from 'events'

export interface FilteredPresence {
  user: {
    username: string
    globalName: string
    avatar: string
  }
  status: string
  activities: {
    name: string
    details: string | null
    state: string | null
    assets: {
      largeText: string | null | undefined
      smallText: string | null | undefined
      largeImage: string | null
      smallImage: string | null
    }
    timestamps: {
      start: number | null
      end: number | null
    }
  }[]
}

class PresenceHandler extends EventEmitter {
  presence: FilteredPresence | null

  constructor() {
    super()
    this.presence = null
  }

  set(presence: Presence) {
    if (!presence.user) return

    const filtered_activities = ['Spotify', 'Custom Status', 'Hang Status']
    const activities = presence.activities.filter(
      a => !filtered_activities.includes(a.name)
    )

    const { status } = presence
    const { username, globalName, id, avatar } = presence.user
    const isMobile = presence.clientStatus?.mobile !== undefined

    this.presence = {
      user: {
        username,
        globalName: globalName || username,
        avatar: `https://cdn.discordapp.com/avatars/${id}/${avatar}`
      },
      status: isMobile ? 'mobile' : status,
      activities: activities.map(
        ({ name, details, state, assets, timestamps, applicationId }) => {
          return {
            name,
            details,
            state,
            assets: {
              largeText: assets?.largeText,
              smallText: assets?.smallText,
              largeImage: assets?.largeImage
                ? `https://cdn.discordapp.com/app-assets/${applicationId}/${assets.largeImage}.png`
                : null,
              smallImage: assets?.largeImage
                ? `https://cdn.discordapp.com/app-assets/${applicationId}/${assets.smallImage}.png`
                : null
            },
            timestamps: {
              start: timestamps?.start
                ? new Date(timestamps?.start).getTime()
                : null,
              end: timestamps?.end
                ? new Date(timestamps?.end).getTime()
                : null
            }
          }
        }
      )
    }

    this.emit('update', this.presence)
  }

  get() {
    return this.presence
  }
}

const presenceHandler = new PresenceHandler()

export default presenceHandler
