/**
 * 短期记忆管理
 */

import { ChatMessage, Session } from './types';

export class ShortTermMemory {
  private sessions: Map<string, Session> = new Map();
  private readonly MAX_MESSAGES_PER_SESSION = 20;
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24小时

  constructor() {}

  async addMessage(
    sessionId: string,
    agentId: string,
    userId: string,
    message: ChatMessage
  ): Promise<void> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        sessionId,
        agentId,
        userId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.sessions.set(sessionId, session);
    }

    session.messages.push(message);
    session.updatedAt = Date.now();

    // 限制消息数量
    if (session.messages.length > this.MAX_MESSAGES_PER_SESSION) {
      session.messages.shift(); // 移除最旧的消息
    }
  }

  async getSessionHistory(
    sessionId: string,
    limit: number = this.MAX_MESSAGES_PER_SESSION
  ): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return [];
    }

    return session.messages.slice(-limit);
  }

  async getRecentSessions(
    agentId: string,
    limit: number = 10
  ): Promise<Session[]> {
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.agentId === agentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

    return sessions;
  }

  async clearSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async clearExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now - session.updatedAt > this.SESSION_TIMEOUT) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.clearSession(sessionId);
    }
  }
}
