import { describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
import type { Subscription } from '../../db/schema'
import { ingestRssSubscription } from './rssIngestor'
import type { ContentRepository } from './types'

const SUCCESS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <link>https://example.com</link>
    <item>
      <title>Sample article</title>
      <link>https://example.com/article</link>
      <guid>article-1</guid>
      <pubDate>Wed, 17 Sep 2025 07:00:00 GMT</pubDate>
      <description>Snippet</description>
    </item>
  </channel>
</rss>`

const INVALID_ITEM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bad Feed</title>
    <item>
      <title>Broken</title>
      <link>not-a-url</link>
      <guid>broken-1</guid>
    </item>
  </channel>
</rss>`

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    userId: overrides.userId ?? crypto.randomUUID(),
    sourceType: overrides.sourceType ?? 'news',
    sourceId: overrides.sourceId ?? 'https://example.com/rss.xml',
    sourceName: overrides.sourceName ?? 'Example Feed',
    metadata: overrides.metadata ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

describe('RSS ingestor', () => {
  it('ingests items and upserts content', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const fetchMock = vi.fn(async () => new Response(SUCCESS_FEED, { status: 200 }))
    const subscription = buildSubscription()

    const result = await ingestRssSubscription(repo, subscription, {
      fetch: fetchMock,
      clock: () => new Date('2025-09-18T00:00:00Z'),
    })

    expect(result).toMatchObject({
      subscriptionId: subscription.id,
      attempted: 1,
      ingested: 1,
      skipped: 0,
      errors: 0,
      feedTitle: 'Example Feed',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(repo.upsertMany).toHaveBeenCalledTimes(1)
  })

  it('skips invalid items while keeping ingestion healthy', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const fetchMock = vi.fn(async () => new Response(INVALID_ITEM_FEED, { status: 200 }))
    const subscription = buildSubscription()

    const result = await ingestRssSubscription(repo, subscription, {
      fetch: fetchMock,
      clock: () => new Date('2025-09-18T00:00:00Z'),
    })

    expect(result.attempted).toBe(1)
    expect(result.ingested).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(0)
    expect(repo.upsertMany).not.toHaveBeenCalled()
  })

  it('retries transient failures', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const fetchMock = vi
      .fn<Parameters<NonNullable<typeof globalThis.fetch>>, Promise<Response>>()
      .mockResolvedValueOnce(new Response('error', { status: 502 }))
      .mockResolvedValueOnce(new Response(SUCCESS_FEED, { status: 200 }))

    const subscription = buildSubscription()

    const result = await ingestRssSubscription(repo, subscription, {
      fetch: fetchMock,
      clock: () => new Date('2025-09-18T00:00:00Z'),
      maxRetries: 2,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.errors).toBe(0)
    expect(result.ingested).toBe(1)
  })

  it('ignores unsupported subscription types', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const subscription = buildSubscription({ sourceType: 'youtube' })
    const result = await ingestRssSubscription(repo, subscription)
    expect(result.attempted).toBe(0)
    expect(repo.upsertMany).not.toHaveBeenCalled()
  })
})
