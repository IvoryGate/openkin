/**
 * 任务调度系统API路由
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { TaskScheduler } from '../../task_scheduler/TaskScheduler';

export function createTasksRouter(taskScheduler: TaskScheduler) {
  const app = new Hono();

  // POST /api/tasks - 创建并分解任务
  app.post('/', zValidator('json', z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    type: z.enum(['development', 'writing', 'research', 'general']).optional(),
    priority: z.number().min(1).max(5).optional()
  })), async (c) => {
    const body = c.req.valid('json');
    const decomposition = await taskScheduler.createAndDecomposeTask(
      body.title,
      body.description,
      body.type,
      body.priority as 1 | 2 | 3 | 4 | 5
    );
    return c.json({ data: decomposition }, 201);
  });

  // GET /api/tasks - 获取所有任务
  app.get('/', async (c) => {
    const tasks = taskScheduler.getAllTasks();
    return c.json({ data: tasks, total: tasks.length });
  });

  // GET /api/tasks/:id - 获取任务详情
  app.get('/:id', async (c) => {
    const taskId = c.req.param('id');
    const task = taskScheduler.getTask(taskId);
    
    if (!task) {
      return c.json({ error: { code: 'TASK_NOT_FOUND', message: '任务不存在' } }, 404);
    }
    
    return c.json({ data: task });
  });

  // GET /api/tasks/:id/subtasks - 获取子任务
  app.get('/:id/subtasks', async (c) => {
    const taskId = c.req.param('id');
    const subTasks = taskScheduler.getSubTasks(taskId);
    return c.json({ data: subTasks, total: subTasks.length });
  });

  // GET /api/tasks/:id/execution - 获取执行记录
  app.get('/:id/execution', async (c) => {
    const taskId = c.req.param('id');
    const execution = taskScheduler.getExecution(taskId);
    
    if (!execution) {
      return c.json({ error: { code: 'EXECUTION_NOT_FOUND', message: '执行记录不存在' } }, 404);
    }
    
    return c.json({ data: execution });
  });

  // POST /api/tasks/:id/execute - 执行任务
  app.post('/:id/execute', async (c) => {
    const taskId = c.req.param('id');
    
    try {
      await taskScheduler.executeTask(taskId);
      return c.json({ data: { ok: true } });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'EXECUTION_ERROR', message: error.message } 
      }, 400);
    }
  });

  // POST /api/tasks/:id/cancel - 取消任务
  app.post('/:id/cancel', async (c) => {
    const taskId = c.req.param('id');
    
    try {
      await taskScheduler.cancelTask(taskId);
      return c.json({ data: { ok: true } });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'CANCEL_ERROR', message: error.message } 
      }, 400);
    }
  });

  // POST /api/tasks/:id/retry - 重试失败的任务
  app.post('/:id/retry', async (c) => {
    const taskId = c.req.param('id');
    
    try {
      await taskScheduler.retryTask(taskId);
      return c.json({ data: { ok: true } });
    } catch (error: any) {
      return c.json({ 
        error: { code: 'RETRY_ERROR', message: error.message } 
      }, 400);
    }
  });

  // GET /api/tasks/stats - 获取任务统计
  app.get('/stats', async (c) => {
    const stats = taskScheduler.getTaskStats();
    return c.json({ data: stats });
  });

  return app;
}
