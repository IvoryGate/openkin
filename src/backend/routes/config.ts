import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ConfigService } from '../services/ConfigService.js';
import { OpenAIClient } from '../llm/OpenAIClient.js';
import { AnthropicClient } from '../llm/AnthropicClient.js';

const validateKeyBody = z.object({
  type: z.enum(['openai', 'anthropic']),
  key: z.string().min(1),
});

const saveKeysBody = z.object({
  openai: z.string().optional().default(''),
  anthropic: z.string().optional().default(''),
  customEndpoint: z.string().optional().default(''),
});

export function createConfigRouter(configService: ConfigService) {
  const router = new Hono();

  // POST /api/config/validate-key
  router.post(
    '/validate-key',
    zValidator('json', validateKeyBody, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: { code: 'VALIDATION_ERROR', message: result.error.errors.map((e) => e.message).join('; ') } },
          400,
        );
      }
    }),
    async (c) => {
      const { type, key } = c.req.valid('json');
      try {
        let result;
        if (type === 'openai') {
          const client = new OpenAIClient(key);
          result = await client.validateKey();
        } else {
          const client = new AnthropicClient(key);
          result = await client.validateKey();
        }
        return c.json({ data: result });
      } catch (e: unknown) {
        const err = e as Error;
        return c.json({ data: { ok: false, error: err.message } });
      }
    },
  );

  // POST /api/config/save-keys
  router.post(
    '/save-keys',
    zValidator('json', saveKeysBody, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: { code: 'VALIDATION_ERROR', message: result.error.errors.map((e) => e.message).join('; ') } },
          400,
        );
      }
    }),
    async (c) => {
      const body = c.req.valid('json');
      try {
        await configService.saveApiKeys({
          openai: body.openai,
          anthropic: body.anthropic,
          customEndpoint: body.customEndpoint,
        });
        return c.json({ data: { ok: true } });
      } catch (e: unknown) {
        const err = e as Error;
        console.error('[config] save-keys error', err);
        return c.json({ error: { code: 'CONFIG_ERROR', message: err.message } }, 500);
      }
    },
  );

  // GET /api/config/initialized
  router.get('/initialized', (c) => {
    const initialized = configService.isInitialized();
    return c.json({ data: { initialized } });
  });

  return router;
}
