import type { ChatMessage, StreamChunk } from '../types/chat.js';

export interface ValidateKeyResult {
  ok: boolean;
  model?: string;
  error?: string;
}

export interface LLMClient {
  /**
   * 流式对话，返回 AsyncIterable<StreamChunk>
   * 最后一个 chunk 的 done === true
   */
  streamChat(messages: ChatMessage[]): AsyncIterable<StreamChunk>;

  /**
   * 验证 API Key 可用性
   */
  validateKey(): Promise<ValidateKeyResult>;
}
