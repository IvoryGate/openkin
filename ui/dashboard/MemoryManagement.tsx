/**
 * 记忆管理界面
 */

import React, { useState, useEffect } from 'react';

interface Memory {
  id: string;
  type: 'preference' | 'knowledge' | 'conversation' | 'context';
  content: string;
  importance: number;
  tags: string[];
  createdAt: number;
  accessCount: number;
}

interface MemoryManagementProps {
  agentId?: string;
}

export function MemoryManagement({ agentId }: MemoryManagementProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemory, setNewMemory] = useState({
    content: '',
    importance: 5,
    tags: '',
    type: 'preference' as const
  });

  useEffect(() => {
    loadMemories();
  }, [agentId]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/memories/${agentId || 'default'}`);
      const data = await response.json();
      setMemories(data.data || []);
    } catch (error) {
      console.error('加载记忆失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        query: searchQuery,
        limit: '20'
      });
      
      if (selectedType !== 'all') {
        params.append('type', selectedType);
      }
      
      const response = await fetch(`/api/memories/search?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          type: selectedType !== 'all' ? selectedType as any : undefined
        })
      });
      
      const data = await response.json();
      setMemories(data.data || []);
    } catch (error) {
      console.error('搜索记忆失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMemory = async () => {
    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMemory,
          tags: newMemory.tags.split(',').map(t => t.trim()).filter(t => t),
          agentId: agentId || 'default'
        })
      });
      
      if (response.ok) {
        setShowAddModal(false);
        setNewMemory({ content: '', importance: 5, tags: '', type: 'preference' });
        loadMemories();
      }
    } catch (error) {
      console.error('添加记忆失败:', error);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!confirm('确定要删除这条记忆吗？')) {
      return;
    }
    
    try {
      await fetch(`/api/memories/${memoryId}`, {
        method: 'DELETE'
      });
      loadMemories();
    } catch (error) {
      console.error('删除记忆失败:', error);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      preference: '偏好',
      knowledge: '知识',
      conversation: '对话',
      context: '上下文'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      preference: 'bg-blue-100 text-blue-800',
      knowledge: 'bg-green-100 text-green-800',
      conversation: 'bg-yellow-100 text-yellow-800',
      context: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getImportanceColor = (importance: number) => {
    if (importance >= 8) return 'text-red-600';
    if (importance >= 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* 标题栏 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">记忆管理</h1>
          <p className="text-gray-600 mt-1">查看和管理Agent的长期记忆</p>
        </div>

        {/* 搜索和筛选 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜索记忆..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部类型</option>
              <option value="preference">偏好</option>
              <option value="knowledge">知识</option>
              <option value="conversation">对话</option>
              <option value="context">上下文</option>
            </select>

            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              搜索
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              添加记忆
            </button>
          </div>
        </div>

        {/* 记忆列表 */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : memories.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            暂无记忆
          </div>
        ) : (
          <div className="space-y-4">
            {memories.map((memory) => (
              <div key={memory.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(memory.type)}`}>
                      {getTypeLabel(memory.type)}
                    </span>
                    <span className={`text-sm font-medium ${getImportanceColor(memory.importance)}`}>
                      重要性: {memory.importance}/10
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-sm text-gray-500">
                      访问: {memory.accessCount}次
                    </span>
                    <button
                      onClick={() => handleDeleteMemory(memory.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      删除
                    </button>
                  </div>
                </div>

                <p className="text-gray-700 mb-2">{memory.content}</p>

                {memory.tags.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {memory.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-2">
                  创建于: {new Date(memory.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加记忆弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">添加新记忆</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <select
                  value={newMemory.type}
                  onChange={(e) => setNewMemory({ ...newMemory, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="preference">偏好</option>
                  <option value="knowledge">知识</option>
                  <option value="conversation">对话</option>
                  <option value="context">上下文</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea
                  value={newMemory.content}
                  onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="输入记忆内容..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">重要性 (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newMemory.importance}
                  onChange={(e) => setNewMemory({ ...newMemory, importance: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
                <input
                  type="text"
                  value={newMemory.tags}
                  onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="例如: 技能, 偏好"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddMemory}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                添加
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
