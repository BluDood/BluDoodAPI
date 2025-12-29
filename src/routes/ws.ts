import { Request } from 'express'
import presence, { FilteredPresence } from '../lib/presence.js'
import spotify, {
  FilteredSpotifyCurrentPlayingResponse
} from '../lib/spotify.js'

export async function ws(ws: WebSocket, req: Request) {
  const discordListener = (presence: FilteredPresence) =>
    ws.send(
      JSON.stringify({
        type: 'discord',
        data: presence
      })
    )

  const spotifyListener = (
    data: FilteredSpotifyCurrentPlayingResponse
  ) => {
    ws.send(
      JSON.stringify({
        type: 'spotify',
        data
      })
    )
  }

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
        data: await spotify.getCurrent()
      })
    )
    spotify.on('update', spotifyListener)
  }

  ws.addEventListener('close', () => {
    if (presence.get()) presence.off('update', discordListener)
    if (spotify) spotify.off('update', spotifyListener)
  })
}
