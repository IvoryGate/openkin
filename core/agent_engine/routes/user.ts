/**
 * 用户画像系统API路由
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { UserProfileService } from '../../user_profile/UserProfileService';

export function createUserRouter(userProfileService: UserProfileService) {
  const app = new Hono();

  // GET /api/user/profile - 获取用户画像
  app.get('/profile', async (c) => {
    const profile = userProfileService.getProfile();
    return c.json({ data: profile });
  });

  // PUT /api/user/profile - 更新用户画像
  app.put('/profile', zValidator('json', z.object({
    communication: z.object({
      responseLength: z.enum(['short', 'medium', 'long']).optional(),
      likesCodeExamples: z.boolean().optional(),
      tone: z.enum(['professional', 'friendly', 'humorous']).optional(),
      language: z.enum(['zh-CN', 'en-US']).optional()
    }).optional(),
    skills: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional()
  }).partial()), async (c) => {
    const updates = c.req.valid('json');
    await userProfileService.updateProfile(updates);
    return c.json({ data: { ok: true } });
  });

  // GET /api/user/profile/markdown - 导出用户画像为Markdown
  app.get('/profile/markdown', async (c) => {
    const markdown = userProfileService.exportToMarkdown();
    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="user_profile.md"'
    });
  });

  // POST /api/user/profile/reset - 重置用户画像
  app.post('/profile/reset', async (c) => {
    await userProfileService.resetProfile();
    return c.json({ data: { ok: true } });
  });

  // POST /api/user/behavior - 记录用户行为
  app.post('/behavior', zValidator('json', z.object({
    type: z.enum(['message', 'session_start', 'session_end', 'agent_switch', 'feature_use']),
    data: z.any()
  })), async (c) => {
    const body = c.req.valid('json');
    await userProfileService.recordBehavior({
      timestamp: Date.now(),
      type: body.type,
      data: body.data
    });
    return c.json({ data: { ok: true } });
  });

  return app;
}
