import type { Message, MessagePart, RunAttachmentInputDto, RunInputDto } from '@theworld/shared-contracts'

/** Prefix for rows that store JSON `Message['content']` (095 multimodal). */
export const STORED_MESSAGE_V1_PREFIX = 'theworld:msg:v1:'

export function isMultimodalStoredContent(raw: string): boolean {
  return raw.startsWith(STORED_MESSAGE_V1_PREFIX)
}

/**
 * Serialize user/assistant content for DB: plain string for single text part, else v1 JSON.
 */
export function serializeMessageContentForDb(parts: MessagePart[]): string {
  if (parts.length === 1 && parts[0]!.type === 'text') {
    return parts[0]!.text
  }
  return STORED_MESSAGE_V1_PREFIX + JSON.stringify({ parts })
}

/** Parse a DB `messages.content` cell into `MessagePart[]`. */
export function parseMessagePartsFromDb(raw: string): MessagePart[] {
  if (!raw.startsWith(STORED_MESSAGE_V1_PREFIX)) {
    return [{ type: 'text', text: raw }]
  }
  try {
    const j = JSON.parse(raw.slice(STORED_MESSAGE_V1_PREFIX.length)) as { parts?: unknown }
    if (Array.isArray(j.parts) && j.parts.length > 0) {
      return j.parts as MessagePart[]
    }
  } catch {
    /* fall through */
  }
  return [{ type: 'text', text: raw }]
}

export function rowToMessage(role: Message['role'], raw: string): Message {
  return { role, content: parseMessagePartsFromDb(raw) }
}

export function flattenMessageContent(msg: Message): string {
  const parts: string[] = []
  for (const p of msg.content) {
    if (p.type === 'text') {
      parts.push(p.text)
    } else if (p.type === 'json') {
      parts.push(JSON.stringify(p.value))
    } else if (p.type === 'image') {
      parts.push(`[image:${p.detail ?? 'auto'}] ${p.url}`)
    } else if (p.type === 'file_ref') {
      const name = p.name && p.name.length > 0 ? p.name : 'file'
      parts.push(`[file:${name}] ${p.ref}`)
    }
  }
  return parts.join('\n')
}

/**
 * 095: validate L3 `RunInputDto` and build the user `Message` for the agent run.
 */
export function runInputToUserMessage(
  input: RunInputDto | undefined,
):
  | { ok: true; userMessage: Message }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'input is required' }
  }
  if (typeof input.text !== 'string') {
    return { ok: false, error: 'input.text must be a string' }
  }
  if (input.attachments !== undefined) {
    if (!Array.isArray(input.attachments)) {
      return { ok: false, error: 'input.attachments must be an array' }
    }
    for (const a of input.attachments) {
      if (!a || typeof a !== 'object') {
        return { ok: false, error: 'invalid attachment entry' }
      }
      const att = a as RunAttachmentInputDto
      if (att.kind === 'image') {
        if (typeof att.url !== 'string' || att.url.trim() === '') {
          return { ok: false, error: 'image attachment requires non-empty url' }
        }
      } else if (att.kind === 'file') {
        if (typeof att.ref !== 'string' || att.ref.trim() === '') {
          return { ok: false, error: 'file attachment requires non-empty ref' }
        }
      } else {
        return { ok: false, error: 'attachment kind must be "image" or "file"' }
      }
    }
  }

  const content: Message['content'] = []
  if (input.text.length > 0) {
    content.push({ type: 'text', text: input.text })
  }
  for (const a of input.attachments ?? []) {
    if (a.kind === 'image') {
      content.push({
        type: 'image',
        url: a.url,
        mimeType: a.mimeType,
        detail: a.detail,
      })
    } else {
      content.push({
        type: 'file_ref',
        ref: a.ref,
        name: a.name,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })
    }
  }
  if (content.length === 0) {
    return { ok: false, error: 'input must include non-empty text and/or attachments' }
  }
  return { ok: true, userMessage: { role: 'user', content } }
}
