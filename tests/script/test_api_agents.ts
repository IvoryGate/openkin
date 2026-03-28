import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../src/backend/app.js';

/**
 * 集成测试：HTTP 接口
 * 使用 Hono 的 app.request() 直接调用，无需启动真实 HTTP 端口
 */
describe('HTTP API - /api/agents', () => {
  let honoApp: ReturnType<typeof createApp>['app'];

  beforeEach(() => {
    honoApp = createApp().app;
  });

  // TC-I-001: POST /api/agents - 成功创建
  it('TC-I-001: POST /api/agents 成功创建返回 201', async () => {
    const res = await honoApp.request('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '集成测试Agent', templateId: 'general' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { id: string; name: string } };
    expect(body.data.id).toMatch(/^agt_/);
    expect(body.data.name).toBe('集成测试Agent');
  });

  // TC-I-002: POST /api/agents - 名称缺失返回 400
  it('TC-I-002: POST /api/agents 缺少 name 返回 400', async () => {
    const res = await honoApp.request('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'general' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // TC-I-003: GET /api/agents - 列出 Agent
  it('TC-I-003: GET /api/agents 返回 Agent 列表', async () => {
    // 先创建一个
    await honoApp.request('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '列表测试Agent' }),
    });

    const res = await honoApp.request('/api/agents');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  // TC-I-004: GET /api/agents/:id/soul - 获取 soul.md
  it('TC-I-004: GET /api/agents/:id/soul 返回 soul.md 内容', async () => {
    // 先创建
    const createRes = await honoApp.request('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Soul测试Agent', templateId: 'tech' }),
    });
    const { data: agent } = await createRes.json() as { data: { id: string } };

    const res = await honoApp.request(`/api/agents/${agent.id}/soul`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { content: string } };
    expect(body.data.content).toContain('# Agent 个性配置');
  });

  // TC-I-005: PUT /api/agents/:id/soul - 更新 soul.md
  it('TC-I-005: PUT /api/agents/:id/soul 更新内容后可读取', async () => {
    // 创建
    const createRes = await honoApp.request('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Soul更新测试Agent' }),
    });
    const { data: agent } = await createRes.json() as { data: { id: string } };

    const newContent = '# Updated Soul\n\n## 基本信息\n- 名称: 更新后的Agent\n\n## 系统提示词（System Prompt）\n新的系统提示词\n';

    const putRes = await honoApp.request(`/api/agents/${agent.id}/soul`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent }),
    });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json() as { data: { ok: boolean } };
    expect(putBody.data.ok).toBe(true);

    // 验证更新后可读取
    const getRes = await honoApp.request(`/api/agents/${agent.id}/soul`);
    const getBody = await getRes.json() as { data: { content: string } };
    expect(getBody.data.content).toBe(newContent);
  });

  // TC-I-006: GET /api/agents/:id - 不存在时返回 404
  it('TC-I-006: GET /api/agents/:id 不存在返回 404', async () => {
    const res = await honoApp.request('/api/agents/agt_notexist999');
    expect(res.status).toBe(404);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('AGENT_NOT_FOUND');
  });
});

describe('HTTP API - /api/config', () => {
  let honoApp: ReturnType<typeof createApp>['app'];

  beforeEach(() => {
    honoApp = createApp().app;
  });

  // TC-I-007: GET /health - 健康检查
  it('TC-I-007: GET /health 返回 ok', async () => {
    const res = await honoApp.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  // TC-I-008: POST /api/config/validate-key - 无效 Key 返回 ok: false
  it('TC-I-008: validate-key 传入无效 key 返回 ok: false', async () => {
    const res = await honoApp.request('/api/config/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'openai', key: 'sk-invalid-key-xxx' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { ok: boolean; error?: string } };
    expect(body.data.ok).toBe(false);
    expect(body.data.error).toBeTruthy();
  });

  // TC-I-009: POST /api/config/validate-key - 缺少参数返回 400
  it('TC-I-009: validate-key 缺少 type 参数返回 400', async () => {
    const res = await honoApp.request('/api/config/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'sk-xxx' }),
    });
    expect(res.status).toBe(400);
  });

  // TC-I-010: GET /api/config/initialized
  it('TC-I-010: GET /api/config/initialized 返回布尔值', async () => {
    const res = await honoApp.request('/api/config/initialized');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { initialized: boolean } };
    expect(typeof body.data.initialized).toBe('boolean');
  });
});
