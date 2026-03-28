/**
 * 任务类型定义
 */

export type TaskType = 'development' | 'writing' | 'research' | 'general';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  id: string;
  parentTaskId?: string;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  assignedAgentId?: string;
  createdAt: number;
  updatedAt: number;
  dependencies: string[];
  result?: any;
  error?: string;
}

export interface TaskDecomposition {
  subTasks: Task[];
  executionOrder: string[][];
}

export interface TaskExecution {
  taskId: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  status: TaskStatus;
  result?: any;
  error?: string;
}

export const TASK_TYPES = {
  development: 'development',
  writing: 'writing',
  research: 'research',
  general: 'general'
} as const;

export const TASK_STATUS = {
  pending: 'pending',
  in_progress: 'in_progress',
  completed: 'completed',
  failed: 'failed'
} as const;
