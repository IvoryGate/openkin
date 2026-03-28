/**
 * 记忆检索类型定义
 */

import { Memory } from './memory';

export interface SearchQuery {
  query: string;
  type?: Memory['type'];
  agentId?: string;
  tags?: string[];
  minImportance?: number;
  timeRange?: {
    start: number;
    end: number;
  };
  limit?: number;
}

export interface SearchResult {
  memory: Memory;
  relevance: number; // 相关度分数，0-1
}

export interface RetrievalOptions {
  useEmbedding?: boolean; // 是否使用嵌入向量
  embeddingModel?: string;
  fuzzyMatch?: boolean; // 是否模糊匹配
  timeWeight?: number; // 时间权重，0-1
  importanceWeight?: number; // 重要性权重，0-1
}

export const DEFAULT_RETRIEVAL_OPTIONS: RetrievalOptions = {
  useEmbedding: false,
  fuzzyMatch: true,
  timeWeight: 0.3,
  importanceWeight: 0.4
};
