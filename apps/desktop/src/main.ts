import { RUN_FINAL_STATUSES } from '@theworld/shared-contracts'

export const DESKTOP_SKELETON_VERSION = '0.2.0-skeleton' as const

export function desktopSkeletonReady(): boolean {
  return RUN_FINAL_STATUSES.length > 0
}
