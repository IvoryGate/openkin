import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useAppStore } from './store/appStore'
import OnboardingLayout from './onboarding/OnboardingLayout'
import Step1Welcome from './onboarding/Step1Welcome'
import Step2ApiKey from './onboarding/Step2ApiKey'
import Step3CreateAgent from './onboarding/Step3CreateAgent'
import Step4Complete from './onboarding/Step4Complete'
import ChatPage from './dashboard/ChatPage'
import SettingsPage from './agent_editor/SettingsPage'
import { MemoryManagement } from './dashboard/MemoryManagement'
import { TaskManagement } from './dashboard/TaskManagement'
import { UserProfile } from './dashboard/UserProfile'

// 根路由重定向组件
function RootRedirect() {
  const initialized = useAppStore((state) => state.initialized)
  const activeAgentId = useAppStore((state) => state.activeAgentId)
  
  if (!initialized) {
    return <Navigate to="/onboarding" replace />
  }
  
  // 如果已初始化，跳转到当前 Agent 的对话页面
  if (activeAgentId) {
    return <Navigate to={`/chat/${activeAgentId}`} replace />
  }
  
  // 如果没有活跃 Agent 但已初始化，跳转到第一个 Agent
  return <Navigate to="/chat" replace />
}

const router = createHashRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/onboarding',
    element: <OnboardingLayout />,
    children: [
      { index: true, element: <Step1Welcome /> },
      { path: 'api-key', element: <Step2ApiKey /> },
      { path: 'create-agent', element: <Step3CreateAgent /> },
      { path: 'complete', element: <Step4Complete /> },
    ],
  },
  {
    path: '/chat/:agentId?',
    element: <ChatPage />,
  },
  {
    path: '/settings/:agentId',
    element: <SettingsPage />,
  },
  {
    path: '/memories',
    element: <MemoryManagement />,
  },
  {
    path: '/tasks',
    element: <TaskManagement />,
  },
  {
    path: '/profile',
    element: <UserProfile />,
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
