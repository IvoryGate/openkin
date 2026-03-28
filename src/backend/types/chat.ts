export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

// WebSocket 消息类型（客户端 → 服务端）
export interface WsChatRequest {
  type: 'chat';
  agentId: string;
  sessionId: string;
  message: string;
  history: ChatMessage[];
}

// WebSocket 消息类型（服务端 → 客户端）
export type WsServerMessage =
  | { type: 'token'; messageId: string; content: string }
  | { type: 'done'; messageId: string; usage?: { prompt_tokens: number; completion_tokens: number } }
  | { type: 'error'; code: string; message: string };
