import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { ApiError } from './types'
import { getApiUrl } from '../lib/env'

export type ListenStatus = 'created' | 'cached'

export interface ListenAssetDto {
  id: string
  contentItemId: string
  audioUrl: string
  expiresAt: string
}

export interface ListenRateLimitMeta {
  remaining: number
  resetAt: string
}

export interface ListenResponse {
  status: ListenStatus
  asset: ListenAssetDto
  rateLimit: ListenRateLimitMeta
}

async function requestListen(token: string, contentItemId: string): Promise<ListenResponse> {
  const response = await fetch(getApiUrl(`/api/listen/${contentItemId}`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({ error: 'Failed to generate Listen asset' }))
    const retryAfter = typeof payload?.retryAfter === 'number' ? payload.retryAfter : null
    const message =
      typeof payload?.error === 'string' ? payload.error : 'Failed to generate Listen asset'
    const error = new ApiError(message, response.status)
    if (retryAfter !== null) {
      ;(error as ApiError & { retryAfter?: number }).retryAfter = retryAfter
    }
    throw error
  }

  return (await response.json()) as ListenResponse
}

export function useListenMutation() {
  const { session } = useAuth()
  const token = session?.access_token

  return useMutation<ListenResponse, ApiError, { contentItemId: string }>({
    mutationKey: ['listen'],
    mutationFn: async ({ contentItemId }) => {
      if (!token) throw new ApiError('Missing auth token', 401)
      return requestListen(token, contentItemId)
    },
  })
}
