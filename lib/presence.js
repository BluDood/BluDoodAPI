let _presence = null

function setPresence(presence) {
  if (!presence) return
  
  const filtered_activities = ['Spotify', 'Custom Status']
  const activities = presence.activities.filter(a => !filtered_activities.includes(a.name))

  const { status } = presence
  const { username, discriminator, id, avatar } = presence.user
  const isMobile = presence.clientStatus?.mobile !== undefined

  _presence = {
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
  }
}

function getPresence() {
  return _presence
}

module.exports = {
  setPresence,
  getPresence
}
