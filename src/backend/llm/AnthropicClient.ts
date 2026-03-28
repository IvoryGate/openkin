import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, StreamChunk } from '../types/chat.js';
import type { LLMClient, ValidateKeyResult } from './LLMClient.js';

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-3-5-haiku-latest') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<StreamChunk> {
    // Anthropic 要求 system 消息单独传入，不能放在 messages 数组里
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system: systemMsg?.content,
      messages: conversationMessages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { content: event.delta.text, done: false };
      }
      if (event.type === 'message_stop') {
        yield { content: '', done: true };
        return;
      }
    }
    yield { content: '', done: true };
  }

  async validateKey(): Promise<ValidateKeyResult> {
    try {
      const models = await this.client.models.list();
      return { ok: true, model: models.data[0]?.id };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    }
  }
}
