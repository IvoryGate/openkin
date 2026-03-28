import { nanoid } from 'nanoid';
import type { ChatMessage, StreamChunk } from '../types/chat.js';
import { SoulService } from './SoulService.js';
import { ConfigService } from './ConfigService.js';
import { AgentService } from './AgentService.js';

export interface StreamChatParams {
  agentId: string;
  userMessage: string;
  history: ChatMessage[];
}

export interface StreamChatResult {
  messageId: string;
  stream: AsyncIterable<StreamChunk>;
}

const MAX_HISTORY = 20;

export class ChatService {
  constructor(
    private agentService: AgentService,
    private soulService: SoulService,
    private configService: ConfigService,
  ) {}

  /**
   * 开始流式对话
   * @returns messageId 和 stream（AsyncIterable）
   */
  async startStreamChat(params: StreamChatParams): Promise<StreamChatResult> {
    const { agentId, userMessage, history } = params;

    // 1. 确认 Agent 存在
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`AGENT_NOT_FOUND:${agentId}`);
    }

    // 2. 读取并解析 soul.md
    const soulContent = await this.soulService.getSoulContent(agentId);
    const soul = soulContent
      ? this.soulService.parseSoul(soulContent)
      : { systemPrompt: `你是${agent.name}，${agent.role}。` } as ReturnType<SoulService['parseSoul']>;

    // 3. 构建消息列表（system + 最近 N 条历史 + 当前用户消息）
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: soul.systemPrompt || `你是${agent.name}，${agent.role}。`,
      },
      ...history.slice(-MAX_HISTORY),
      { role: 'user', content: userMessage },
    ];

    // 4. 获取 LLM 客户端
    const llmClient = await this.configService.getLLMClient();

    const messageId = `msg_${nanoid(8)}`;

    return {
      messageId,
      stream: llmClient.streamChat(messages),
    };
  }
}
