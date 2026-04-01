export interface ServerApiPlaceholder {
  healthcheck(): Promise<{ ok: true }>
}
