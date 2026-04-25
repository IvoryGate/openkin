/**
 * Channel framework smoke: mock inbound -> ChannelManager -> HTTP service (004) -> MockChannelAdapter outbound.
 * Exec-plan 006 — must not import the core runtime package.
 */
import {
  ChannelManager,
  ChannelServiceGateway,
  MockChannelAdapter,
} from '../packages/channel-core/src/index.ts'

const base = process.env.THEWORLD_BASE_URL
if (!base) {
  console.error('THEWORLD_BASE_URL is required')
  process.exit(1)
}

const gateway = new ChannelServiceGateway({ baseUrl: base, sessionKind: 'channel' })
const adapter = new MockChannelAdapter()
const manager = new ChannelManager(gateway, adapter)

await manager.dispatchInbound({
  accountId: 'acc-smoke',
  sessionKey: 'mock:thread-smoke-1',
  text: 'hello from channel mock',
})

if (adapter.recorded.length !== 1) {
  throw new Error(`expected 1 outbound, got ${adapter.recorded.length}`)
}
const out = adapter.recorded[0]
if (!out.text || out.sessionKey !== 'mock:thread-smoke-1' || out.accountId !== 'acc-smoke') {
  throw new Error(`unexpected outbound: ${JSON.stringify(out)}`)
}

console.log('test:channels passed (inbound -> service gateway -> outbound).')
