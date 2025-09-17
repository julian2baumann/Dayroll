import { setTimeout as delay } from 'node:timers/promises'
import pRetry from 'p-retry'
import type { Subscription } from '../../db/schema'
import { mapRssItemsToContent, parseRss } from './parser'
import type { ContentRepository, IngestResult, RssIngestRunOptions, FetchFn } from './types'

const DEFAULT_USER_AGENT = 'DayrollIngestor/0.1 (+https://dayroll.app)'

const DEFAULT_OPTIONS = {
  maxRetries: 3,
  timeoutMs: 15_000,
  initialRetryMs: 500,
  retryFactor: 2,
  randomizeBackoff: true,
  delayBetweenMs: 0,
}

async function fetchFeed(url: string, fetchFn: FetchFn, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(url, {
      headers: {
        accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
        'user-agent': DEFAULT_USER_AGENT,
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`RSS fetch failed with status ${response.status}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeoutId)
  }
}

function resolveFetch(fetchFn?: FetchFn): FetchFn {
  if (fetchFn) return fetchFn
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis)
  }
  throw new Error('global fetch is not available; provide a custom fetch implementation')
}

export async function ingestRssSubscription(
  repository: ContentRepository,
  subscription: Subscription,
  options: RssIngestRunOptions = {},
): Promise<IngestResult> {
  if (subscription.sourceType !== 'news' && subscription.sourceType !== 'podcast') {
    const now = options.clock ? options.clock() : new Date()
    return {
      subscriptionId: subscription.id,
      attempted: 0,
      ingested: 0,
      skipped: 0,
      errors: 0,
      feedTitle: undefined,
      fetchedAt: now,
    }
  }

  const fetchFn = resolveFetch(options.fetch)
  const clock = options.clock ?? (() => new Date())
  const now = clock()

  const merged = { ...DEFAULT_OPTIONS, ...options }
  const retries = Math.max(0, (merged.maxRetries ?? DEFAULT_OPTIONS.maxRetries) - 1)

  try {
    const xml = await pRetry(
      () =>
        fetchFeed(subscription.sourceId, fetchFn, merged.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs),
      {
        retries,
        factor: merged.retryFactor ?? DEFAULT_OPTIONS.retryFactor,
        minTimeout: merged.initialRetryMs ?? DEFAULT_OPTIONS.initialRetryMs,
        randomize: merged.randomizeBackoff ?? DEFAULT_OPTIONS.randomizeBackoff,
      },
    )

    const feed = parseRss(xml)
    const mapResult = mapRssItemsToContent(
      feed,
      { sourceId: subscription.sourceId, sourceName: subscription.sourceName ?? undefined },
      {
        sourceType: subscription.sourceType === 'podcast' ? 'podcast' : 'news',
        fallbackCreator: subscription.sourceName ?? undefined,
        fallbackImage: feed.imageUrl ?? undefined,
        now,
      },
    )

    const upserted =
      mapResult.entries.length > 0 ? await repository.upsertMany(mapResult.entries) : 0

    return {
      subscriptionId: subscription.id,
      attempted: feed.items.length,
      ingested: upserted,
      skipped: mapResult.skipped.length,
      errors: 0,
      feedTitle: feed.title,
      fetchedAt: now,
    }
  } catch {
    return {
      subscriptionId: subscription.id,
      attempted: 0,
      ingested: 0,
      skipped: 0,
      errors: 1,
      feedTitle: undefined,
      fetchedAt: now,
    }
  }
}

export async function ingestRssSubscriptions(
  repository: ContentRepository,
  subscriptions: Subscription[],
  options: RssIngestRunOptions = {},
): Promise<IngestResult[]> {
  const results: IngestResult[] = []
  for (const subscription of subscriptions) {
    const result = await ingestRssSubscription(repository, subscription, options)
    results.push(result)
    if ((options.delayBetweenMs ?? DEFAULT_OPTIONS.delayBetweenMs) > 0) {
      await delay(options.delayBetweenMs ?? DEFAULT_OPTIONS.delayBetweenMs)
    }
  }
  return results
}
