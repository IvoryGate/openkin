/**
 * 长期记忆管理
 */

import { Memory, LongTermMemoryConfig, DEFAULT_LONGTERM_CONFIG } from './types';

export class LongTermMemory {
  private memories: Memory[] = [];
  private config: LongTermMemoryConfig;

  constructor(config?: Partial<LongTermMemoryConfig>) {
    this.config = {
      ...DEFAULT_LONGTERM_CONFIG,
      ...config
    };
  }

  async add(memory: Memory): Promise<void> {
    this.memories.push(memory);

    // 检查是否超过最大数量
    if (this.memories.length > this.config.maxMemories) {
      await this.cleanupOldMemories();
    }
  }

  async get(memoryId: string): Promise<Memory | undefined> {
    const memory = this.memories.find(m => m.id === memoryId);

    if (memory) {
      // 更新访问信息
      memory.accessCount++;
      memory.lastAccessedAt = Date.now();
    }

    return memory;
  }

  async getByAgent(agentId: string): Promise<Memory[]> {
    return this.memories
      .filter(m => m.agentId === agentId)
      .sort((a, b) => {
        // 先按重要性降序，再按最后访问时间降序
        if (b.importance !== a.importance) {
          return b.importance - a.importance;
        }
        return b.lastAccessedAt - a.lastAccessedAt;
      });
  }

  async update(memoryId: string, updates: Partial<Memory>): Promise<void> {
    const index = this.memories.findIndex(m => m.id === memoryId);

    if (index !== -1) {
      this.memories[index] = {
        ...this.memories[index],
        ...updates,
        updatedAt: Date.now()
      };
    }
  }

  async delete(memoryId: string): Promise<void> {
    this.memories = this.memories.filter(m => m.id !== memoryId);
  }

  async searchByKeywords(keywords: string[]): Promise<Memory[]> {
    const lowerKeywords = keywords.map(k => k.toLowerCase());

    return this.memories
      .filter(memory => {
        const content = memory.content.toLowerCase();
        const tags = memory.tags.map(t => t.toLowerCase());

        // 检查内容或标签是否包含关键词
        return lowerKeywords.some(keyword =>
          content.includes(keyword) || tags.includes(keyword)
        );
      })
      .sort((a, b) => {
        // 按相关度排序（简单实现）
        let aScore = 0;
        let bScore = 0;

        const aContent = a.content.toLowerCase();
        const aTags = a.tags.map(t => t.toLowerCase());
        const bContent = b.content.toLowerCase();
        const bTags = b.tags.map(t => t.toLowerCase());

        for (const keyword of lowerKeywords) {
          if (aContent.includes(keyword)) aScore += 2;
          if (aTags.includes(keyword)) aScore += 3;
          if (bContent.includes(keyword)) bScore += 2;
          if (bTags.includes(keyword)) bScore += 3;
        }

        if (bScore !== aScore) {
          return bScore - aScore;
        }

        // 同分按重要性和访问时间排序
        return b.importance - a.importance || b.lastAccessedAt - a.lastAccessedAt;
      });
  }

  private async cleanupOldMemories(): Promise<void> {
    // 按重要性和访问时间排序，删除最不重要的
    const sorted = [...this.memories].sort((a, b) => {
      // 先按重要性升序（小的先删除）
      if (a.importance !== b.importance) {
        return a.importance - b.importance;
      }
      // 同按最后访问时间升序（久未访问的先删除）
      return a.lastAccessedAt - b.lastAccessedAt;
    });

    // 删除最旧的10%
    const deleteCount = Math.floor(sorted.length * 0.1);
    const toDelete = sorted.slice(0, deleteCount).map(m => m.id);

    this.memories = this.memories.filter(m => !toDelete.includes(m.id));
  }
}
