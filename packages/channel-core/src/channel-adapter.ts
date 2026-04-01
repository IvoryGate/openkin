import type { OutboundMessage } from './types.js'

/** One IM platform integration; sends assistant output back to the platform transport. */
export interface ChannelAdapter {
  readonly id: string
  readonly platformId: string
  sendOutbound(message: OutboundMessage): Promise<void>
}

/** Test double: records outbound messages in memory (exec-plan 006). */
export class MockChannelAdapter implements ChannelAdapter {
  readonly id = 'mock-adapter'
  readonly platformId = 'mock'
  readonly recorded: OutboundMessage[] = []

  async sendOutbound(message: OutboundMessage): Promise<void> {
    this.recorded.push({ ...message })
  }
}
