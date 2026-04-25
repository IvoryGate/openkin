export {
  createTheWorldHttpServer,
  type CreateTheWorldHttpServerOptions,
  type TheWorldHttpServer,
} from './http-server.js'
export { TraceStreamHub } from './trace-stream-hub.js'
export { createSseStreamingHook } from './sse-hooks.js'

/** @deprecated Placeholder from pre-004; prefer `createTheWorldHttpServer`. */
export interface ServerApiPlaceholder {
  healthcheck(): Promise<{ ok: true }>
}
