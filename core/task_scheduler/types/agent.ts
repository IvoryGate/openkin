/**
 * Agent能力类型定义
 */

export interface AgentCapabilities {
  agentId: string;
  skills: string[];
  proficiency: Record<string, number>; // 技能熟练度 1-10
  availability: boolean;
  currentLoad: number; // 当前任务数
  lastActiveAt: number;
}

export interface TaskRequirement {
  requiredSkills: string[];
  minProficiency: number;
  type?: string;
}

export interface AgentMatchResult {
  agentId: string;
  score: number; // 匹配分数 0-1
  reasons: string[]; // 匹配原因
}

// 预定义的技能列表
export const SKILLS = {
  coding: 'coding',
  debugging: 'debugging',
  writing: 'writing',
  research: 'research',
  design: 'design',
  testing: 'testing',
  documentation: 'documentation',
  analysis: 'analysis',
  communication: 'communication',
  management: 'management'
} as const;

// 技能到任务类型的映射
export const SKILL_TASK_MAPPING: Record<string, TaskType[]> = {
  [SKILLS.coding]: ['development', 'research'],
  [SKILLS.debugging]: ['development', 'research'],
  [SKILLS.writing]: ['writing', 'general', 'research'],
  [SKILLS.research]: ['research', 'general', 'writing'],
  [SKILLS.design]: ['development', 'general'],
  [SKILLS.testing]: ['development'],
  [SKILLS.documentation]: ['writing', 'development'],
  [SKILLS.analysis]: ['research', 'development'],
  [SKILLS.communication]: ['writing', 'general'],
  [SKILLS.management]: ['general']
};
