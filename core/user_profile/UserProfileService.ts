/**
 * 用户画像服务
 */

import { nanoid } from 'nanoid';
import { UserProfile, BehaviorRecord, DEFAULT_USER_PROFILE } from './types/profile';

export class UserProfileService {
  private profile: UserProfile;
  private behaviorRecords: BehaviorRecord[] = [];

  constructor() {
    this.load();
  }

  /**
   * 记录用户行为
   */
  async recordBehavior(record: BehaviorRecord): Promise<void> {
    this.behaviorRecords.push(record);

    // 保留最近1000条记录
    if (this.behaviorRecords.length > 1000) {
      this.behaviorRecords.shift();
    }

    // 分析行为并更新画像
    await this.analyzeAndUpdate();

    await this.save();
  }

  /**
   * 获取用户画像
   */
  getProfile(): UserProfile {
    return this.profile;
  }

  /**
   * 更新用户画像
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    this.profile = {
      ...this.profile,
      ...updates,
      updatedAt: Date.now()
    };

    await this.save();
  }

  /**
   * 重置用户画像
   */
  async resetProfile(): Promise<void> {
    this.profile = {
      ...DEFAULT_USER_PROFILE,
      userId: this.profile.userId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.behaviorRecords = [];

    await this.save();
  }

  /**
   * 导出用户画像为Markdown
   */
  exportToMarkdown(): string {
    const p = this.profile;

    return `# 用户画像

## 基本信息
- 用户ID: ${p.userId}
- 创建时间: ${new Date(p.createdAt).toLocaleDateString()}
- 活跃度: ${this.translateActivityLevel(p.basicInfo.activityLevel)}
- 总会话数: ${p.basicInfo.totalSessions}
- 总消息数: ${p.basicInfo.totalMessages}

## 行为特征
- 对话风格: ${this.translateCommunicationStyle(p.behavior.communicationStyle)}
- 偏好主题: ${p.behavior.preferredTopics.join(', ') || '无'}
- 平均对话时长: ${p.behavior.averageSessionDuration} 分钟
- 活跃时间段: ${p.behavior.activeTimeSlots.join(', ') || '无'}

## 技能与兴趣
- 技能: ${p.skills.join(', ') || '无'}
- 兴趣: ${p.interests.join(', ') || '无'}

## 沟通偏好
- 回复长度: ${this.translateResponseLength(p.communication.responseLength)}
- 代码示例: ${p.communication.likesCodeExamples ? '喜欢' : '不喜欢'}
- 语气: ${this.translateTone(p.communication.tone)}
- 语言: ${p.communication.language === 'zh-CN' ? '中文' : '英文'}

## 使用习惯
- 活跃时间段: ${p.usage.activeTimeSlots.join(', ') || '无'}
- 使用频率: ${this.translateUsageFrequency(p.usage.usageFrequency)}
- 常用Agent: ${p.usage.frequentAgents.join(', ') || '无'}
- 常用功能: ${p.usage.frequentFeatures.join(', ') || '无'}
`;
  }

  /**
   * 分析行为并更新画像
   */
  private async analyzeAndUpdate(): Promise<void> {
    const recentRecords = this.behaviorRecords.slice(-100);

    // 分析活跃度
    this.analyzeActivityLevel(recentRecords);

    // 分析沟通风格
    this.analyzeCommunicationStyle(recentRecords);

    // 分析偏好主题
    this.analyzePreferredTopics(recentRecords);

    // 分析活跃时间段
    this.analyzeActiveTimeSlots(recentRecords);

    // 分析常用Agent
    this.analyzeFrequentAgents(recentRecords);

    // 分析常用功能
    this.analyzeFrequentFeatures(recentRecords);

    this.profile.updatedAt = Date.now();
  }

  private analyzeActivityLevel(records: BehaviorRecord[]): void {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const recentMessages = records.filter(r => r.timestamp > dayAgo && r.type === 'message');

    if (recentMessages.length >= 20) {
      this.profile.basicInfo.activityLevel = 'high';
    } else if (recentMessages.length >= 10) {
      this.profile.basicInfo.activityLevel = 'medium';
    } else {
      this.profile.basicInfo.activityLevel = 'low';
    }

    this.profile.basicInfo.totalMessages = records.filter(r => r.type === 'message').length;
    this.profile.basicInfo.totalSessions = records.filter(r => r.type === 'session_start').length;
  }

  private analyzeCommunicationStyle(records: BehaviorRecord[]): void {
    const messages = records.filter(r => r.type === 'message' && r.data?.content);
    if (messages.length === 0) return;

    const totalLength = messages.reduce((sum, m) => sum + (m.data.content?.length || 0), 0);
    const avgLength = totalLength / messages.length;

    if (avgLength < 30) {
      this.profile.behavior.communicationStyle = 'concise';
    } else if (avgLength > 100) {
      this.profile.behavior.communicationStyle = 'detailed';
    } else {
      this.profile.behavior.communicationStyle = 'interactive';
    }

    if (avgLength < 50) {
      this.profile.communication.responseLength = 'short';
    } else if (avgLength > 150) {
      this.profile.communication.responseLength = 'long';
    } else {
      this.profile.communication.responseLength = 'medium';
    }
  }

  private analyzePreferredTopics(records: BehaviorRecord[]): void {
    // 简化实现：从消息内容中提取关键词
    const messages = records.filter(r => r.type === 'message' && r.data?.content);
    const topics = new Map<string, number>();

    const keywords = ['编程', '代码', '写作', '研究', '分析', '设计', '测试', '部署'];

    for (const message of messages) {
      const content = message.data.content?.toLowerCase() || '';
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          topics.set(keyword, (topics.get(keyword) || 0) + 1);
        }
      }
    }

    // 取前5个主题
    const sortedTopics = Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    this.profile.behavior.preferredTopics = sortedTopics;
  }

  private analyzeActiveTimeSlots(records: BehaviorRecord[]): void {
    const hourCounts = new Map<number, number>();

    for (const record of records) {
      const hour = new Date(record.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // 找出最活跃的时间段
    const sortedSlots = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => `${hour}:00-${hour + 1}:00`);

    this.profile.behavior.activeTimeSlots = sortedSlots;
    this.profile.usage.activeTimeSlots = sortedSlots;
  }

  private analyzeFrequentAgents(records: BehaviorRecord[]): void {
    const agentCounts = new Map<string, number>();

    for (const record of records) {
      if (record.type === 'agent_switch' && record.data?.agentId) {
        agentCounts.set(record.data.agentId, (agentCounts.get(record.data.agentId) || 0) + 1);
      }
    }

    const sortedAgents = Array.from(agentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agentId]) => agentId);

    this.profile.usage.frequentAgents = sortedAgents;
  }

  private analyzeFrequentFeatures(records: BehaviorRecord[]): void {
    const featureCounts = new Map<string, number>();

    for (const record of records) {
      if (record.type === 'feature_use' && record.data?.feature) {
        featureCounts.set(record.data.feature, (featureCounts.get(record.data.feature) || 0) + 1);
      }
    }

    const sortedFeatures = Array.from(featureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([feature]) => feature);

    this.profile.usage.frequentFeatures = sortedFeatures;
  }

  // 翻译辅助方法
  private translateActivityLevel(level: string): string {
    const map = { high: '高', medium: '中', low: '低' };
    return map[level as keyof typeof map] || level;
  }

  private translateCommunicationStyle(style: string): string {
    const map = { concise: '简洁', detailed: '详细', interactive: '互动' };
    return map[style as keyof typeof map] || style;
  }

  private translateResponseLength(length: string): string {
    const map = { short: '短', medium: '中', long: '长' };
    return map[length as keyof typeof map] || length;
  }

  private translateTone(tone: string): string {
    const map = { professional: '专业', friendly: '友好', humorous: '幽默' };
    return map[tone as keyof typeof map] || tone;
  }

  private translateUsageFrequency(frequency: string): string {
    const map = { daily: '每天', weekly: '每周', monthly: '每月' };
    return map[frequency as keyof typeof map] || frequency;
  }

  private async load(): Promise<void> {
    try {
      // 从 localStorage 加载用户画像（用于浏览器环境）
      const saved = localStorage.getItem('user_profile');
      if (saved) {
        this.profile = JSON.parse(saved);
      } else {
        this.profile = { ...DEFAULT_USER_PROFILE, userId: `user_${nanoid(8)}`, createdAt: Date.now(), updatedAt: Date.now() };
      }
    } catch (error) {
      this.profile = { ...DEFAULT_USER_PROFILE, userId: `user_${nanoid(8)}`, createdAt: Date.now(), updatedAt: Date.now() };
    }
  }

  private async save(): Promise<void> {
    // 保存到 localStorage
    try {
      localStorage.setItem('user_profile', JSON.stringify(this.profile));
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  }
}
