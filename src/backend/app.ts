import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { SoulService } from './services/SoulService.js';
import { ConfigService } from './services/ConfigService.js';
import { AgentService } from './services/AgentService.js';
import { ChatService } from './services/ChatService.js';
import { createAgentsRouter } from './routes/agents.js';
import { createConfigRouter } from './routes/config.js';
import { createChatWsHandler } from './routes/chat.js';
import { initAppDataDir } from './storage/FileStorage.js';

export function createApp() {
  // 初始化数据目录
  initAppDataDir();

  // 实例化服务
  const soulService = new SoulService();
  const configService = new ConfigService();
  const agentService = new AgentService(soulService);
  const chatService = new ChatService(agentService, soulService, configService);

  const app = new Hono();

  // 中间件
  app.use('*', cors({ origin: '*' }));
  app.use('*', logger());

  // HTTP 路由
  app.route('/api/agents', createAgentsRouter(agentService, soulService));
  app.route('/api/config', createConfigRouter(configService));

  // 健康检查
  app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

  // WebSocket handler（由 index.ts 挂载到 HTTP server 的 upgrade 事件）
  const { handleUpgrade } = createChatWsHandler(chatService);

  return { app, handleUpgrade };
}

export type AppInstance = ReturnType<typeof createApp>;
