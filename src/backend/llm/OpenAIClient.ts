import OpenAI from 'openai';
import type { ChatMessage, StreamChunk } from '../types/chat.js';
import type { LLMClient, ValidateKeyResult } from './LLMClient.js';

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? '';
      const finishReason = chunk.choices[0]?.finish_reason;

      if (content) {
        yield { content, done: false };
      }
      if (finishReason === 'stop') {
        yield { content: '', done: true };
        return;
      }
    }
    // 如果流结束但没有 finish_reason === 'stop'，也补发 done
    yield { content: '', done: true };
  }

  async validateKey(): Promise<ValidateKeyResult> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const models = await this.client.models.list({ signal: controller.signal });
      clearTimeout(timer);
      return { ok: true, model: models.data[0]?.id };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    }
  }
}
