import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { AgentService } from '../../src/backend/services/AgentService.js';
import { SoulService } from '../../src/backend/services/SoulService.js';
import * as pathsModule from '../../src/backend/storage/paths.js';

/**
 * 测试用的临时目录路径 helper：
 * 由于 paths.ts 使用 homedir() 硬编码，这里通过直接检查生成的文件路径来验证
 */
describe('AgentService', () => {
  let agentService: AgentService;
  let soulService: SoulService;

  beforeEach(() => {
    soulService = new SoulService();
    agentService = new AgentService(soulService);
  });

  // TC-U-020: 创建 Agent 返回正确结构
  it('TC-U-020: createAgent 返回包含正确字段的 Agent 对象', async () => {
    const agent = await agentService.createAgent({
      name: '测试助手',
      templateId: 'general',
    });

    expect(agent.id).toMatch(/^agt_/);
    expect(agent.name).toBe('测试助手');
    expect(agent.role).toBe('通用助手');
    expect(agent.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(agent.soulMdPath).toContain(agent.id);

    // 验证文件存在
    expect(existsSync(pathsModule.metaJsonPath(agent.id))).toBe(true);
    expect(existsSync(pathsModule.soulMdPath(agent.id))).toBe(true);
  });

  // TC-U-021: 名称为空时报 ValidationError
  it('TC-U-021: createAgent 名称为空时抛出 ValidationError', async () => {
    await expect(agentService.createAgent({ name: '' })).rejects.toThrow();
  });

  // TC-U-022: 名称超过 50 字符时报 ValidationError
  it('TC-U-022: createAgent 名称超过 50 字符时抛出 ValidationError', async () => {
    await expect(
      agentService.createAgent({ name: 'a'.repeat(51) }),
    ).rejects.toThrow();
  });

  // TC-U-023: 查询不存在的 Agent 返回 null
  it('TC-U-023: getAgent 不存在的 agentId 返回 null', async () => {
    const result = await agentService.getAgent('agt_notexist999');
    expect(result).toBeNull();
  });

  // TC-U-024: 列出 Agent 包含已创建的 Agent
  it('TC-U-024: listAgents 包含已创建的 Agent', async () => {
    const agent = await agentService.createAgent({ name: '列表测试助手', templateId: 'tech' });
    const agents = await agentService.listAgents();
    const found = agents.find((a) => a.id === agent.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe('列表测试助手');
    expect(found?.role).toBe('技术专家');
  });

  // TC-U-025: 使用自定义 systemPrompt 覆盖模板
  it('TC-U-025: createAgent 可以用自定义 systemPrompt 覆盖模板', async () => {
    const customPrompt = '你是一个自定义的AI助手，专门回答关于猫咪的问题。';
    const agent = await agentService.createAgent({
      name: '猫咪助手',
      templateId: 'general',
      systemPrompt: customPrompt,
    });

    const soulContent = await soulService.getSoulContent(agent.id);
    expect(soulContent).toBeTruthy();
    expect(soulContent).toContain(customPrompt);
  });

  // TC-U-026: 不使用模板时使用默认值
  it('TC-U-026: createAgent 不指定 templateId 时使用默认值', async () => {
    const agent = await agentService.createAgent({ name: '无模板助手' });
    expect(agent.id).toMatch(/^agt_/);
    expect(agent.name).toBe('无模板助手');

    const soulContent = await soulService.getSoulContent(agent.id);
    expect(soulContent).toBeTruthy();
    expect(soulContent).toContain('无模板助手');
  });
});
