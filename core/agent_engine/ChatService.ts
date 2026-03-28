import { nanoid } from 'nanoid';
import type { ChatMessage, StreamChunk } from './types/chat.js';
import { SoulService } from './SoulService.js';
import { ConfigService } from './ConfigService.js';
import { AgentService } from './AgentService.js';
import { MemoryService } from '../memory_system/MemoryService.js';

export interface StreamChatParams {
  agentId: string;
  userId?: string;
  userMessage: string;
  history: ChatMessage[];
}

export interface StreamChatResult {
  messageId: string;
  stream: AsyncIterable<StreamChunk>;
}

const MAX_HISTORY = 20;

export class ChatService {
  private memoryService?: MemoryService;

  constructor(
    private agentService: AgentService,
    private soulService: SoulService,
    private configService: ConfigService,
    memoryService?: MemoryService,
  ) {
    this.memoryService = memoryService;
  }

  /**
   * 设置记忆服务
   */
  setMemoryService(memoryService: MemoryService): void {
    this.memoryService = memoryService;
  }

  /**
   * 开始流式对话
   * @returns messageId 和 stream（AsyncIterable）
   */
  async startStreamChat(params: StreamChatParams): Promise<StreamChatResult> {
    const { agentId, userId = 'user_default', userMessage, history } = params;

    // 生成会话ID
    const sessionId = this.generateSessionId(agentId, userId);

    // 1. 存储用户消息到记忆系统
    if (this.memoryService) {
      await this.memoryService.addMessage(sessionId, agentId, userId, 'user', userMessage);
    }

    // 2. 确认 Agent 存在
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`AGENT_NOT_FOUND:${agentId}`);
    }

    // 3. 搜索相关记忆
    let relevantMemories: any[] = [];
    if (this.memoryService) {
      relevantMemories = await this.memoryService.searchMemories({
        query: userMessage,
        agentId,
        limit: 5
      });
    }

    // 4. 读取并解析 soul.md
    const soulContent = await this.soulService.getSoulContent(agentId);
    const soul = soulContent
      ? this.soulService.parseSoul(soulContent)
      : { systemPrompt: `你是${agent.name}，${agent.role}。` } as ReturnType<SoulService['parseSoul']>;

    // 5. 构建消息列表（system + 记忆上下文 + 最近 N 条历史 + 当前用户消息）
    const messages: ChatMessage[] = this.buildMessages(
      soul.systemPrompt,
      relevantMemories,
      history,
      userMessage
    );

    // 6. 获取 LLM 客户端
    const llmClient = await this.configService.getLLMClient();

    const messageId = `msg_${nanoid(8)}`;

    // 7. 创建包装的流，在响应完成后存储到记忆
    const stream = this.createMemoryAwareStream(
      llmClient.streamChat(messages),
      sessionId,
      agentId,
      userId
    );

    return {
      messageId,
      stream,
    };
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(agentId: string, userId: string): string {
    return `sess_${agentId}_${userId}_${Date.now()}`;
  }

  /**
   * 构建消息列表
   */
  private buildMessages(
    systemPrompt: string | undefined,
    relevantMemories: any[],
    history: ChatMessage[],
    userMessage: string
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System Prompt
    messages.push({
      role: 'system',
      content: systemPrompt || '你是一个AI助手。',
    });

    // 添加相关记忆作为上下文
    if (relevantMemories.length > 0) {
      const memoryContext = relevantMemories
        .map((r: any) => r.memory.content)
        .join('\n');
      
      messages.push({
        role: 'system',
        content: `[相关记忆]\n${memoryContext}`,
      });
    }

    // 添加历史消息
    messages.push(...history.slice(-MAX_HISTORY));

    // 当前用户消息
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * 创建记忆感知的流
   */
  private async *createMemoryAwareStream(
    originalStream: AsyncIterable<StreamChunk>,
    sessionId: string,
    agentId: string,
    userId: string
  ): AsyncGenerator<StreamChunk> {
    let fullResponse = '';

    try {
      for await (const chunk of originalStream) {
        fullResponse += chunk.content;
        yield chunk;
      }

      // 响应完成后存储到记忆
      if (this.memoryService && fullResponse) {
        await this.memoryService.addMessage(sessionId, agentId, userId, 'assistant', fullResponse);
      }
    } catch (error) {
      console.error('流式对话出错:', error);
      throw error;
    }
  }
}
