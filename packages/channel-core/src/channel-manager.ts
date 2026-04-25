import type { ChannelAdapter } from './channel-adapter.js'
import type { InboundEvent } from './types.js'
import { ChannelServiceGateway } from './service-gateway.js'

/**
 * Owns `sessionKey -> sessionId` mapping and routes inbound user text through the service gateway,
 * then delivers assistant text to the adapter as `OutboundMessage`.
 */
export class ChannelManager {
  private readonly sessionKeyToSessionId = new Map<string, string>()

  constructor(
    private readonly gateway: ChannelServiceGateway,
    private readonly adapter: ChannelAdapter,
  ) {}

  async dispatchInbound(event: InboundEvent): Promise<void> {
    let sessionId = this.sessionKeyToSessionId.get(event.sessionKey)
    if (!sessionId) {
      sessionId = await this.gateway.createSession()
      this.sessionKeyToSessionId.set(event.sessionKey, sessionId)
    }
    const reply = await this.gateway.runAndGetAssistantText(sessionId, event.text)
    await this.adapter.sendOutbound({
      accountId: event.accountId,
      sessionKey: event.sessionKey,
      text: reply,
    })
  }

  /** Exposed for tests / diagnostics only. */
  getSessionIdForKey(sessionKey: string): string | undefined {
    return this.sessionKeyToSessionId.get(sessionKey)
  }
}
