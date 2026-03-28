import { nanoid } from 'nanoid';
import { z } from 'zod';
import { ensureDir, readJson, writeJson, listSubDirs } from '../storage/FileStorage.js';
import { agentDir, metaJsonPath, soulMdPath } from '../storage/paths.js';
import { SoulService } from './SoulService.js';
import type { Agent, AgentMeta, CreateAgentParams } from '../types/agent.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

const createAgentSchema = z.object({
  name: z.string().min(2, '名称至少 2 个字符').max(50, '名称最多 50 个字符'),
  role: z.string().max(100).optional().default(''),
  description: z.string().max(500).optional().default(''),
  templateId: z.enum(['general', 'tech', 'writer']).optional(),
  systemPrompt: z.string().optional(),
});

const TEMPLATES: Record<
  'general' | 'tech' | 'writer',
  { role: string; description: string; systemPrompt: string; communicationStyle: string }
> = {
  general: {
    role: '通用助手',
    description: '全能型助手，适合日常问答和通用任务',
    systemPrompt: '你是一个全能型AI助手，友好、高效，能处理各类问题。请用简洁清晰的方式回答用户的问题。',
    communicationStyle: '亲切友好',
  },
  tech: {
    role: '技术专家',
    description: '专注技术问题，擅长代码、架构和调试',
    systemPrompt: '你是一个资深技术专家，擅长编程、系统设计和技术分析。回答时请保持严谨，分步骤说明，必要时提供代码示例。',
    communicationStyle: '严谨专业',
  },
  writer: {
    role: '写作助手',
    description: '创意写作、文案优化和内容生成',
    systemPrompt: '你是一个专业写作助手，擅长各类文字创作。请根据用户需求提供高质量、有创意的文案，文笔流畅，表达精准。',
    communicationStyle: '富有创意',
  },
};

export class AgentService {
  constructor(private soulService: SoulService) {}

  /** 创建新 Agent */
  async createAgent(params: CreateAgentParams): Promise<Agent> {
    const parsed = createAgentSchema.safeParse(params);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join('; ');
      throw new ValidationError(msg);
    }

    const { name, role, description, templateId, systemPrompt } = parsed.data;

    // 合并模板
    const template = templateId ? TEMPLATES[templateId] : null;
    const finalRole = role || template?.role || '通用助手';
    const finalDescription = description || template?.description || '';
    const finalSystemPrompt = systemPrompt || template?.systemPrompt || `你是一个名叫${name}的AI助手，请尽力帮助用户。`;
    const finalStyle = template?.communicationStyle || '友好专业';

    const agentId = `agt_${nanoid(8)}`;
    const now = new Date().toISOString();

    // 创建目录
    ensureDir(agentDir(agentId));

    // 生成并写入 soul.md
    const soulContent = this.soulService.generateSoulMd({
      name,
      role: finalRole,
      description: finalDescription,
      systemPrompt: finalSystemPrompt,
      communicationStyle: finalStyle,
    });
    await this.soulService.saveSoulContent(agentId, soulContent);

    // 写入 meta.json
    const meta: AgentMeta = {
      id: agentId,
      name,
      role: finalRole,
      description: finalDescription,
      createdAt: now,
      templateId,
    };
    writeJson(metaJsonPath(agentId), meta);

    return {
      id: agentId,
      name,
      role: finalRole,
      description: finalDescription,
      createdAt: now,
      soulMdPath: soulMdPath(agentId),
    };
  }

  /** 获取单个 Agent，不存在返回 null */
  async getAgent(agentId: string): Promise<Agent | null> {
    const meta = readJson<AgentMeta>(metaJsonPath(agentId));
    if (!meta) return null;

    return {
      id: meta.id,
      name: meta.name,
      role: meta.role,
      description: meta.description,
      createdAt: meta.createdAt,
      soulMdPath: soulMdPath(agentId),
    };
  }

  /** 列出所有 Agent */
  async listAgents(): Promise<Agent[]> {
    const { AGENTS_DIR } = await import('../storage/paths.js');
    const ids = listSubDirs(AGENTS_DIR);
    const agents: Agent[] = [];
    for (const id of ids) {
      const agent = await this.getAgent(id);
      if (agent) agents.push(agent);
    }
    return agents.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
