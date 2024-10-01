import presence from '../lib/presence.js'
import spotify, { filterData } from '../lib/spotify.js'

export const method = 'ws'
export const name = '/ws'

export const handler = async (ws, req) => {
  const discordListener = presence =>
    ws.send(
      JSON.stringify({
        type: 'discord',
        data: presence
      })
    )

  const spotifyListener = data =>
    ws.send(
      JSON.stringify({
        type: 'spotify',
        data: filterData(data.state)
      })
    )

  if (presence.get()) presence.on('update', discordListener)
  if (process.env.SPOTIFY_DC)
    spotify.on('PLAYER_STATE_CHANGED', spotifyListener)

  ws.on('close', () => {
    if (presence.get()) presence.off('update', discordListener)
    if (process.env.SPOTIFY_DC)
      spotify.off('PLAYER_STATE_CHANGED', spotifyListener)
  })
}
