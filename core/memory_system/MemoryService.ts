/**
 * 记忆服务
 */

import { nanoid } from 'nanoid';
import { ShortTermMemory } from './ShortTermMemory';
import { LongTermMemory } from './LongTermMemory';
import { MemoryRetrieval } from './MemoryRetrieval';
import { ChatMessage, Memory, SearchQuery, SearchResult, RetrievalOptions } from './types';
import { writeJson, readJson, remove, existsSync } from '../../storage/FileStorage';

export class MemoryService {
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private retrieval: MemoryRetrieval;

  constructor() {
    this.shortTerm = new ShortTermMemory();
    this.longTerm = new LongTermMemory();
    this.retrieval = new MemoryRetrieval(this.longTerm);
  }

  // 存储消息
  async addMessage(
    sessionId: string,
    agentId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<string> {
    const message: ChatMessage = {
      id: `msg_${nanoid(8)}`,
      role,
      content,
      timestamp: Date.now()
    };
    
    await this.shortTerm.addMessage(sessionId, agentId, userId, message);
    
    // 检查是否需要归档
    await this.checkAndArchive(sessionId, agentId, userId, message);
    
    return message.id;
  }

  // 获取会话历史
  async getSessionHistory(
    sessionId: string,
    limit: number = 20
  ): Promise<ChatMessage[]> {
    return this.shortTerm.getSessionHistory(sessionId, limit);
  }

  // 添加长期记忆
  async addLongTermMemory(
    memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>
  ): Promise<string> {
    const fullMemory: Memory = {
      ...memory,
      id: `mem_${nanoid(8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now()
    };
    
    await this.longTerm.add(fullMemory);
    return fullMemory.id;
  }

  // 搜索记忆
  async searchMemories(
    query: SearchQuery,
    options?: Partial<RetrievalOptions>
  ): Promise<SearchResult[]> {
    return this.retrieval.search(query, options);
  }

  // 获取长期记忆
  async getLongTermMemory(memoryId: string): Promise<Memory | undefined> {
    return this.longTerm.get(memoryId);
  }

  // 获取Agent的所有长期记忆
  async getAgentMemories(agentId: string): Promise<Memory[]> {
    return this.longTerm.getByAgent(agentId);
  }

  // 更新长期记忆
  async updateLongTermMemory(
    memoryId: string,
    updates: Partial<Memory>
  ): Promise<void> {
    await this.longTerm.update(memoryId, updates);
  }

  // 删除长期记忆
  async deleteLongTermMemory(memoryId: string): Promise<void> {
    await this.longTerm.delete(memoryId);
  }

  // 归档消息到长期记忆
  private async checkAndArchive(
    sessionId: string,
    agentId: string,
    userId: string,
    message: ChatMessage
  ): Promise<void> {
    // 检查消息是否重要
    const importance = await this.assessImportance(message);
    
    if (importance >= 5) {
      // 将消息转换为长期记忆
      const memory: Memory = {
        id: `mem_${nanoid(8)}`,
        type: 'conversation',
        content: message.content,
        importance,
        tags: this.extractTags(message.content),
        createdAt: message.timestamp,
        updatedAt: Date.now(),
        accessCount: 1,
        lastAccessedAt: Date.now(),
        agentId,
        userId
      };
      
      await this.longTerm.add(memory);
    }
  }

  // 评估消息重要性
  private async assessImportance(message: ChatMessage): Promise<number> {
    const content = message.content.toLowerCase();
    
    // 简单规则评估
    const importantKeywords = [
      '喜欢', '讨厌', '偏好', '习惯',
      '记住', '重要', '关键',
      '我会', '我需要', '我想',
      'skill', 'preference', 'habit'
    ];

    let score = 3; // 基础分数

    // 检查重要关键词
    for (const keyword of importantKeywords) {
      if (content.includes(keyword)) {
        score += 2;
      }
    }

    // 长度因素
    if (message.content.length > 100) {
      score += 1;
    }

    // 限制在1-10之间
    return Math.min(10, Math.max(1, score));
  }

  // 提取标签
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const contentLower = content.toLowerCase();

    // 简单标签提取
    if (contentLower.includes('编程') || contentLower.includes('code')) {
      tags.push('coding');
    }
    if (contentLower.includes('写作') || contentLower.includes('writing')) {
      tags.push('writing');
    }
    if (contentLower.includes('研究') || contentLower.includes('research')) {
      tags.push('research');
    }
    if (contentLower.includes('喜欢') || contentLower.includes('偏好')) {
      tags.push('preference');
    }
    if (contentLower.includes('技能') || contentLower.includes('skill')) {
      tags.push('skill');
    }

    return tags;
  }
}
