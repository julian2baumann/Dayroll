import { setTimeout as delay } from 'node:timers/promises'
import { Buffer } from 'node:buffer'
import pRetry from 'p-retry'
import type { Subscription } from '../../db/schema'
import type { ContentRepository } from '../rss/types'
import { mapEpisodesToContent } from './mapper'
import type {
  SpotifyCredentials,
  SpotifyEpisode,
  SpotifyIngestOptions,
  SpotifyIngestResult,
  SpotifyIngestRunOptions,
  SpotifyEpisodesResponse,
  SpotifyShow,
} from './types'

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SHOW_ENDPOINT = 'https://api.spotify.com/v1/shows/'
const DEFAULT_MARKET = 'US'

const DEFAULT_OPTIONS = {
  maxPages: 5,
  maxRetries: 3,
  timeoutMs: 15_000,
  initialRetryMs: 500,
  retryFactor: 2,
  randomizeBackoff: true,
  delayBetweenMs: 0,
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function resolveFetch(fetchFn?: FetchFn): FetchFn {
  if (fetchFn) return fetchFn
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis)
  }
  throw new Error('global fetch is not available; provide a custom fetch implementation')
}

async function fetchWithTimeout(
  fetchFn: FetchFn,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(input, { ...init, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchAccessToken(
  fetchFn: FetchFn,
  credentials: SpotifyCredentials,
  timeoutMs: number,
): Promise<{ token: string; expiresAt: number }> {
  const body = new URLSearchParams({ grant_type: 'client_credentials' })
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
    'base64',
  )

  const response = await fetchWithTimeout(
    fetchFn,
    TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
    timeoutMs,
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Spotify token request failed: ${response.status} ${text}`)
  }

  const json = (await response.json()) as { access_token: string; expires_in: number }
  const expiresAt = Date.now() + json.expires_in * 1000
  return { token: json.access_token, expiresAt }
}

async function fetchShow(
  fetchFn: FetchFn,
  showId: string,
  token: string,
  timeoutMs: number,
): Promise<SpotifyShow> {
  const response = await fetchWithTimeout(
    fetchFn,
    `${SHOW_ENDPOINT}${encodeURIComponent(showId)}?market=${DEFAULT_MARKET}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    timeoutMs,
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Spotify show fetch failed: ${response.status} ${text}`)
  }

  return (await response.json()) as SpotifyShow
}

async function fetchEpisodesPage(
  fetchFn: FetchFn,
  url: string,
  token: string,
  timeoutMs: number,
): Promise<SpotifyEpisodesResponse> {
  const response = await fetchWithTimeout(
    fetchFn,
    url,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    timeoutMs,
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Spotify episodes fetch failed: ${response.status} ${text}`)
  }

  return (await response.json()) as SpotifyEpisodesResponse
}

function buildEpisodesUrl(showId: string, limit: number, offset: number): string {
  const url = new URL(`${SHOW_ENDPOINT}${encodeURIComponent(showId)}/episodes`)
  url.searchParams.set('market', DEFAULT_MARKET)
  url.searchParams.set('limit', String(Math.min(50, Math.max(1, limit))))
  url.searchParams.set('offset', String(Math.max(0, offset)))
  return url.toString()
}

export async function ingestSpotifySubscription(
  repository: ContentRepository,
  subscription: Subscription,
  options: SpotifyIngestRunOptions = {},
): Promise<SpotifyIngestResult> {
  const clock = options.clock ?? (() => new Date())
  const now = clock()

  if (subscription.sourceType !== 'podcast') {
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

  const credentials = options.credentials
  if (!credentials) {
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
  const merged: SpotifyIngestOptions = { ...DEFAULT_OPTIONS, ...options }
  const timeoutMs = merged.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs
  const retries = Math.max(0, (merged.maxRetries ?? DEFAULT_OPTIONS.maxRetries) - 1)

  try {
    const { token } = await pRetry(() => fetchAccessToken(fetchFn, credentials, timeoutMs), {
      retries,
      factor: merged.retryFactor ?? DEFAULT_OPTIONS.retryFactor,
      minTimeout: merged.initialRetryMs ?? DEFAULT_OPTIONS.initialRetryMs,
      randomize: merged.randomizeBackoff ?? DEFAULT_OPTIONS.randomizeBackoff,
    })

    const show = await pRetry(() => fetchShow(fetchFn, subscription.sourceId, token, timeoutMs), {
      retries,
      factor: merged.retryFactor ?? DEFAULT_OPTIONS.retryFactor,
      minTimeout: merged.initialRetryMs ?? DEFAULT_OPTIONS.initialRetryMs,
      randomize: merged.randomizeBackoff ?? DEFAULT_OPTIONS.randomizeBackoff,
    })

    const episodes: SpotifyEpisode[] = []
    let nextUrl: string | null = buildEpisodesUrl(subscription.sourceId, 50, 0)
    let page = 0

    while (nextUrl && page < (merged.maxPages ?? DEFAULT_OPTIONS.maxPages)) {
      const pageResponse = await pRetry(
        () => fetchEpisodesPage(fetchFn, nextUrl!, token, timeoutMs),
        {
          retries,
          factor: merged.retryFactor ?? DEFAULT_OPTIONS.retryFactor,
          minTimeout: merged.initialRetryMs ?? DEFAULT_OPTIONS.initialRetryMs,
          randomize: merged.randomizeBackoff ?? DEFAULT_OPTIONS.randomizeBackoff,
        },
      )

      if (pageResponse.items?.length) {
        episodes.push(...pageResponse.items)
      }

      nextUrl = pageResponse.next
      page += 1
    }

    const mapResult = mapEpisodesToContent(episodes, show, now)
    const ingested = mapResult.entries.length ? await repository.upsertMany(mapResult.entries) : 0

    return {
      subscriptionId: subscription.id,
      attempted: episodes.length,
      ingested,
      skipped: mapResult.skipped.length,
      errors: 0,
      feedTitle: show.name ?? subscription.sourceName,
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

export async function ingestSpotifySubscriptions(
  repository: ContentRepository,
  subscriptions: Subscription[],
  options: SpotifyIngestRunOptions = {},
): Promise<SpotifyIngestResult[]> {
  const results: SpotifyIngestResult[] = []
  for (const subscription of subscriptions) {
    const result = await ingestSpotifySubscription(repository, subscription, options)
    results.push(result)
    if ((options.delayBetweenMs ?? DEFAULT_OPTIONS.delayBetweenMs) > 0) {
      await delay(options.delayBetweenMs ?? DEFAULT_OPTIONS.delayBetweenMs)
    }
  }
  return results
}
