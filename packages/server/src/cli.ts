import { MockLLMProvider, InMemoryToolRuntime } from '@openkin/core'
import { createOpenKinHttpServer } from './http-server.js'

const port = Number(process.env.PORT ?? '3333')

const runtime = new InMemoryToolRuntime([])

const { server } = createOpenKinHttpServer({
  definition: {
    id: 'server',
    name: 'HTTP Server Agent',
    systemPrompt: 'You are a concise assistant.',
    maxSteps: 6,
  },
  llm: new MockLLMProvider(),
  toolRuntime: runtime,
})

server.listen(port, () => {
  console.error(`openkin server listening on http://127.0.0.1:${port}`)
})
