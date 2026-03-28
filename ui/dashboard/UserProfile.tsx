/**
 * 用户画像管理界面
 */

import React, { useState, useEffect } from 'react';

interface UserProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;
  basicInfo: {
    activityLevel: 'high' | 'medium' | 'low';
    totalSessions: number;
    totalMessages: number;
  };
  behavior: {
    communicationStyle: 'concise' | 'detailed' | 'interactive';
    preferredTopics: string[];
    averageSessionDuration: number;
    activeTimeSlots: string[];
  };
  skills: string[];
  interests: string[];
  communication: {
    responseLength: 'short' | 'medium' | 'long';
    likesCodeExamples: boolean;
    tone: 'professional' | 'friendly' | 'humorous';
    language: 'zh-CN' | 'en-US';
  };
  usage: {
    activeTimeSlots: string[];
    usageFrequency: 'daily' | 'weekly' | 'monthly';
    frequentAgents: string[];
    frequentFeatures: string[];
  };
}

export function UserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/profile');
      const data = await response.json();
      setProfile(data.data);
    } catch (error) {
      console.error('加载用户画像失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        setEditing(false);
        setEditData({});
        loadProfile();
      }
    } catch (error) {
      console.error('更新用户画像失败:', error);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置用户画像吗？此操作将清除所有学习数据。')) {
      return;
    }

    try {
      const response = await fetch('/api/user/profile/reset', {
        method: 'POST'
      });

      if (response.ok) {
        loadProfile();
      }
    } catch (error) {
      console.error('重置用户画像失败:', error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/user/profile/markdown');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user_profile.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出用户画像失败:', error);
    }
  };

  const translateActivityLevel = (level: string) => {
    const map = { high: '高', medium: '中', low: '低' };
    return map[level as keyof typeof map] || level;
  };

  const translateCommunicationStyle = (style: string) => {
    const map = { concise: '简洁', detailed: '详细', interactive: '互动' };
    return map[style as keyof typeof map] || style;
  };

  const translateResponseLength = (length: string) => {
    const map = { short: '短', medium: '中', long: '长' };
    return map[length as keyof typeof map] || length;
  };

  const translateTone = (tone: string) => {
    const map = { professional: '专业', friendly: '友好', humorous: '幽默' };
    return map[tone as keyof typeof map] || tone;
  };

  const translateUsageFrequency = (frequency: string) => {
    const map = { daily: '每天', weekly: '每周', monthly: '每月' };
    return map[frequency as keyof typeof map] || frequency;
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            暂无用户画像数据
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* 标题栏 */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">用户画像</h1>
            <p className="text-gray-600 mt-1">查看和管理您的个性化画像</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              导出Markdown
            </button>
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              编辑
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              重置
            </button>
          </div>
        </div>

        {editing ? (
          /* 编辑模式 */
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">编辑用户画像</h2>

            <div className="space-y-6">
              {/* 沟通偏好 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">沟通偏好</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">回复长度</label>
                    <select
                      value={editData.communication?.responseLength || profile.communication.responseLength}
                      onChange={(e) => setEditData({
                        ...editData,
                        communication: {
                          ...editData.communication,
                          ...profile.communication,
                          responseLength: e.target.value as any
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="short">短</option>
                      <option value="medium">中</option>
                      <option value="long">长</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">语气</label>
                    <select
                      value={editData.communication?.tone || profile.communication.tone}
                      onChange={(e) => setEditData({
                        ...editData,
                        communication: {
                          ...editData.communication,
                          ...profile.communication,
                          tone: e.target.value as any
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="professional">专业</option>
                      <option value="friendly">友好</option>
                      <option value="humorous">幽默</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">语言</label>
                    <select
                      value={editData.communication?.language || profile.communication.language}
                      onChange={(e) => setEditData({
                        ...editData,
                        communication: {
                          ...editData.communication,
                          ...profile.communication,
                          language: e.target.value as any
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="zh-CN">中文</option>
                      <option value="en-US">英文</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editData.communication?.likesCodeExamples ?? profile.communication.likesCodeExamples}
                        onChange={(e) => setEditData({
                          ...editData,
                          communication: {
                            ...editData.communication,
                            ...profile.communication,
                            likesCodeExamples: e.target.checked
                          }
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">喜欢代码示例</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 技能 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">技能</h3>
                <textarea
                  value={editData.skills?.join(', ') || profile.skills.join(', ')}
                  onChange={(e) => setEditData({
                    ...editData,
                    skills: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="输入技能，用逗号分隔..."
                />
              </div>

              {/* 兴趣 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">兴趣</h3>
                <textarea
                  value={editData.interests?.join(', ') || profile.interests.join(', ')}
                  onChange={(e) => setEditData({
                    ...editData,
                    interests: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="输入兴趣，用逗号分隔..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditData({});
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          /* 查看模式 */
          <>
            {/* 基本信息 */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">👤</span>
                基本信息
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">用户ID</label>
                  <p className="text-gray-900 mt-1">{profile.userId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">活跃度</label>
                  <p className="text-gray-900 mt-1">{translateActivityLevel(profile.basicInfo.activityLevel)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">总会话数</label>
                  <p className="text-gray-900 mt-1">{profile.basicInfo.totalSessions}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">总消息数</label>
                  <p className="text-gray-900 mt-1">{profile.basicInfo.totalMessages}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">创建时间</label>
                  <p className="text-gray-900 mt-1">{new Date(profile.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">更新时间</label>
                  <p className="text-gray-900 mt-1">{new Date(profile.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* 行为特征 */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">🎯</span>
                行为特征
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">对话风格</label>
                  <p className="text-gray-900 mt-1">{translateCommunicationStyle(profile.behavior.communicationStyle)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">平均对话时长</label>
                  <p className="text-gray-900 mt-1">{profile.behavior.averageSessionDuration} 分钟</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">偏好主题</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {profile.behavior.preferredTopics.length > 0 ? (
                      profile.behavior.preferredTopics.map((topic, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {topic}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">暂无</p>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">活跃时间段</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {profile.behavior.activeTimeSlots.length > 0 ? (
                      profile.behavior.activeTimeSlots.map((slot, index) => (
                        <span key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                          {slot}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">暂无</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 技能与兴趣 */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">💡</span>
                技能与兴趣
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">技能</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {profile.skills.length > 0 ? (
                      profile.skills.map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">暂无</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">兴趣</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {profile.interests.length > 0 ? (
                      profile.interests.map((interest, index) => (
                        <span key={index} className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm">
                          {interest}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">暂无</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 沟通偏好 */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">💬</span>
                沟通偏好
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">回复长度</label>
                  <p className="text-gray-900 mt-1">{translateResponseLength(profile.communication.responseLength)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">语气</label>
                  <p className="text-gray-900 mt-1">{translateTone(profile.communication.tone)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">语言</label>
                  <p className="text-gray-900 mt-1">{profile.communication.language === 'zh-CN' ? '中文' : '英文'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">代码示例</label>
                  <p className="text-gray-900 mt-1">{profile.communication.likesCodeExamples ? '喜欢' : '不喜欢'}</p>
                </div>
              </div>
            </div>

            {/* 使用习惯 */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">📊</span>
                使用习惯
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">使用频率</label>
                  <p className="text-gray-900 mt-1">{translateUsageFrequency(profile.usage.usageFrequency)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">活跃时间段</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {profile.usage.activeTimeSlots.length > 0 ? (
                      profile.usage.activeTimeSlots.slice(0, 2).map((slot, index) => (
                        <span key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                          {slot}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">暂无</p>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">常用Agent</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {profile.usage.frequentAgents.length > 0 ? (
                      profile.usage.frequentAgents.map((agent, index) => (
                        <span key={index} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                          {agent}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">暂无</p>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">常用功能</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    {profile.usage.frequentFeatures.length > 0 ? (
                      profile.usage.frequentFeatures.map((feature, index) => (
                        <span key={index} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                          {feature}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">暂无</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
