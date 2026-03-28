/**
 * 任务管理界面
 */

import React, { useState, useEffect } from 'react';

interface SubTask {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgent: string;
  dependencies: string[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  startTime?: number;
  endTime?: number;
  subtasks: SubTask[];
}

export function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      setTasks(data.data || []);
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewTask({ title: '', description: '', priority: 'medium' });
        loadTasks();
      }
    } catch (error) {
      console.error('创建任务失败:', error);
    }
  };

  const handleExecuteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/execute`, { method: 'POST' });
      loadTasks();
    } catch (error) {
      console.error('执行任务失败:', error);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!confirm('确定要取消这个任务吗？')) {
      return;
    }

    try {
      await fetch(`/api/tasks/${taskId}/cancel`, { method: 'POST' });
      loadTasks();
    } catch (error) {
      console.error('取消任务失败:', error);
    }
  };

  const handleDecomposeTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/decompose`, { method: 'GET' });
      if (response.ok) {
        loadTasks();
      }
    } catch (error) {
      console.error('分解任务失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* 标题栏 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">任务管理</h1>
          <p className="text-gray-600 mt-1">查看和管理Agent的任务调度</p>
        </div>

        {/* 工具栏 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex justify-between items-center">
          <div className="flex gap-4">
            <button
              onClick={loadTasks}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              刷新
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            创建任务
          </button>
        </div>

        {/* 任务列表 */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            暂无任务
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {task.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleDecomposeTask(task.id)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          分解
                        </button>
                        <button
                          onClick={() => handleExecuteTask(task.id)}
                          className="text-sm text-green-600 hover:text-green-700"
                        >
                          执行
                        </button>
                      </>
                    )}
                    {task.status === 'running' && (
                      <button
                        onClick={() => handleCancelTask(task.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.title}</h3>
                <p className="text-gray-600 mb-3">{task.description}</p>

                <div className="flex gap-2 mb-3">
                  {task.subtasks.length > 0 ? (
                    <button
                      onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {selectedTask?.id === task.id ? '收起' : `查看子任务 (${task.subtasks.length})`}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDecomposeTask(task.id)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      分解任务
                    </button>
                  )}
                </div>

                <div className="text-xs text-gray-400">
                  创建于: {new Date(task.createdAt).toLocaleString()}
                  {task.startTime && ` • 开始于: ${new Date(task.startTime).toLocaleString()}`}
                  {task.endTime && ` • 结束于: ${new Date(task.endTime).toLocaleString()}`}
                </div>

                {/* 子任务列表 */}
                {selectedTask?.id === task.id && task.subtasks.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">子任务</h4>
                    <div className="space-y-2">
                      {task.subtasks.map((subtask) => (
                        <div key={subtask.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(subtask.status)}`}>
                              {subtask.status}
                            </span>
                            <span className="text-xs text-gray-500">
                              {subtask.estimatedDuration} 分钟
                            </span>
                          </div>
                          <h5 className="text-sm font-medium text-gray-900 mb-1">{subtask.title}</h5>
                          <p className="text-xs text-gray-600 mb-2">{subtask.description}</p>
                          <div className="text-xs text-gray-500">
                            分配给: {subtask.assignedAgent}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建任务弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">创建新任务</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="输入任务标题..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="输入任务描述..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateTask}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                创建
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
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
