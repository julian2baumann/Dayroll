import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { ApiError } from './types'

export type TodayFeedGroup = {
  type: 'youtube' | 'podcast' | 'news' | 'recommendation'
  title: string
  items: TodayFeedItem[]
}

export interface TodayFeedItem {
  id: string
  sourceType: TodayFeedGroup['type']
  sourceId: string
  title: string
  creator: string | null
  url: string
  thumbnailUrl: string | null
  description: string | null
  summary: string | null
  topics: string[] | null
  durationSeconds: number | null
  publishedAt: string
  timeAgo: string
}

export interface TodayFeedResponse {
  generatedAt: string
  groups: TodayFeedGroup[]
}

const TODAY_FEED_QUERY_KEY = ['today-feed']

async function fetchTodayFeed(token: string): Promise<TodayFeedResponse> {
  const response = await fetch('/api/feed/today', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Failed to fetch feed' }))
    const message = typeof payload?.error === 'string' ? payload.error : 'Failed to fetch feed'
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as TodayFeedResponse
}

export function useTodayFeedQuery() {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery({
    queryKey: TODAY_FEED_QUERY_KEY,
    enabled: Boolean(token),
    queryFn: () => {
      if (!token) throw new ApiError('Missing auth token', 401)
      return fetchTodayFeed(token)
    },
    staleTime: 60_000,
  })
}
