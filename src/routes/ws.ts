import { Request } from 'express'
import presence, { FilteredPresence } from '../lib/presence.js'
import spotify, {
  filterData,
  SpotifyCurrentPlayingResponse
} from '../lib/spotify.js'

export async function ws(ws: WebSocket, req: Request) {
  const discordListener = (presence: FilteredPresence) =>
    ws.send(
      JSON.stringify({
        type: 'discord',
        data: presence
      })
    )

  const spotifyListener = (data: {
    state: SpotifyCurrentPlayingResponse
  }) =>
    ws.send(
      JSON.stringify({
        type: 'spotify',
        data: filterData(data.state)
      })
    )

  if (presence.get()) {
    ws.send(
      JSON.stringify({
        type: 'discord',
        data: presence.get()
      })
    )
    presence.on('update', discordListener)
  }

  if (spotify) {
    ws.send(
      JSON.stringify({
        type: 'spotify',
        data: spotify.getCurrent()
      })
    )
    spotify.on('PLAYER_STATE_CHANGED', spotifyListener)
  }

  ws.addEventListener('close', () => {
    if (presence.get()) presence.off('update', discordListener)
    if (spotify) spotify.off('PLAYER_STATE_CHANGED', spotifyListener)
  })
}
