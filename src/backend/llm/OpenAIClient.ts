import OpenAI from 'openai';
import type { ChatMessage, StreamChunk } from '../types/chat.js';
import type { LLMClient, ValidateKeyResult } from './LLMClient.js';

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini', baseURL?: string) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
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
      // 用一条极短的 chat 请求验证 key，兼容 OpenAI 兼容协议（如 LongCat）
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      });
      return { ok: true, model: response.model };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    }
  }
}
