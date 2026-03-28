import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AgentService } from '../services/AgentService.js';
import type { SoulService } from '../services/SoulService.js';

const createAgentBody = z.object({
  name: z.string().min(2).max(50),
  role: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  templateId: z.enum(['general', 'tech', 'writer']).optional(),
  systemPrompt: z.string().optional(),
});

const saveSoulBody = z.object({
  content: z.string().min(1),
});

export function createAgentsRouter(
  agentService: AgentService,
  soulService: SoulService,
) {
  const router = new Hono();

  // GET /api/agents - 列出所有 Agent
  router.get('/', async (c) => {
    const agents = await agentService.listAgents();
    return c.json({ data: agents, total: agents.length });
  });

  // POST /api/agents - 创建 Agent
  router.post(
    '/',
    zValidator('json', createAgentBody, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: { code: 'VALIDATION_ERROR', message: result.error.errors.map((e) => e.message).join('; ') } },
          400,
        );
      }
    }),
    async (c) => {
      try {
        const body = c.req.valid('json');
        const agent = await agentService.createAgent(body);
        return c.json({ data: agent }, 201);
      } catch (e: unknown) {
        const err = e as Error;
        if (err.name === 'ValidationError') {
          return c.json({ error: { code: 'VALIDATION_ERROR', message: err.message } }, 400);
        }
        console.error('[agents] POST /api/agents error', err);
        return c.json({ error: { code: 'STORAGE_ERROR', message: err.message } }, 500);
      }
    },
  );

  // GET /api/agents/:id - 获取 Agent 详情
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const agent = await agentService.getAgent(id);
    if (!agent) {
      return c.json({ error: { code: 'AGENT_NOT_FOUND', message: `Agent ${id} not found` } }, 404);
    }
    const soulContent = await soulService.getSoulContent(id);
    return c.json({ data: { ...agent, soulContent: soulContent ?? '' } });
  });

  // GET /api/agents/:id/soul - 获取 soul.md 原始内容
  router.get('/:id/soul', async (c) => {
    const id = c.req.param('id');
    const agent = await agentService.getAgent(id);
    if (!agent) {
      return c.json({ error: { code: 'AGENT_NOT_FOUND', message: `Agent ${id} not found` } }, 404);
    }
    const content = await soulService.getSoulContent(id);
    return c.json({ data: { content: content ?? '' } });
  });

  // DELETE /api/agents/:id - 删除 Agent
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const agent = await agentService.getAgent(id);
    if (!agent) {
      return c.json({ error: { code: 'AGENT_NOT_FOUND', message: `Agent ${id} not found` } }, 404);
    }
    await agentService.deleteAgent(id);
    return c.json({ data: { ok: true } });
  });

  // PUT /api/agents/:id/soul - 更新 soul.md
  router.put(
    '/:id/soul',
    zValidator('json', saveSoulBody, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: { code: 'VALIDATION_ERROR', message: 'content is required' } },
          400,
        );
      }
    }),
    async (c) => {
      const id = c.req.param('id');
      const agent = await agentService.getAgent(id);
      if (!agent) {
        return c.json({ error: { code: 'AGENT_NOT_FOUND', message: `Agent ${id} not found` } }, 404);
      }
      const { content } = c.req.valid('json');
      await soulService.saveSoulContent(id, content);
      return c.json({ data: { ok: true } });
    },
  );

  return router;
}
