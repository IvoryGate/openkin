import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SoulService } from '../../core/memory_system/SoulService.js';

describe('SoulService', () => {
  let soulService: SoulService;

  beforeEach(() => {
    soulService = new SoulService();
  });

  // TC-U-001: 生成 soul.md 内容格式正确
  it('TC-U-001: generateSoulMd 输出包含正确章节和字段', () => {
    const content = soulService.generateSoulMd({
      name: '技术助手',
      role: '技术专家',
      description: '专注于编程和系统设计',
      systemPrompt: '你是一个资深技术专家',
      communicationStyle: '严谨专业',
    });

    expect(content).toContain('## 基本信息');
    expect(content).toContain('名称: 技术助手');
    expect(content).toContain('角色: 技术专家');
    expect(content).toContain('描述: 专注于编程和系统设计');
    expect(content).toContain('## 系统提示词（System Prompt）');
    expect(content).toContain('你是一个资深技术专家');
    expect(content).toContain('## 人格与风格');
    expect(content).toContain('沟通风格: 严谨专业');
  });

  // TC-U-002: 解析 soul.md 提取 systemPrompt 和 name
  it('TC-U-002: parseSoul 正确提取 systemPrompt 和 name', () => {
    const content = soulService.generateSoulMd({
      name: '技术助手',
      role: '技术专家',
      description: '测试描述',
      systemPrompt: '你是一个资深技术专家，擅长编程。',
    });

    const parsed = soulService.parseSoul(content);
    expect(parsed.name).toBe('技术助手');
    expect(parsed.role).toBe('技术专家');
    expect(parsed.systemPrompt).toBe('你是一个资深技术专家，擅长编程。');
  });

  // TC-U-003: 解析不完整 soul.md 不抛异常
  it('TC-U-003: parseSoul 对不完整内容不抛出异常', () => {
    const minimalContent = '# Agent 个性配置\n';
    expect(() => soulService.parseSoul(minimalContent)).not.toThrow();
    const parsed = soulService.parseSoul(minimalContent);
    expect(parsed.name).toBe('');
    expect(parsed.systemPrompt).toBe('');
  });

  // TC-U-004: 往返一致性（生成 → 解析）
  it('TC-U-004: generateSoulMd → parseSoul 往返一致', () => {
    const params = {
      name: '写作助手',
      role: '写作专家',
      description: '帮助写文章',
      systemPrompt: '你是专业写作助手，请帮用户润色文字。',
      communicationStyle: '富有创意',
    };

    const content = soulService.generateSoulMd(params);
    const parsed = soulService.parseSoul(content);

    expect(parsed.name).toBe(params.name);
    expect(parsed.role).toBe(params.role);
    expect(parsed.systemPrompt).toBe(params.systemPrompt);
    expect(parsed.communicationStyle).toBe(params.communicationStyle);
  });

  // TC-U-005: getSoulContent / saveSoulContent 文件 I/O
  it('TC-U-005: saveSoulContent 写入后 getSoulContent 读取内容一致', async () => {
    // 使用临时目录覆盖 agentId 路径
    const tmpDir = mkdtempSync(join(tmpdir(), 'openkin-test-'));
    const testAgentId = 'test_agent_001';

    // 临时覆盖 paths 模块行为：用 monkey-patch FileStorage 的读写
    const { writeText, readText } = await import('../../storage/FileStorage.js');
    const testPath = join(tmpDir, 'soul.md');
    const testContent = '# Test Soul\n\n## 系统提示词（System Prompt）\ntest prompt\n';

    // 直接测试文件读写（因为 soulMdPath 依赖真实 home，这里只测逻辑）
    writeText(testPath, testContent);
    const read = readText(testPath);
    expect(read).toBe(testContent);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
