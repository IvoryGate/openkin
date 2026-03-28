import { readText, writeText } from '../storage/FileStorage.js';
import { soulMdPath } from '../storage/paths.js';

export interface ParsedSoul {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  communicationStyle: string;
}

export interface GenerateSoulParams {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  communicationStyle?: string;
}

/**
 * 从 Markdown 文本中提取指定 ## 标题下的内容（到下一个 ## 为止）
 */
function extractSection(content: string, heading: string): string {
  const re = new RegExp(`^## ${heading}\\s*$`, 'm');
  const match = re.exec(content);
  if (!match) return '';

  const start = match.index + match[0].length;
  const rest = content.slice(start);
  // 取到下一个 ## 或文件结尾
  const nextHeading = rest.search(/^## /m);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return section.trim();
}

/**
 * 从 "- key: value" 格式的行中提取值
 */
function extractField(section: string, key: string): string {
  const re = new RegExp(`^-\\s+${key}:\\s*(.+)$`, 'm');
  const m = re.exec(section);
  return m ? m[1].trim() : '';
}

export class SoulService {
  /** 读取 soul.md 原始文本，不存在返回 null */
  async getSoulContent(agentId: string): Promise<string | null> {
    return readText(soulMdPath(agentId));
  }

  /** 写入 soul.md */
  async saveSoulContent(agentId: string, content: string): Promise<void> {
    writeText(soulMdPath(agentId), content);
  }

  /** 解析 soul.md 文本为结构化对象 */
  parseSoul(content: string): ParsedSoul {
    const basicSection = extractSection(content, '基本信息');
    const styleSection = extractSection(content, '人格与风格');
    const promptSection = extractSection(content, '系统提示词（System Prompt）');

    return {
      name: extractField(basicSection, '名称'),
      role: extractField(basicSection, '角色'),
      description: extractField(basicSection, '描述'),
      communicationStyle: extractField(styleSection, '沟通风格'),
      systemPrompt: promptSection,
    };
  }

  /** 生成 soul.md Markdown 文本 */
  generateSoulMd(params: GenerateSoulParams): string {
    const {
      name,
      role,
      description,
      systemPrompt,
      communicationStyle = '友好专业',
    } = params;

    const now = new Date().toISOString();

    return [
      '# Agent 个性配置',
      '',
      '## 基本信息',
      `- 名称: ${name}`,
      `- 角色: ${role}`,
      `- 描述: ${description}`,
      `- 创建时间: ${now}`,
      '',
      '## 人格与风格',
      `- 沟通风格: ${communicationStyle}`,
      '- 工作方式: 分步解析',
      '- 语言偏好: 中文为主',
      '',
      '## 核心能力',
      `- ${role}相关的专业知识与技能`,
      '',
      '## 系统提示词（System Prompt）',
      systemPrompt,
      '',
    ].join('\n');
  }
}
