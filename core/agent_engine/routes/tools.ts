/**
 * 工具API路由
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { fileTools } from '../../../tools/file_tools/FileTools';
import { commandTools } from '../../../tools/command_tools/CommandTools';
import { webTools } from '../../../tools/web_tools/WebTools';

export function createToolsRouter() {
  const app = new Hono();

  // ===== 文件工具 =====
  
  // POST /api/tools/file/read - 读取文件
  app.post('/file/read', zValidator('json', z.object({
    path: z.string().min(1)
  })), async (c) => {
    const body = c.req.valid('json');
    
    try {
      const result = await fileTools.readFile(body.path);
      return c.json({ data: result });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'FILE_READ_ERROR', message: error.message } 
      }, 400);
    }
  });

  // POST /api/tools/file/write - 写入文件
  app.post('/file/write', zValidator('json', z.object({
    path: z.string().min(1),
    content: z.string()
  })), async (c) => {
    const body = c.req.valid('json');
    
    try {
      await fileTools.writeFile(body.path, body.content);
      return c.json({ data: { ok: true } });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'FILE_WRITE_ERROR', message: error.message } 
      }, 400);
    }
  });

  // POST /api/tools/file/list - 列出目录文件
  app.post('/file/list', zValidator('json', z.object({
    dir: z.string().min(1)
  })), async (c) => {
    const body = c.req.valid('json');
    
    try {
      const files = await fileTools.listFiles(body.dir);
      return c.json({ data: files, total: files.length });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'FILE_LIST_ERROR', message: error.message } 
      }, 400);
    }
  });

  // POST /api/tools/file/delete - 删除文件
  app.post('/file/delete', zValidator('json', z.object({
    path: z.string().min(1)
  })), async (c) => {
    const body = c.req.valid('json');
    
    try {
      await fileTools.deleteFile(body.path);
      return c.json({ data: { ok: true } });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'FILE_DELETE_ERROR', message: error.message } 
      }, 400);
    }
  });

  // ===== 命令工具 =====

  // POST /api/tools/command/execute - 执行命令
  app.post('/command/execute', zValidator('json', z.object({
    command: z.string().min(1)
  })), async (c) => {
    const body = c.req.valid('json');
    
    try {
      const result = await commandTools.executeCommand(body.command);
      return c.json({ data: result });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'COMMAND_ERROR', message: error.message } 
      }, 400);
    }
  });

  // GET /api/tools/command/allowed - 获取允许的命令列表
  app.get('/command/allowed', async (c) => {
    const commands = commandTools.getAllowedCommands();
    return c.json({ data: commands, total: commands.length });
  });

  // ===== 网络工具 =====

  // POST /api/tools/web/search - 网络搜索
  app.post('/web/search', zValidator('json', z.object({
    query: z.string().min(1),
    limit: z.number().min(1).max(20).optional()
  })), async (c) => {
    const body = c.req.valid('json');
    
    try {
      const results = await webTools.webSearch(body.query, body.limit);
      return c.json({ data: results, total: results.length });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'SEARCH_ERROR', message: error.message } 
      }, 400);
    }
  });

  // POST /api/tools/web/fetch - 获取URL内容
  app.post('/web/fetch', zValidator('json', z.object({
    url: z.string().url()
  })), async (c) => {
    const body = c.req.valid('json');
    
    try {
      const content = await webTools.fetchUrl(body.url);
      return c.json({ data: { content } });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'FETCH_ERROR', message: error.message } 
      }, 400);
    }
  });

  return app;
}
