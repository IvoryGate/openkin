/**
 * 记忆系统API路由
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { MemoryService } from '../../memory_system/MemoryService';

export function createMemoriesRouter(memoryService: MemoryService) {
  const app = new Hono();

  // GET /api/memories/:agentId - 获取Agent的所有长期记忆
  app.get('/:agentId', async (c) => {
    const agentId = c.req.param('agentId');
    const memories = await memoryService.getAgentMemories(agentId);
    return c.json({ data: memories, total: memories.length });
  });

  // POST /api/memories - 添加长期记忆
  app.post('/', zValidator('json', z.object({
    type: z.enum(['preference', 'knowledge', 'conversation', 'context']),
    content: z.string().min(1).max(5000),
    importance: z.number().min(1).max(10),
    tags: z.array(z.string()).default([]),
    agentId: z.string(),
    userId: z.string().optional()
  })), async (c) => {
    const body = c.req.valid('json');
    const memoryId = await memoryService.addLongTermMemory(body);
    return c.json({ data: { id: memoryId } }, 201);
  });

  // GET /api/memories/:agentId/:memoryId - 获取单个记忆
  app.get('/:agentId/:memoryId', async (c) => {
    const memoryId = c.req.param('memoryId');
    const memory = await memoryService.getLongTermMemory(memoryId);
    
    if (!memory) {
      return c.json({ error: { code: 'MEMORY_NOT_FOUND', message: '记忆不存在' } }, 404);
    }
    
    return c.json({ data: memory });
  });

  // PUT /api/memories/:memoryId - 更新记忆
  app.put('/:memoryId', zValidator('json', z.object({
    content: z.string().min(1).max(5000).optional(),
    importance: z.number().min(1).max(10).optional(),
    tags: z.array(z.string()).optional()
  })), async (c) => {
    const memoryId = c.req.param('memoryId');
    const updates = c.req.valid('json');
    
    await memoryService.updateLongTermMemory(memoryId, updates);
    return c.json({ data: { ok: true } });
  });

  // DELETE /api/memories/:memoryId - 删除记忆
  app.delete('/:memoryId', async (c) => {
    const memoryId = c.req.param('memoryId');
    await memoryService.deleteLongTermMemory(memoryId);
    return c.json({ data: { ok: true } });
  });

  // POST /api/memories/search - 搜索记忆
  app.post('/search', zValidator('json', z.object({
    query: z.string().min(1),
    type: z.enum(['preference', 'knowledge', 'conversation', 'context']).optional(),
    agentId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    minImportance: z.number().optional(),
    limit: z.number().min(1).max(100).optional()
  })), async (c) => {
    const query = c.req.valid('json');
    const results = await memoryService.searchMemories(query);
    return c.json({ data: results, total: results.length });
  });

  return app;
}
