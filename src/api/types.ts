export interface Subscription {
  id: string
  userId: string
  sourceType: 'youtube' | 'podcast' | 'news' | 'topic'
  sourceId: string
  sourceName: string
  metadata: Record<string, unknown> | null
  isActive: boolean
  createdAt: string
}

export interface SubscriptionResponse {
  id: string
  user_id: string
  source_type: Subscription['sourceType']
  source_id: string
  source_name: string
  metadata: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export interface ApiErrorPayload {
  error: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function mapSubscriptionResponse(payload: SubscriptionResponse): Subscription {
  return {
    id: payload.id,
    userId: payload.user_id,
    sourceType: payload.source_type,
    sourceId: payload.source_id,
    sourceName: payload.source_name,
    metadata: payload.metadata,
    isActive: payload.is_active,
    createdAt: payload.created_at,
  }
}
