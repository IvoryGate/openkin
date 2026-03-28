/**
 * 记忆检索
 */

import { LongTermMemory } from './LongTermMemory';
import { SearchQuery, SearchResult, RetrievalOptions, DEFAULT_RETRIEVAL_OPTIONS } from './types';
import { Memory } from './types';

export class MemoryRetrieval {
  constructor(private longTerm: LongTermMemory) {}

  async search(
    query: SearchQuery,
    options?: Partial<RetrievalOptions>
  ): Promise<SearchResult[]> {
    const {
      type,
      agentId,
      tags,
      minImportance,
      timeRange,
      limit = 10,
      useEmbedding = false,
      fuzzyMatch = true,
      timeWeight = 0.3,
      importanceWeight = 0.4
    } = { ...DEFAULT_RETRIEVAL_OPTIONS, ...options };

    // 获取候选记忆
    let candidates: Memory[];
    
    if (agentId) {
      candidates = await this.longTerm.getByAgent(agentId);
    } else if (type) {
      candidates = await this.longTerm.getByType(type);
    } else {
      candidates = await this.longTerm.getAll();
    }

    // 过滤条件
    if (type) {
      candidates = candidates.filter(m => m.type === type);
    }

    if (tags && tags.length > 0) {
      candidates = candidates.filter(m =>
        tags.some(tag => m.tags.includes(tag))
      );
    }

    if (minImportance) {
      candidates = candidates.filter(m => m.importance >= minImportance);
    }

    if (timeRange) {
      candidates = candidates.filter(m =>
        m.createdAt >= timeRange.start && m.createdAt <= timeRange.end
      );
    }

    // 计算相关度分数
    const results: SearchResult[] = candidates.map(memory => {
      const relevance = this.calculateRelevance(
        memory,
        query.query,
        timeWeight,
        importanceWeight
      );

      return { memory, relevance };
    });

    // 按相关度排序
    results.sort((a, b) => b.relevance - a.relevance);

    return results.slice(0, limit);
  }

  private calculateRelevance(
    memory: Memory,
    query: string,
    timeWeight: number,
    importanceWeight: number
  ): number {
    // 关键词匹配分数
    const keywordScore = this.calculateKeywordScore(memory.content, query);

    // 时间分数（最近的记忆分数更高）
    const now = Date.now();
    const ageInDays = (now - memory.createdAt) / (24 * 60 * 60 * 1000);
    const timeScore = Math.max(0, 1 - ageInDays / 365); // 1年内的记忆有分数

    // 重要性分数
    const importanceScore = memory.importance / 10;

    // 访问频率分数
    const accessScore = Math.min(1, memory.accessCount / 10);

    // 标签匹配分数
    const tagScore = this.calculateTagScore(memory.tags, query);

    // 综合分数
    const relevance =
      keywordScore * 0.3 +
      timeScore * timeWeight +
      importanceScore * importanceWeight +
      accessScore * 0.1 +
      tagScore * 0.1;

    return Math.min(1, Math.max(0, relevance));
  }

  private calculateKeywordScore(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);

    if (queryWords.length === 0) return 0;

    let matchCount = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        matchCount++;
      }
    }

    return matchCount / queryWords.length;
  }

  private calculateTagScore(tags: string[], query: string): number {
    const queryLower = query.toLowerCase();
    
    for (const tag of tags) {
      if (tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())) {
        return 1;
      }
    }

    return 0;
  }
}
