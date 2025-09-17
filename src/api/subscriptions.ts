import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import type { Subscription, SubscriptionResponse } from './types'
import { ApiError, mapSubscriptionResponse } from './types'

const SUBSCRIPTIONS_QUERY_KEY = ['subscriptions']

async function request<T>(
  token: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' }))
    const message = typeof payload?.error === 'string' ? payload.error : 'Request failed'
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    // @ts-expect-error - callers know when no payload is returned
    return undefined
  }

  return (await response.json()) as T
}

export function useSubscriptionsQuery() {
  const { session } = useAuth()
  const token = session?.access_token

  const enabled = Boolean(token)

  return useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      if (!token) return []
      const data = await request<SubscriptionResponse[]>(token, '/api/subscriptions')
      return data.map(mapSubscriptionResponse)
    },
  })
}

export interface CreateSubscriptionInput {
  sourceType: Subscription['sourceType']
  sourceId: string
  sourceName: string
  metadata?: Record<string, unknown> | null
}

export function useCreateSubscriptionMutation() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const mutate = useCallback(
    async (input: CreateSubscriptionInput) => {
      if (!token) {
        throw new ApiError('Missing auth token', 401)
      }

      const payload = {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceName: input.sourceName,
        metadata: input.metadata ?? null,
      }

      const created = await request<SubscriptionResponse>(token, '/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      await queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY })

      return mapSubscriptionResponse(created)
    },
    [token, queryClient],
  )

  return useMutation({
    mutationKey: ['create-subscription'],
    mutationFn: mutate,
  })
}
