import { describe, it, expect } from 'vitest'
import type { Agent, Message, ApiKeyConfig } from '../../ui/types'

describe('Types', () => {
  it('should define Agent type correctly', () => {
    const agent: Agent = {
      id: 'test-id',
      name: 'Test Agent',
      role: 'general',
      description: 'A test agent',
      createdAt: new Date().toISOString(),
      soulMdPath: '/path/to/soul.md',
    }
    expect(agent.id).toBe('test-id')
    expect(agent.name).toBe('Test Agent')
  })

  it('should define Message type correctly', () => {
    const message: Message = {
      id: 'msg-id',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      status: 'done',
    }
    expect(message.role).toBe('user')
    expect(message.status).toBe('done')
  })

  it('should define ApiKeyConfig type correctly', () => {
    const config: ApiKeyConfig = {
      openai: 'sk-test',
      anthropic: '',
      customEndpoint: '',
    }
    expect(config.openai).toBe('sk-test')
  })
})

describe('Store Imports', () => {
  it('should import appStore', async () => {
    const { useAppStore } = await import('../../ui/store/appStore')
    expect(useAppStore).toBeDefined()
  })

  it('should import agentStore', async () => {
    const { useAgentStore, AGENT_TEMPLATES } = await import('../../ui/store/agentStore')
    expect(useAgentStore).toBeDefined()
    expect(AGENT_TEMPLATES).toHaveLength(3)
  })

  it('should import chatStore', async () => {
    const { useChatStore } = await import('../../ui/store/chatStore')
    expect(useChatStore).toBeDefined()
  })
})

describe('Component Imports', () => {
  it('should import ProgressSteps', async () => {
    const { ProgressSteps } = await import('../../ui/components/ProgressSteps')
    expect(ProgressSteps).toBeDefined()
  })

  it('should import ApiKeyInput', async () => {
    const { ApiKeyInput } = await import('../../ui/components/ApiKeyInput')
    expect(ApiKeyInput).toBeDefined()
  })

  it('should import AgentTemplateCard', async () => {
    const { AgentTemplateCard } = await import('../../ui/components/AgentTemplateCard')
    expect(AgentTemplateCard).toBeDefined()
  })
})

describe('Page Imports', () => {
  it('should import Onboarding pages', async () => {
    const Onboarding = await import('../../ui/onboarding')
    expect(Onboarding.OnboardingLayout).toBeDefined()
    expect(Onboarding.Step1Welcome).toBeDefined()
    expect(Onboarding.Step2ApiKey).toBeDefined()
    expect(Onboarding.Step3CreateAgent).toBeDefined()
    expect(Onboarding.Step4Complete).toBeDefined()
  })

  it('should import Chat pages', async () => {
    const Chat = await import('../../ui/dashboard')
    expect(Chat.ChatPage).toBeDefined()
    expect(Chat.MessageList).toBeDefined()
    expect(Chat.MessageBubble).toBeDefined()
    expect(Chat.InputBar).toBeDefined()
  })

  it('should import Settings pages', async () => {
    const Settings = await import('../../ui/agent_editor')
    expect(Settings.SettingsPage).toBeDefined()
    expect(Settings.SoulEditor).toBeDefined()
  })
})

describe('Hook Imports', () => {
  it('should import hooks', async () => {
    const hooks = await import('../../ui/hooks')
    expect(hooks.useIpc).toBeDefined()
    expect(hooks.useIpcEvent).toBeDefined()
    expect(hooks.useAgent).toBeDefined()
    expect(hooks.useAgentList).toBeDefined()
  })
})
