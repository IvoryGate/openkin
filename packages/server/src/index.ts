export { createOpenKinHttpServer, type CreateOpenKinHttpServerOptions, type OpenKinHttpServer } from './http-server.js'
export { TraceStreamHub } from './trace-stream-hub.js'
export { createSseStreamingHook } from './sse-hooks.js'

/** @deprecated Placeholder from pre-004; prefer `createOpenKinHttpServer`. */
export interface ServerApiPlaceholder {
  healthcheck(): Promise<{ ok: true }>
}
