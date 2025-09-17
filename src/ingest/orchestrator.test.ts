import { describe, expect, it, vi, afterEach } from 'vitest'
import crypto from 'node:crypto'
import type { Subscription } from '../db/schema'
import type { SubscriptionRepository } from '../db/dal/subscriptionRepository'
import type { ContentRepository, IngestResult } from './rss/types'
import { runIngestionCycle, createIngestionScheduler } from './orchestrator'

const makeSubscription = (overrides: Partial<Subscription>): Subscription => ({
  id: overrides.id ?? crypto.randomUUID(),
  userId: overrides.userId ?? crypto.randomUUID(),
  sourceType: overrides.sourceType ?? 'news',
  sourceId: overrides.sourceId ?? 'source-id',
  sourceName: overrides.sourceName ?? 'Source Name',
  metadata: overrides.metadata ?? null,
  isActive: overrides.isActive ?? true,
  createdAt: overrides.createdAt ?? new Date(),
})

describe('ingestion orchestrator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('routes subscriptions to the appropriate service and aggregates totals', async () => {
    const subscriptions: Subscription[] = [
      makeSubscription({ id: 'rss-1', sourceType: 'news' }),
      makeSubscription({ id: 'rss-2', sourceType: 'podcast', metadata: { provider: 'rss' } }),
      makeSubscription({ id: 'yt-1', sourceType: 'youtube' }),
      makeSubscription({
        id: 'spotify-1',
        sourceType: 'podcast',
        metadata: { provider: 'spotify' },
      }),
      makeSubscription({ id: 'inactive', sourceType: 'news', isActive: false }),
    ]

    const subscriptionRepo: SubscriptionRepository = {
      listActiveSubscriptions: vi.fn(async () => subscriptions),
    }

    const contentRepo: ContentRepository = {
      upsertMany: async () => 0,
    }

    const rssResults: IngestResult[] = [
      {
        subscriptionId: 'rss-1',
        attempted: 2,
        ingested: 2,
        skipped: 0,
        errors: 0,
        feedTitle: 'News Feed',
        fetchedAt: new Date(),
      },
      {
        subscriptionId: 'rss-2',
        attempted: 1,
        ingested: 1,
        skipped: 0,
        errors: 0,
        feedTitle: 'Podcast RSS',
        fetchedAt: new Date(),
      },
    ]

    const youtubeResults: IngestResult[] = [
      {
        subscriptionId: 'yt-1',
        attempted: 3,
        ingested: 2,
        skipped: 1,
        errors: 0,
        feedTitle: 'YouTube Channel',
        fetchedAt: new Date(),
      },
    ]

    const spotifyResults: IngestResult[] = [
      {
        subscriptionId: 'spotify-1',
        attempted: 2,
        ingested: 1,
        skipped: 1,
        errors: 0,
        feedTitle: 'Spotify Show',
        fetchedAt: new Date(),
      },
    ]

    const rssService = vi.fn(async () => rssResults)
    const youtubeService = vi.fn(async () => youtubeResults)
    const spotifyService = vi.fn(async () => spotifyResults)
    const logger = vi.fn()

    const summary = await runIngestionCycle(subscriptionRepo, contentRepo, {
      services: {
        rss: rssService,
        youtube: youtubeService,
        spotify: spotifyService,
      },
      logger,
    })

    expect(rssService).toHaveBeenCalledTimes(1)
    expect(rssService).toHaveBeenCalledWith(
      contentRepo,
      [subscriptions[0], subscriptions[1]],
      undefined,
    )
    expect(youtubeService).toHaveBeenCalledWith(contentRepo, [subscriptions[2]], undefined)
    expect(spotifyService).toHaveBeenCalledWith(contentRepo, [subscriptions[3]], undefined)

    expect(summary.totals).toEqual({ attempted: 8, ingested: 6, skipped: 2, errors: 0 })
    expect(summary.rss).toEqual(rssResults)
    expect(summary.youtube).toEqual(youtubeResults)
    expect(summary.spotify).toEqual(spotifyResults)
    expect(logger).toHaveBeenCalledTimes(4)
  })

  it('schedules repeated ingestion cycles with an interval', async () => {
    vi.useFakeTimers()

    const runCycle = vi.fn(async () => {})
    const scheduler = createIngestionScheduler(runCycle, { intervalMs: 1000, runOnStart: false })

    scheduler.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(runCycle).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(runCycle).toHaveBeenCalledTimes(2)

    scheduler.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(runCycle).toHaveBeenCalledTimes(2)
  })

  it('reports scheduler errors via logger', async () => {
    vi.useFakeTimers()

    const runCycle = vi.fn(async () => {
      throw new Error('boom')
    })
    const logger = vi.fn()

    const scheduler = createIngestionScheduler(runCycle, {
      intervalMs: 1000,
      runOnStart: false,
      logger,
    })

    scheduler.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    scheduler.stop()
  })
})
