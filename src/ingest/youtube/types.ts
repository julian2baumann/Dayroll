import type { ContentRepository, IngestResult, FetchFn } from '../rss/types'

export interface YouTubePlaylistItem {
  id?: string
  snippet?: {
    title?: string
    description?: string
    publishedAt?: string
    channelId?: string
    channelTitle?: string
    resourceId?: {
      videoId?: string
    }
    thumbnails?: Record<string, { url?: string }>
  }
  contentDetails?: {
    videoId?: string
    videoPublishedAt?: string
  }
}

export interface YouTubeApiResponse {
  nextPageToken?: string
  items?: YouTubePlaylistItem[]
}

export interface YouTubeIngestOptions {
  apiKey?: string
  maxResults?: number
  maxPages?: number
  maxRetries?: number
  timeoutMs?: number
  initialRetryMs?: number
  retryFactor?: number
  randomizeBackoff?: boolean
  delayBetweenMs?: number
}

export interface YouTubeIngestRunOptions extends YouTubeIngestOptions {
  fetch?: FetchFn
  clock?: () => Date
}

export type YouTubeIngestResult = IngestResult

export type YouTubeContentRepository = ContentRepository
