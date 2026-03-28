import { useCallback, useEffect, useRef } from 'react'

/**
 * IPC 调用封装 Hook
 * 提供统一的错误处理和加载状态管理
 */
export function useIpc() {
  const isMounted = useRef(true)
  
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])
  
  /**
   * 安全调用 IPC 方法
   */
  const invoke = useCallback(async <T,>(
    channel: string,
    ...args: unknown[]
  ): Promise<T | null> => {
    try {
      const result = await (window.electronAPI as Record<string, (...args: unknown[]) => Promise<T>>)[channel](...args)
      return result
    } catch (error) {
      console.error(`IPC error [${channel}]:`, error)
      return null
    }
  }, [])
  
  return { invoke }
}

/**
 * 订阅 IPC 事件
 */
export function useIpcEvent<T>(
  subscribe: (callback: (data: T) => void) => () => void,
  callback: (data: T) => void
) {
  useEffect(() => {
    const unsubscribe = subscribe(callback)
    return unsubscribe
  }, [subscribe, callback])
}
