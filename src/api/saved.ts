import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { ApiError } from './types'
import type { TodayFeedItem } from './feed'
import { getApiUrl } from '../lib/env'

export interface SavedFeedItem extends TodayFeedItem {
  savedAt: string
}

export interface SavedItemsResponse {
  generatedAt: string
  items: SavedFeedItem[]
}

const SAVED_ITEMS_QUERY_KEY = ['saved-items']

async function fetchSavedItems(
  token: string,
  params: { limit: number; offset: number },
): Promise<SavedItemsResponse> {
  const search = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  const response = await fetch(getApiUrl(`/api/save?${search.toString()}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Failed to load saved items' }))
    const message =
      typeof payload?.error === 'string' ? payload.error : 'Failed to load saved items'
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as SavedItemsResponse
}

export function useSavedItemsQuery(params: { limit?: number; offset?: number } = {}) {
  const { session } = useAuth()
  const token = session?.access_token
  const { limit = 100, offset = 0 } = params

  return useQuery({
    queryKey: [...SAVED_ITEMS_QUERY_KEY, limit, offset],
    enabled: Boolean(token),
    queryFn: () => {
      if (!token) throw new ApiError('Missing auth token', 401)
      return fetchSavedItems(token, { limit, offset })
    },
    staleTime: 30_000,
  })
}

export function getSavedItemsQueryKey(limit = 100, offset = 0) {
  return [...SAVED_ITEMS_QUERY_KEY, limit, offset] as const
}
