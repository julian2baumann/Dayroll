import { setTimeout as delay } from 'node:timers/promises'
import pRetry from 'p-retry'
import type { Subscription } from '../../db/schema'
import type { ContentRepository } from '../rss/types'
import { mapPlaylistItemsToContent, deriveUploadsPlaylistId } from './mapper'
import type {
  YouTubeApiResponse,
  YouTubeIngestResult,
  YouTubeIngestRunOptions,
  YouTubePlaylistItem,
} from './types'

const API_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlistItems'

const DEFAULT_OPTIONS = {
  maxResults: 50,
  maxPages: 5,
  maxRetries: 3,
  timeoutMs: 15_000,
  initialRetryMs: 500,
  retryFactor: 2,
  randomizeBackoff: true,
  delayBetweenMs: 0,
}

function resolveFetch(
  fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  if (fetchFn) return fetchFn
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis)
  }
  throw new Error('global fetch is not available; provide a custom fetch implementation')
}

async function fetchPlaylistPage(
  playlistId: string,
  apiKey: string,
  pageToken: string | undefined,
  fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  timeoutMs: number,
  maxResults: number,
): Promise<YouTubeApiResponse> {
  const controller = new AbortController()
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = new URL(API_ENDPOINT)
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('maxResults', String(Math.min(50, Math.max(1, maxResults))))
    url.searchParams.set('key', apiKey)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetchFn(url, {
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`YouTube API error ${response.status}: ${body}`)
    }

    return (await response.json()) as YouTubeApiResponse
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function ingestYouTubeSubscription(
  repository: ContentRepository,
  subscription: Subscription,
  options: YouTubeIngestRunOptions = {},
): Promise<YouTubeIngestResult> {
  const now = options.clock ? options.clock() : new Date()

  if (subscription.sourceType !== 'youtube') {
    return {
      subscriptionId: subscription.id,
      attempted: 0,
      ingested: 0,
      skipped: 0,
      errors: 0,
      feedTitle: subscription.sourceName,
      fetchedAt: now,
    }
  }

  const apiKey = options.apiKey
  if (!apiKey) {
    return {
      subscriptionId: subscription.id,
      attempted: 0,
      ingested: 0,
      skipped: 0,
      errors: 1,
      feedTitle: subscription.sourceName,
      fetchedAt: now,
    }
  }

  const playlistId = deriveUploadsPlaylistId(subscription.sourceId)
  if (!playlistId) {
    return {
      subscriptionId: subscription.id,
      attempted: 0,
      ingested: 0,
      skipped: 0,
      errors: 1,
      feedTitle: subscription.sourceName,
      fetchedAt: now,
    }
  }

  const fetchFn = resolveFetch(options.fetch)
  const merged = { ...DEFAULT_OPTIONS, ...options }
  const retries = Math.max(0, (merged.maxRetries ?? DEFAULT_OPTIONS.maxRetries) - 1)

  try {
    const items: YouTubePlaylistItem[] = []
    let pageToken: string | undefined
    let pageCount = 0

    do {
      const page = await pRetry(
        () =>
          fetchPlaylistPage(
            playlistId,
            apiKey,
            pageToken,
            fetchFn,
            merged.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs,
            merged.maxResults ?? DEFAULT_OPTIONS.maxResults,
          ),
        {
          retries,
          factor: merged.retryFactor ?? DEFAULT_OPTIONS.retryFactor,
          minTimeout: merged.initialRetryMs ?? DEFAULT_OPTIONS.initialRetryMs,
          randomize: merged.randomizeBackoff ?? DEFAULT_OPTIONS.randomizeBackoff,
        },
      )

      if (page.items?.length) {
        items.push(...page.items)
      }

      pageToken = page.nextPageToken
      pageCount += 1
    } while (pageToken && pageCount < (merged.maxPages ?? DEFAULT_OPTIONS.maxPages))

    const mapResult = mapPlaylistItemsToContent(
      items,
      subscription.sourceId,
      subscription.sourceName ?? undefined,
      now,
    )

    const ingested = mapResult.entries.length ? await repository.upsertMany(mapResult.entries) : 0

    return {
      subscriptionId: subscription.id,
      attempted: items.length,
      ingested,
      skipped: mapResult.skipped.length,
      errors: 0,
      feedTitle: subscription.sourceName,
      fetchedAt: now,
    }
  } catch {
    return {
      subscriptionId: subscription.id,
      attempted: 0,
      ingested: 0,
      skipped: 0,
      errors: 1,
      feedTitle: subscription.sourceName,
      fetchedAt: now,
    }
  }
}

export async function ingestYouTubeSubscriptions(
  repository: ContentRepository,
  subscriptions: Subscription[],
  options: YouTubeIngestRunOptions = {},
): Promise<YouTubeIngestResult[]> {
  const results: YouTubeIngestResult[] = []
  for (const subscription of subscriptions) {
    const result = await ingestYouTubeSubscription(repository, subscription, options)
    results.push(result)
    if ((options.delayBetweenMs ?? DEFAULT_OPTIONS.delayBetweenMs) > 0) {
      await delay(options.delayBetweenMs ?? DEFAULT_OPTIONS.delayBetweenMs)
    }
  }
  return results
}
