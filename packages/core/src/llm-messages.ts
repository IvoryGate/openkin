import type { Message } from '@theworld/shared-contracts'

/**
 * Strip framework-only fields before sending to an LLM provider (208 / thesis §4).
 * Session / trace layers may attach `frameworkMeta`; it must never reach the model.
 */
export function toLlmMessages(messages: Message[]): Message[] {
  return messages.map((m) => {
    const { role, content, name } = m
    return { role, content, ...(name !== undefined ? { name } : {}) }
  })
}
