import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { serve } from '@hono/node-server';
import WebSocket from 'ws';
import { createApp } from '../../core/agent_engine/app.js';
import { AgentService } from '../../core/agent_engine/AgentService.js';
import { SoulService } from '../../core/memory_system/SoulService.js';
import type { WsServerMessage } from '../../core/agent_engine/types/chat.js';

const TEST_OPENAI_KEY = process.env.TEST_OPENAI_KEY;

/** 找到可用端口 */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as { port: number };
      srv.close(() => resolve(addr.port));
    });
    srv.on('error', reject);
  });
}

/** 等待 WebSocket 消息，带超时 */
function waitForMessage(ws: WebSocket, timeoutMs = 15000): Promise<WsServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS message timeout')), timeoutMs);
    ws.once('message', (data: Buffer) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString()) as WsServerMessage);
      } catch {
        reject(new Error('Invalid JSON from WS'));
      }
    });
  });
}

/** 收集所有消息直到 done 或 error */
function collectMessages(ws: WebSocket, timeoutMs = 30000): Promise<WsServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: WsServerMessage[] = [];
    const timer = setTimeout(() => reject(new Error('WS collect timeout')), timeoutMs);

    ws.on('message', (data: Buffer) => {
      let msg: WsServerMessage;
      try {
        msg = JSON.parse(data.toString()) as WsServerMessage;
      } catch {
        return;
      }
      messages.push(msg);
      if (msg.type === 'done' || msg.type === 'error') {
        clearTimeout(timer);
        resolve(messages);
      }
    });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

describe('WebSocket 对话接口', () => {
  let server: ReturnType<typeof serve>;
  let port: number;
  let testAgentId: string;

  beforeAll(async () => {
    port = await findFreePort();
    const { app, handleUpgrade } = createApp();

    server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
    // 挂载 WS upgrade 处理器
    server.on('upgrade', handleUpgrade);

    // 创建测试 Agent
    const soulSvc = new SoulService();
    const agentSvc = new AgentService(soulSvc);
    const agent = await agentSvc.createAgent({ name: 'WS测试Agent', templateId: 'general' });
    testAgentId = agent.id;
  });

  afterAll(() => {
    server?.close();
  });

  // TC-I-010: WebSocket 可建立连接
  it('TC-I-010: WebSocket 在 3 秒内建立连接', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Connection timeout')), 3000);
      ws.on('open', () => { clearTimeout(t); resolve(); });
      ws.on('error', reject);
    });
    ws.close();
  });

  // TC-I-012: agentId 不存在时收到错误消息
  it('TC-I-012: 无效 agentId 触发 AGENT_NOT_FOUND 错误', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`);
    await new Promise<void>((r) => ws.on('open', r));

    const collectPromise = collectMessages(ws, 5000);
    ws.send(JSON.stringify({
      type: 'chat',
      agentId: 'agt_notexist999',
      sessionId: 'sess_test',
      message: '你好',
      history: [],
    }));

    const messages = await collectPromise;
    ws.close();

    const errorMsg = messages.find((m) => m.type === 'error') as Extract<WsServerMessage, { type: 'error' }> | undefined;
    expect(errorMsg).toBeDefined();
    expect(errorMsg?.code).toBe('AGENT_NOT_FOUND');
  });

  // TC-I-013: 缺少 agentId 时收到 VALIDATION_ERROR
  it('TC-I-013: 缺少 agentId 触发 VALIDATION_ERROR', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`);
    await new Promise<void>((r) => ws.on('open', r));

    const firstMsg = waitForMessage(ws, 5000);
    ws.send(JSON.stringify({ type: 'chat', message: '你好', history: [] }));

    const msg = await firstMsg;
    ws.close();

    expect(msg.type).toBe('error');
    expect((msg as Extract<WsServerMessage, { type: 'error' }>).code).toBe('VALIDATION_ERROR');
  });

  // TC-I-011: 真实 LLM 流式对话（需要 TEST_OPENAI_KEY）
  it.skipIf(!TEST_OPENAI_KEY)(
    'TC-I-011: 发送消息收到 token 流和 done（需要 TEST_OPENAI_KEY）',
    async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`);
      await new Promise<void>((r) => ws.on('open', r));

      const collectPromise = collectMessages(ws, 30000);
      ws.send(JSON.stringify({
        type: 'chat',
        agentId: testAgentId,
        sessionId: 'sess_integration',
        message: '用一句话回答：1+1等于几？',
        history: [],
      }));

      const messages = await collectPromise;
      ws.close();

      const tokens = messages.filter((m) => m.type === 'token');
      const doneMsg = messages.find((m) => m.type === 'done');

      expect(tokens.length).toBeGreaterThan(0);
      expect(doneMsg).toBeDefined();

      const fullText = tokens
        .map((m) => (m as Extract<WsServerMessage, { type: 'token' }>).content)
        .join('');
      expect(fullText).toContain('2');
    },
  );
});
