import { WebsocketRequestHandler } from 'express-ws'

declare global {
  namespace Express {
    interface Application {
      ws: (path: string, handler: WebsocketRequestHandler) => void
    }
  }
}

export {}
