/**
 * Agent能力匹配器
 */

import { nanoid } from 'nanoid';
import { AgentCapabilities, TaskRequirement, AgentMatchResult, SKILL_TASK_MAPPING } from './types';
import { AgentService } from '../agent_engine/AgentService';
import { TaskType } from './types';

export class AgentMatcher {
  private agentCapabilities: Map<string, AgentCapabilities> = new Map();

  constructor(private agentService: AgentService) {
    this.initializeCapabilities();
  }

  /**
   * 匹配最合适的Agent
   */
  async matchBestAgent(
    requirement: TaskRequirement,
    taskType: TaskType
  ): Promise<AgentMatchResult | null> {
    const allResults = await this.matchAgents(requirement, taskType);

    if (allResults.length === 0) {
      return null;
    }

    // 返回分数最高的
    return allResults[0];
  }

  /**
   * 匹配所有符合要求的Agent
   */
  async matchAgents(
    requirement: TaskRequirement,
    taskType: TaskType
  ): Promise<AgentMatchResult[]> {
    // 更新Agent能力信息
    await this.updateCapabilities();

    const results: AgentMatchResult[] = [];

    for (const [agentId, capabilities] of this.agentCapabilities) {
      const result = this.calculateMatchScore(agentId, capabilities, requirement, taskType);
      if (result.score > 0) {
        results.push(result);
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(
    agentId: string,
    capabilities: AgentCapabilities,
    requirement: TaskRequirement,
    taskType: TaskType
  ): AgentMatchResult {
    let score = 0;
    const reasons: string[] = [];

    // 检查可用性
    if (!capabilities.availability) {
      return { agentId, score: 0, reasons: ['Agent不可用'] };
    }

    // 技能匹配分数（权重0.4）
    const skillScore = this.calculateSkillScore(capabilities, requirement);
    score += skillScore * 0.4;
    if (skillScore > 0) {
      reasons.push(`技能匹配度: ${(skillScore * 100).toFixed(0)}%`);
    }

    // 任务类型匹配分数（权重0.3）
    const typeScore = this.calculateTypeScore(capabilities, taskType);
    score += typeScore * 0.3;
    if (typeScore > 0) {
      reasons.push(`任务类型匹配: ${(typeScore * 100).toFixed(0)}%`);
    }

    // 负载均衡分数（权重0.2）
    const loadScore = this.calculateLoadScore(capabilities);
    score += loadScore * 0.2;
    if (loadScore > 0) {
      reasons.push(`负载情况: ${(loadScore * 100).toFixed(0)}%`);
    }

    // 活跃度分数（权重0.1）
    const activityScore = this.calculateActivityScore(capabilities);
    score += activityScore * 0.1;
    if (activityScore > 0) {
      reasons.push(`活跃度: ${(activityScore * 100).toFixed(0)}%`);
    }

    return {
      agentId,
      score: Math.min(1, score),
      reasons
    };
  }

  private calculateSkillScore(
    capabilities: AgentCapabilities,
    requirement: TaskRequirement
  ): number {
    let totalScore = 0;
    let matchCount = 0;

    for (const skill of requirement.requiredSkills) {
      const proficiency = capabilities.proficiency[skill];
      if (proficiency) {
        if (proficiency >= requirement.minProficiency) {
          totalScore += proficiency / 10;
          matchCount++;
        } else {
          totalScore += (proficiency / requirement.minProficiency) * 0.5;
        }
      }
    }

    if (requirement.requiredSkills.length === 0) {
      return 1; // 没有技能要求，默认满分
    }

    return totalScore / requirement.requiredSkills.length;
  }

  private calculateTypeScore(
    capabilities: AgentCapabilities,
    taskType: TaskType
  ): number {
    let matchCount = 0;

    for (const skill of capabilities.skills) {
      const taskTypes = SKILL_TASK_MAPPING[skill] || [];
      if (taskTypes.includes(taskType)) {
        matchCount++;
      }
    }

    if (capabilities.skills.length === 0) {
      return 0.5; // 无技能信息，给中等分数
    }

    return matchCount / capabilities.skills.length;
  }

  private calculateLoadScore(capabilities: AgentCapabilities): number {
    // 负载越低，分数越高
    const maxLoad = 5; // 假设最大负载为5
    return Math.max(0, 1 - capabilities.currentLoad / maxLoad);
  }

  private calculateActivityScore(capabilities: AgentCapabilities): number {
    // 越活跃，分数越高
    const now = Date.now();
    const daysSinceActive = (now - capabilities.lastActiveAt) / (24 * 60 * 60 * 1000);
    return Math.max(0, 1 - daysSinceActive / 7); // 7天内有活跃
  }

  /**
   * 初始化Agent能力信息
   */
  private async initializeCapabilities(): Promise<void> {
    await this.updateCapabilities();
  }

  /**
   * 更新所有Agent的能力信息
   */
  private async updateCapabilities(): Promise<void> {
    try {
      const agents = await this.agentService.listAgents();

      for (const agent of agents) {
        // 从Soul.md解析技能
        const capabilities = await this.parseAgentCapabilities(agent);
        this.agentCapabilities.set(agent.id, capabilities);
      }
    } catch (error) {
      console.error('更新Agent能力信息失败:', error);
    }
  }

  /**
   * 从Agent信息解析能力
   */
  private async parseAgentCapabilities(agent: any): Promise<AgentCapabilities> {
    // 简化实现：基于Agent的角色和模板生成能力
    const capabilities: AgentCapabilities = {
      agentId: agent.id,
      skills: [],
      proficiency: {},
      availability: true,
      currentLoad: 0,
      lastActiveAt: Date.now()
    };

    // 根据Agent角色设置技能
    const role = agent.role?.toLowerCase() || '';
    
    if (role.includes('技术') || role.includes('开发') || role.includes('tech')) {
      capabilities.skills = ['coding', 'debugging', 'testing', 'analysis'];
      capabilities.proficiency = {
        coding: 8,
        debugging: 7,
        testing: 6,
        analysis: 7
      };
    } else if (role.includes('写') || role.includes('writer')) {
      capabilities.skills = ['writing', 'documentation', 'communication'];
      capabilities.proficiency = {
        writing: 9,
        documentation: 8,
        communication: 8
      };
    } else if (role.includes('研究') || role.includes('research')) {
      capabilities.skills = ['research', 'analysis', 'documentation'];
      capabilities.proficiency = {
        research: 8,
        analysis: 7,
        documentation: 7
      };
    } else {
      capabilities.skills = ['communication', 'analysis'];
      capabilities.proficiency = {
        communication: 7,
        analysis: 6
      };
    }

    return capabilities;
  }

  /**
   * 更新Agent负载
   */
  async updateAgentLoad(agentId: string, delta: number): Promise<void> {
    const capabilities = this.agentCapabilities.get(agentId);
    if (capabilities) {
      capabilities.currentLoad = Math.max(0, capabilities.currentLoad + delta);
    }
  }

  /**
   * 更新Agent活跃时间
   */
  async updateAgentActivity(agentId: string): Promise<void> {
    const capabilities = this.agentCapabilities.get(agentId);
    if (capabilities) {
      capabilities.lastActiveAt = Date.now();
    }
  }

  /**
   * 设置Agent可用性
   */
  async setAgentAvailability(agentId: string, available: boolean): Promise<void> {
    const capabilities = this.agentCapabilities.get(agentId);
    if (capabilities) {
      capabilities.availability = available;
    }
  }
}
