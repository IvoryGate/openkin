const gHeartbeat = {
  scheduler: 0,
  taskSse: 0,
}

export type HeartbeatComponent = keyof typeof gHeartbeat

export function markHeartbeat(component: HeartbeatComponent, ts = Date.now()): void {
  gHeartbeat[component] = ts
}

export function getHeartbeatView(): {
  scheduler: number
  taskSse: number
} {
  return { ...gHeartbeat }
}
