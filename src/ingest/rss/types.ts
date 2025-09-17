import type { ContentUpsertInput } from '../../db/validation'

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface RssFeedItem {
  id: string
  title: string
  link: string
  description?: string
  publishedAt?: Date
  author?: string
  enclosureUrl?: string
  imageUrl?: string
}

export interface ParsedRssFeed {
  title?: string
  link?: string
  imageUrl?: string
  items: RssFeedItem[]
}

export interface SkippedItem {
  item: RssFeedItem
  reason: string
}

export interface MapContentResult {
  entries: ContentUpsertInput[]
  skipped: SkippedItem[]
}

export interface RssMapperOptions {
  sourceType: 'news' | 'podcast'
  fallbackCreator?: string
  fallbackImage?: string
  now?: Date
}

export interface IngestResult {
  subscriptionId: string
  attempted: number
  ingested: number
  skipped: number
  errors: number
  feedTitle?: string
  fetchedAt: Date
}

export interface RssIngestOptions {
  maxRetries?: number
  timeoutMs?: number
  initialRetryMs?: number
  retryFactor?: number
  randomizeBackoff?: boolean
  delayBetweenMs?: number
}

export interface RssIngestRunOptions extends RssIngestOptions {
  fetch?: FetchFn
  clock?: () => Date
}

export type ContentRepository = {
  upsertMany: (items: ContentUpsertInput[]) => Promise<number>
}
