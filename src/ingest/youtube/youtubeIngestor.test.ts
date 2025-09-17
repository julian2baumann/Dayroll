import { describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
import type { Subscription } from '../../db/schema'
import { ingestYouTubeSubscription } from './youtubeIngestor'
import type { ContentRepository } from '../rss/types'

const PAGE_ONE = {
  nextPageToken: 'PAGE2',
  items: [
    {
      contentDetails: {
        videoId: 'video1',
        videoPublishedAt: '2025-09-17T07:00:00Z',
      },
      snippet: {
        title: 'First video',
        description: 'Intro clip',
        channelId: 'UCabcd',
        channelTitle: 'Dayroll Channel',
        thumbnails: {
          high: { url: 'https://img.youtube.com/vi/video1/hqdefault.jpg' },
        },
      },
    },
  ],
}

const PAGE_TWO = {
  items: [
    {
      contentDetails: {
        videoId: 'video2',
        videoPublishedAt: '2025-09-18T07:00:00Z',
      },
      snippet: {
        title: 'Second video',
        channelId: 'UCabcd',
        channelTitle: 'Dayroll Channel',
      },
    },
  ],
}

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    userId: overrides.userId ?? crypto.randomUUID(),
    sourceType: overrides.sourceType ?? 'youtube',
    sourceId: overrides.sourceId ?? 'UCabcd',
    sourceName: overrides.sourceName ?? 'Dayroll Channel',
    metadata: overrides.metadata ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

describe('YouTube ingestor', () => {
  it('ingests multiple pages and upserts videos', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const fetchMock = vi
      .fn<Parameters<NonNullable<typeof globalThis.fetch>>, Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(PAGE_ONE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(PAGE_TWO), { status: 200 }))

    const subscription = buildSubscription()

    const result = await ingestYouTubeSubscription(repo, subscription, {
      apiKey: 'key-123',
      fetch: fetchMock,
      clock: () => new Date('2025-09-19T00:00:00Z'),
      maxPages: 5,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      attempted: 2,
      ingested: 2,
      skipped: 0,
      errors: 0,
    })
  })

  it('handles invalid entries and reports skips', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                snippet: {
                  title: '',
                },
              },
            ],
          }),
          { status: 200 },
        ),
    )

    const subscription = buildSubscription()
    const result = await ingestYouTubeSubscription(repo, subscription, {
      apiKey: 'key-123',
      fetch: fetchMock,
      clock: () => new Date('2025-09-19T00:00:00Z'),
    })

    expect(result.attempted).toBe(1)
    expect(result.ingested).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(0)
    expect(repo.upsertMany).not.toHaveBeenCalled()
  })

  it('fails fast when API key missing', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const subscription = buildSubscription()
    const result = await ingestYouTubeSubscription(repo, subscription)
    expect(result.errors).toBe(1)
    expect(repo.upsertMany).not.toHaveBeenCalled()
  })

  it('skips non-youtube subscriptions without error', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const subscription = buildSubscription({ sourceType: 'news' })
    const result = await ingestYouTubeSubscription(repo, subscription, { apiKey: 'key-123' })
    expect(result.attempted).toBe(0)
    expect(result.errors).toBe(0)
  })
})
