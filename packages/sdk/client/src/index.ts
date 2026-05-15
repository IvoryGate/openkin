import type { ApiEnvelope } from '@theworld/shared-contracts'

export const CLIENT_SDK_SKELETON_VERSION = '0.2.0-skeleton' as const

export type HealthResponse = ApiEnvelope<{ status: 'ok' }>
