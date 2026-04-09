/** Frozen in docs/architecture-docs-for-agent/first-layer/CHANNELS.md — do not rename without a governance pass. */
export type ChannelAccountStatus =
  | 'created'
  | 'authenticating'
  | 'active'
  | 'degraded'
  | 'stopped'
  | 'logged_out'
  | 'error'

export interface ChannelAccount {
  id: string
  platform: string
  status: ChannelAccountStatus
}

/**
 * Normalized inbound from a platform. `sessionKey` is the stable mapping key
 * (e.g. `${platformId}:${externalThreadId}`) used to derive an internal `sessionId` via `ChannelManager`.
 */
export interface InboundEvent {
  accountId: string
  sessionKey: string
  text: string
}

export interface OutboundMessage {
  accountId: string
  sessionKey: string
  text: string
}
