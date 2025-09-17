import type { Subscription } from '../db/schema'
import type { SubscriptionRepository } from '../db/dal/subscriptionRepository'
import type { ContentRepository, IngestResult } from './rss/types'
import type { RssIngestRunOptions } from './rss/types'
import { ingestRssSubscriptions } from './rss/rssIngestor'
import type { YouTubeIngestRunOptions } from './youtube/types'
import { ingestYouTubeSubscriptions } from './youtube/youtubeIngestor'
import type { SpotifyIngestRunOptions } from './spotify/types'
import { ingestSpotifySubscriptions } from './spotify/spotifyIngestor'

export interface IngestionServices {
  rss: typeof ingestRssSubscriptions
  youtube: typeof ingestYouTubeSubscriptions
  spotify: typeof ingestSpotifySubscriptions
}

const defaultServices: IngestionServices = {
  rss: ingestRssSubscriptions,
  youtube: ingestYouTubeSubscriptions,
  spotify: ingestSpotifySubscriptions,
}

export type IngestionLogEvent = {
  service: 'rss' | 'youtube' | 'spotify'
  result: IngestResult
}

export interface IngestionCoordinatorOptions {
  rss?: RssIngestRunOptions
  youtube?: YouTubeIngestRunOptions
  spotify?: SpotifyIngestRunOptions
  logger?: (event: IngestionLogEvent) => void
  services?: Partial<IngestionServices>
}

export interface IngestionSummary {
  startedAt: Date
  finishedAt: Date
  totals: {
    attempted: number
    ingested: number
    skipped: number
    errors: number
  }
  rss: IngestResult[]
  youtube: IngestResult[]
  spotify: IngestResult[]
}

export async function runIngestionCycle(
  subscriptionRepo: SubscriptionRepository,
  contentRepo: ContentRepository,
  options: IngestionCoordinatorOptions = {},
): Promise<IngestionSummary> {
  const startedAt = new Date()
  const services: IngestionServices = {
    ...defaultServices,
    ...options.services,
  }

  const subscriptions = await subscriptionRepo.listActiveSubscriptions()
  const activeSubscriptions = subscriptions.filter((sub) => sub.isActive !== false)

  const spotifySubs: Subscription[] = []
  const youtubeSubs: Subscription[] = []
  const rssSubs: Subscription[] = []

  for (const subscription of activeSubscriptions) {
    const metadata = (subscription.metadata ?? {}) as Record<string, unknown>
    const provider = typeof metadata.provider === 'string' ? metadata.provider : undefined

    switch (subscription.sourceType) {
      case 'youtube':
        youtubeSubs.push(subscription)
        break
      case 'podcast':
        if (provider === 'spotify' || subscription.sourceId.startsWith('show')) {
          spotifySubs.push(subscription)
        } else {
          rssSubs.push(subscription)
        }
        break
      case 'news':
        rssSubs.push(subscription)
        break
      default:
        break
    }
  }

  const logger = options.logger

  const rssResults = rssSubs.length ? await services.rss(contentRepo, rssSubs, options.rss) : []
  rssResults.forEach((result) => logger?.({ service: 'rss', result }))

  const youtubeResults = youtubeSubs.length
    ? await services.youtube(contentRepo, youtubeSubs, options.youtube)
    : []
  youtubeResults.forEach((result) => logger?.({ service: 'youtube', result }))

  const spotifyResults = spotifySubs.length
    ? await services.spotify(contentRepo, spotifySubs, options.spotify)
    : []
  spotifyResults.forEach((result) => logger?.({ service: 'spotify', result }))

  const finishedAt = new Date()
  const totals = [...rssResults, ...youtubeResults, ...spotifyResults].reduce(
    (acc, result) => {
      acc.attempted += result.attempted
      acc.ingested += result.ingested
      acc.skipped += result.skipped
      acc.errors += result.errors
      return acc
    },
    { attempted: 0, ingested: 0, skipped: 0, errors: 0 },
  )

  return {
    startedAt,
    finishedAt,
    totals,
    rss: rssResults,
    youtube: youtubeResults,
    spotify: spotifyResults,
  }
}

export interface SchedulerOptions {
  intervalMs: number
  runOnStart?: boolean
  logger?: (event: { type: 'error'; error: unknown }) => void
}

export interface IngestionScheduler {
  start(runOnStart?: boolean): void
  stop(): void
  isRunning(): boolean
  isActive(): boolean
}

export function createIngestionScheduler(
  runCycle: () => Promise<void>,
  { intervalMs, runOnStart = true, logger }: SchedulerOptions,
): IngestionScheduler {
  if (intervalMs <= 0) {
    throw new Error('intervalMs must be greater than zero')
  }

  let timer: NodeJS.Timeout | null = null
  let active = false
  let running = false

  const scheduleNext = () => {
    if (!active) return
    timer = setTimeout(tick, intervalMs)
  }

  const tick = async () => {
    if (!active || running) return
    running = true
    try {
      await runCycle()
    } catch (error) {
      logger?.({ type: 'error', error })
    } finally {
      running = false
      scheduleNext()
    }
  }

  return {
    start(shouldRunImmediately = runOnStart) {
      if (active) return
      active = true
      if (shouldRunImmediately) {
        void tick()
      } else {
        scheduleNext()
      }
    },
    stop() {
      active = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
    isRunning() {
      return running
    },
    isActive() {
      return active
    },
  }
}
