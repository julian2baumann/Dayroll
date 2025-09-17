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
  isSaved: boolean
}

export interface TodayFeedResponse {
  generatedAt: string
  groups: TodayFeedGroup[]
}

export interface FeedListResponse {
  type: 'youtube' | 'podcast' | 'news'
  range: 'today' | '3d' | '7d'
  generatedAt: string
  sections: Array<{
    label: string
    items: TodayFeedItem[]
  }>
}

const TODAY_FEED_QUERY_KEY = ['today-feed']
const FEED_LIST_QUERY_KEY = ['feed-list']

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

async function fetchFeedList(
  token: string,
  type: FeedListResponse['type'],
  range: FeedListResponse['range'],
  limit: number,
  offset: number,
): Promise<FeedListResponse> {
  const params = new URLSearchParams({ range, limit: String(limit), offset: String(offset) })
  const response = await fetch(`/api/feed/${type}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Failed to fetch feed' }))
    const message = typeof payload?.error === 'string' ? payload.error : 'Failed to fetch feed'
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as FeedListResponse
}

export function useFeedListQuery(params: {
  type: FeedListResponse['type']
  range: FeedListResponse['range']
  limit?: number
  offset?: number
}) {
  const { session } = useAuth()
  const token = session?.access_token
  const { type, range, limit = 50, offset = 0 } = params

  return useQuery({
    queryKey: [...FEED_LIST_QUERY_KEY, type, range, limit, offset],
    enabled: Boolean(token),
    queryFn: () => {
      if (!token) throw new ApiError('Missing auth token', 401)
      return fetchFeedList(token, type, range, limit, offset)
    },
    staleTime: 60_000,
  })
}

export function isFeedListQueryKey(
  queryKey: unknown,
): queryKey is ReturnType<typeof buildFeedListQueryKey> {
  return Array.isArray(queryKey) && queryKey[0] === FEED_LIST_QUERY_KEY[0]
}

export function buildFeedListQueryKey(
  type: FeedListResponse['type'],
  range: FeedListResponse['range'],
  limit = 50,
  offset = 0,
) {
  return [...FEED_LIST_QUERY_KEY, type, range, limit, offset] as const
}

export function getTodayFeedQueryKey() {
  return TODAY_FEED_QUERY_KEY
}

export interface ForYouResponse {
  generatedAt: string
  items: TodayFeedItem[]
}

const FOR_YOU_QUERY_KEY = ['for-you']

async function fetchForYou(token: string, limit: number): Promise<ForYouResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  const response = await fetch(`/api/for-you?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Failed to load For You items' }))
    const message =
      typeof payload?.error === 'string' ? payload.error : 'Failed to load For You items'
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as ForYouResponse
}

export function useForYouQuery(limit = 5) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery({
    queryKey: [...FOR_YOU_QUERY_KEY, limit],
    enabled: Boolean(token),
    queryFn: () => {
      if (!token) throw new ApiError('Missing auth token', 401)
      return fetchForYou(token, limit)
    },
    staleTime: 60_000,
  })
}

export function getForYouQueryKey(limit = 5) {
  return [...FOR_YOU_QUERY_KEY, limit] as const
}
