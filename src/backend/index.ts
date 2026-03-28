import { serve } from '@hono/node-server';
import { writeFileSync } from 'node:fs';
import { createApp } from './app.js';
import { BACKEND_PORT_FILE } from './storage/paths.js';

const PORT = Number(process.env.BACKEND_PORT ?? 7788);

const { app, handleUpgrade } = createApp();

const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: '127.0.0.1',
  },
  (info) => {
    // 把实际端口写入文件，供 Electron 主进程读取
    writeFileSync(BACKEND_PORT_FILE, String(info.port), 'utf-8');
    // 输出就绪信号给 Electron 主进程识别
    console.log(`BACKEND_READY:${info.port}`);
    console.info(`[INFO] [Backend] Listening on http://127.0.0.1:${info.port}`);
  },
);

// 挂载 WebSocket upgrade 处理
server.on('upgrade', handleUpgrade);

// 优雅退出
process.on('SIGTERM', () => {
  console.info('[INFO] [Backend] Shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.info('[INFO] [Backend] Shutting down...');
  server.close();
  process.exit(0);
});
