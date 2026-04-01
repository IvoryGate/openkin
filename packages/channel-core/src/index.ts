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
