/**
 * 任务分解器
 */

import { nanoid } from 'nanoid';
import { Task, TaskDecomposition, TaskType } from './types';
import { LLMClient } from '../agent_engine/llm/LLMClient';
import { ChatMessage } from '../agent_engine/types/chat';

export class TaskDecomposer {
  constructor(private llmClient?: LLMClient) {}

  async decompose(taskDescription: string): Promise<TaskDecomposition> {
    // 如果没有LLM客户端，使用简单的规则分解
    if (!this.llmClient) {
      return this.ruleBasedDecompose(taskDescription);
    }

    // 使用LLM智能分解
    return this.llmBasedDecompose(taskDescription);
  }

  private async llmBasedDecompose(taskDescription: string): Promise<TaskDecomposition> {
    const systemPrompt = `你是一个任务分解专家。请将用户提供的复杂任务分解为可执行的子任务。

规则：
1. 每个子任务应该清晰、具体、可执行
2. 子任务之间应该有合理的依赖关系
3. 返回JSON格式，包含subTasks数组和executionOrder二维数组

输出格式：
{
  "subTasks": [
    {
      "type": "development|writing|research|general",
      "title": "任务标题",
      "description": "详细描述"
    }
  ],
  "executionOrder": [["task_id_1", "task_id_2"], ["task_id_3"]]
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: taskDescription }
    ];

    try {
      let response = '';
      for await (const chunk of this.llmClient.streamChat(messages)) {
        response += chunk.content;
      }

      // 解析LLM返回的JSON
      const result = JSON.parse(response);
      return this.parseDecompositionResult(result);
    } catch (error) {
      console.error('LLM分解失败，使用规则分解:', error);
      return this.ruleBasedDecompose(taskDescription);
    }
  }

  private ruleBasedDecompose(taskDescription: string): TaskDecomposition> {
    const subTasks: Task[] = [];
    const lowerDesc = taskDescription.toLowerCase();

    // 根据关键词识别任务类型
    let taskType: TaskType = 'general';
    if (lowerDesc.includes('开发') || lowerDesc.includes('代码') || lowerDesc.includes('implement')) {
      taskType = 'development';
    } else if (lowerDesc.includes('写') || lowerDesc.includes('文档') || lowerDesc.includes('文章')) {
      taskType = 'writing';
    } else if (lowerDesc.includes('研究') || lowerDesc.includes('分析') || lowerDesc.includes('调查')) {
      taskType = 'research';
    }

    // 生成子任务
    const taskId1 = `task_${nanoid(8)}`;
    const taskId2 = `task_${nanoid(8)}`;
    const taskId3 = `task_${nanoid(8)}`;

    if (taskType === 'development') {
      subTasks.push({
        id: taskId1,
        type: 'development',
        title: '需求分析',
        description: '分析任务需求，明确功能规格',
        status: 'pending',
        priority: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dependencies: []
      });

      subTasks.push({
        id: taskId2,
        type: 'development',
        title: '架构设计',
        description: '设计系统架构和技术方案',
        status: 'pending',
        priority: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dependencies: [taskId1]
      });

      subTasks.push({
        id: taskId3,
        type: 'development',
        title: '实现开发',
        description: '根据架构设计进行编码实现',
        status: 'pending',
        priority: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dependencies: [taskId2]
      });
    } else if (taskType === 'writing') {
      subTasks.push({
        id: taskId1,
        type: 'writing',
        title: '内容规划',
        description: '规划写作内容和结构',
        status: 'pending',
        priority: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dependencies: []
      });

      subTasks.push({
        id: taskId2,
        type: 'writing',
        title: '撰写内容',
        description: '根据规划撰写内容',
        status: 'pending',
        priority: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dependencies: [taskId1]
      });
    } else {
      subTasks.push({
        id: taskId1,
        type: 'general',
        title: '任务分析',
        description: '分析任务要求',
        status: 'pending',
        priority: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dependencies: []
      });

      subTasks.push({
        id: taskId2,
        type: 'general',
        title: '执行任务',
        description: '执行具体任务内容',
        status: 'pending',
        priority: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dependencies: [taskId1]
      });
    }

    // 生成执行顺序
    const executionOrder = this.buildExecutionOrder(subTasks);

    return { subTasks, executionOrder };
  }

  private parseDecompositionResult(result: any): TaskDecomposition {
    const subTasks: Task[] = (result.subTasks || []).map((st: any) => ({
      id: `task_${nanoid(8)}`,
      type: st.type || 'general',
      title: st.title || '未命名任务',
      description: st.description || '',
      status: 'pending' as const,
      priority: 5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dependencies: st.dependencies || []
    }));

    const executionOrder = result.executionOrder || this.buildExecutionOrder(subTasks);

    return { subTasks, executionOrder };
  }

  private buildExecutionOrder(tasks: Task[]): string[][] {
    // 拓扑排序，基于依赖关系
    const order: string[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();

    // 计算入度
    for (const task of tasks) {
      inDegree.set(task.id, task.dependencies.length);
    }

    // 按层处理
    let currentLevel: string[] = [];
    for (const task of tasks) {
      if (inDegree.get(task.id) === 0) {
        currentLevel.push(task.id);
        visited.add(task.id);
      }
    }

    while (currentLevel.length > 0) {
      order.push([...currentLevel]);
      const nextLevel: string[] = [];

      for (const taskId of currentLevel) {
        // 减少依赖此任务的其他任务的入度
        for (const task of tasks) {
          if (task.dependencies.includes(taskId) && !visited.has(task.id)) {
            inDegree.set(task.id, (inDegree.get(task.id) || 0) - 1);
            if (inDegree.get(task.id) === 0) {
              nextLevel.push(task.id);
              visited.add(task.id);
            }
          }
        }
      }

      currentLevel = nextLevel;
    }

    // 检查是否有循环依赖
    if (visited.size !== tasks.length) {
      console.warn('检测到循环依赖，部分任务可能无法执行');
      // 将未访问的任务添加到最后
      for (const task of tasks) {
        if (!visited.has(task.id)) {
          order.push([task.id]);
        }
      }
    }

    return order;
  }
}
