/**
 * 用户画像类型定义
 */

export interface UserProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;

  // 基本信息
  basicInfo: {
    activityLevel: 'high' | 'medium' | 'low';
    totalSessions: number;
    totalMessages: number;
  };

  // 行为特征
  behavior: {
    communicationStyle: 'concise' | 'detailed' | 'interactive';
    preferredTopics: string[];
    averageSessionDuration: number; // 分钟
    activeTimeSlots: string[]; // 活跃时间段
  };

  // 技能与兴趣
  skills: string[];
  interests: string[];

  // 沟通偏好
  communication: {
    responseLength: 'short' | 'medium' | 'long';
    likesCodeExamples: boolean;
    tone: 'professional' | 'friendly' | 'humorous';
    language: 'zh-CN' | 'en-US';
  };

  // 使用习惯
  usage: {
    activeTimeSlots: string[];
    usageFrequency: 'daily' | 'weekly' | 'monthly';
    frequentAgents: string[];
    frequentFeatures: string[];
  };
}

export interface BehaviorRecord {
  timestamp: number;
  type: 'message' | 'session_start' | 'session_end' | 'agent_switch' | 'feature_use';
  data: any;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  userId: '',
  createdAt: 0,
  updatedAt: 0,
  basicInfo: {
    activityLevel: 'medium',
    totalSessions: 0,
    totalMessages: 0
  },
  behavior: {
    communicationStyle: 'detailed',
    preferredTopics: [],
    averageSessionDuration: 0,
    activeTimeSlots: []
  },
  skills: [],
  interests: [],
  communication: {
    responseLength: 'medium',
    likesCodeExamples: true,
    tone: 'professional',
    language: 'zh-CN'
  },
  usage: {
    activeTimeSlots: [],
    usageFrequency: 'daily',
    frequentAgents: [],
    frequentFeatures: []
  }
};
