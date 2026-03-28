/**
 * 记忆系统类型定义
 */

export type MemoryType = 'preference' | 'knowledge' | 'conversation' | 'context';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  importance: number; // 1-10, 10为最重要
  tags: string[];
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
  agentId: string;
  userId?: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  memoryId?: string; // 关联的记忆ID
}

export interface Session {
  sessionId: string;
  agentId: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface LongTermMemoryConfig {
  maxMemories: number; // 最大长期记忆数量，默认1000
  autoArchive: boolean; // 自动归档，默认true
  archiveThreshold: number; // 归档阈值，默认5（被引用5次后归档）
  retentionDays: number; // 保留天数，默认90天
}

export const DEFAULT_LONGTERM_CONFIG: LongTermMemoryConfig = {
  maxMemories: 1000,
  autoArchive: true,
  archiveThreshold: 5,
  retentionDays: 90
};
