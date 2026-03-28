/**
 * 任务调度器
 */

import { nanoid } from 'nanoid';
import { Task, TaskExecution, TaskStatus, TaskType } from './types';
import { TaskDecomposer } from './TaskDecomposer';
import { AgentMatcher } from './AgentMatcher';
import { FileStorage } from '../agent_engine/storage/FileStorage';

export class TaskScheduler {
  private tasks: Map<string, Task> = new Map();
  private executions: Map<string, TaskExecution> = new Map();

  constructor(
    private decomposer: TaskDecomposer,
    private matcher: AgentMatcher,
    private storage: FileStorage
  ) {
    this.load();
  }

  /**
   * 创建并分解任务
   */
  async createAndDecomposeTask(
    title: string,
    description: string,
    type?: TaskType,
    priority: 1 | 2 | 3 | 4 | 5 = 3
  ): Promise<TaskDecomposition> {
    // 创建主任务
    const mainTask: Task = {
      id: `task_${nanoid(8)}`,
      type: type || 'general',
      title,
      description,
      status: 'pending',
      priority,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dependencies: []
    };

    this.tasks.set(mainTask.id, mainTask);

    // 分解任务
    const decomposition = await this.decomposer.decompose(description);

    // 保存子任务
    for (const subTask of decomposition.subTasks) {
      subTask.parentTaskId = mainTask.id;
      subTask.priority = priority;
      this.tasks.set(subTask.id, subTask);
    }

    await this.save();

    return decomposition;
  }

  /**
   * 执行任务
   */
  async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (task.status !== 'pending') {
      throw new Error(`任务状态不正确: ${task.status}`);
    }

    // 检查依赖
    if (!await this.checkDependencies(task)) {
      throw new Error('依赖任务未完成');
    }

    // 匹配Agent
    const matchResult = await this.matcher.matchBestAgent(
      { requiredSkills: this.inferRequiredSkills(task), minProficiency: 5 },
      task.type
    );

    if (!matchResult) {
      throw new Error('没有找到合适的Agent');
    }

    // 更新任务状态
    task.status = 'in_progress';
    task.assignedAgentId = matchResult.agentId;
    task.updatedAt = Date.now();

    // 创建执行记录
    const execution: TaskExecution = {
      taskId: task.id,
      agentId: matchResult.agentId,
      startTime: Date.now(),
      status: 'in_progress'
    };

    this.executions.set(task.id, execution);

    // 更新Agent负载
    await this.matcher.updateAgentLoad(matchResult.agentId, 1);
    await this.matcher.updateAgentActivity(matchResult.agentId);

    await this.save();

    // 异步执行任务
    this.executeTaskAsync(taskId).catch(error => {
      console.error(`任务执行失败: ${taskId}`, error);
    });
  }

  /**
   * 异步执行任务
   */
  private async executeTaskAsync(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    const execution = this.executions.get(taskId);

    if (!task || !execution) {
      return;
    }

    try {
      // TODO: 实际执行任务逻辑
      // 这里应该调用Agent来执行任务
      // 目前使用模拟执行
      await this.simulateTaskExecution(task);

      // 更新任务状态为完成
      task.status = 'completed';
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.result = { success: true };

      // 检查是否有后续任务需要执行
      await this.checkAndExecuteDependentTasks(taskId);

    } catch (error) {
      task.status = 'failed';
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = error instanceof Error ? error.message : String(error);
    } finally {
      task.updatedAt = Date.now();
      if (task.assignedAgentId) {
        await this.matcher.updateAgentLoad(task.assignedAgentId, -1);
      }
      await this.save();
    }
  }

  /**
   * 模拟任务执行
   */
  private async simulateTaskExecution(task: Task): Promise<void> {
    // 模拟执行时间：1-5秒
    const duration = 1000 + Math.random() * 4000;
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * 检查依赖任务是否完成
   */
  private async checkDependencies(task: Task): Promise<boolean> {
    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * 检查并执行依赖此任务的其他任务
   */
  private async checkAndExecuteDependentTasks(completedTaskId: string): Promise<void> {
    for (const task of this.tasks.values()) {
      if (task.dependencies.includes(completedTaskId) && task.status === 'pending') {
        if (await this.checkDependencies(task)) {
          // 自动执行依赖完成的任务
          await this.executeTask(task.id);
        }
      }
    }
  }

  /**
   * 推断任务所需的技能
   */
  private inferRequiredSkills(task: Task): string[] {
    const skills: string[] = [];
    const desc = task.description.toLowerCase();

    switch (task.type) {
      case 'development':
        skills.push('coding', 'debugging');
        if (desc.includes('测试')) {
          skills.push('testing');
        }
        break;
      case 'writing':
        skills.push('writing', 'documentation');
        if (desc.includes('分析')) {
          skills.push('analysis');
        }
        break;
      case 'research':
        skills.push('research', 'analysis');
        if (desc.includes('文档')) {
          skills.push('documentation');
        }
        break;
      default:
        skills.push('communication', 'analysis');
    }

    return skills;
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 获取任务的子任务
   */
  getSubTasks(parentTaskId: string): Task[] {
    return Array.from(this.tasks.values())
      .filter(t => t.parentTaskId === parentTaskId)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 获取任务执行记录
   */
  getExecution(taskId: string): TaskExecution | undefined {
    return this.executions.get(taskId);
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (task.status === 'completed') {
      throw new Error('已完成的任务不能取消');
    }

    // 取消子任务
    const subTasks = this.getSubTasks(taskId);
    for (const subTask of subTasks) {
      if (subTask.status === 'pending' || subTask.status === 'in_progress') {
        subTask.status = 'failed';
        subTask.error = '父任务被取消';
        subTask.updatedAt = Date.now();
      }
    }

    task.status = 'failed';
    task.error = '任务被取消';
    task.updatedAt = Date.now();

    await this.save();
  }

  /**
   * 重试失败的任务
   */
  async retryTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (task.status !== 'failed') {
      throw new Error('只能重试失败的任务');
    }

    // 重置任务状态
    task.status = 'pending';
    task.error = undefined;
    task.updatedAt = Date.now();

    await this.save();

    // 重新执行
    await this.executeTask(taskId);
  }

  /**
   * 获取任务统计
   */
  getTaskStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0
    };

    for (const task of this.tasks.values()) {
      stats[task.status]++;
    }

    return stats;
  }

  private async load(): Promise<void> {
    try {
      const data = await this.storage.readJson<{ tasks: Task[] }>('tasks/scheduler.json');
      if (data?.tasks) {
        for (const task of data.tasks) {
          this.tasks.set(task.id, task);
        }
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  }

  private async save(): Promise<void> {
    await this.storage.writeJson('tasks/scheduler.json', {
      tasks: Array.from(this.tasks.values())
    });
  }
}
