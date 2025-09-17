import { describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
import type { Subscription } from '../../db/schema'
import { ingestSpotifySubscription } from './spotifyIngestor'
import type { ContentRepository } from '../rss/types'

const TOKEN_RESPONSE = {
  access_token: 'access-token',
  token_type: 'Bearer',
  expires_in: 3600,
}

const SHOW_RESPONSE = {
  id: 'show123',
  name: 'Daily Pod',
  publisher: 'Dayroll Studios',
  images: [{ url: 'https://cdn.example.com/show.jpg' }],
}

const EPISODES_PAGE_ONE = {
  items: [
    {
      id: 'ep1',
      name: 'Episode One',
      description: 'Intro',
      release_date: '2025-09-17',
      duration_ms: 600000,
      external_urls: { spotify: 'https://open.spotify.com/episode/ep1' },
      images: [{ url: 'https://cdn.example.com/ep1.jpg' }],
    },
  ],
  next: 'https://api.spotify.com/v1/shows/show123/episodes?offset=1',
}

const EPISODES_PAGE_TWO = {
  items: [
    {
      id: 'ep2',
      name: 'Episode Two',
      description: 'Follow up',
      release_date: '2025-09-18',
      duration_ms: 720000,
      external_urls: { spotify: 'https://open.spotify.com/episode/ep2' },
    },
    {
      id: '',
      name: '',
      description: '',
      release_date: '2025-09-18',
      duration_ms: 0,
    },
  ],
  next: null,
}

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    userId: overrides.userId ?? crypto.randomUUID(),
    sourceType: overrides.sourceType ?? 'podcast',
    sourceId: overrides.sourceId ?? 'show123',
    sourceName: overrides.sourceName ?? 'Daily Pod',
    metadata: overrides.metadata ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

describe('Spotify ingestor', () => {
  it('ingests episodes with retries and handles skips', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }

    const fetchMock = vi
      .fn<Parameters<NonNullable<typeof globalThis.fetch>>, Promise<Response>>()
      .mockImplementation(async (input) => {
        const urlString = input instanceof URL ? input.toString() : String(input)
        const url = new URL(urlString)

        if (url.origin === 'https://accounts.spotify.com' && url.pathname === '/api/token') {
          return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 })
        }

        if (url.origin === 'https://api.spotify.com' && url.pathname === '/v1/shows/show123') {
          return new Response(JSON.stringify(SHOW_RESPONSE), { status: 200 })
        }

        if (
          url.origin === 'https://api.spotify.com' &&
          url.pathname === '/v1/shows/show123/episodes'
        ) {
          const offset = url.searchParams.get('offset') ?? '0'
          if (offset === '0') {
            return new Response(JSON.stringify(EPISODES_PAGE_ONE), { status: 200 })
          }
          if (offset === '1') {
            return new Response(JSON.stringify(EPISODES_PAGE_TWO), { status: 200 })
          }
        }

        throw new Error(`Unhandled request: ${urlString}`)
      })

    const subscription = buildSubscription()

    const result = await ingestSpotifySubscription(repo, subscription, {
      credentials: { clientId: 'id', clientSecret: 'secret' },
      fetch: fetchMock,
      clock: () => new Date('2025-09-19T00:00:00Z'),
      maxPages: 5,
    })

    expect(result).toMatchObject({
      attempted: 3,
      ingested: 2,
      skipped: 1,
      errors: 0,
      feedTitle: 'Daily Pod',
    })
    expect(repo.upsertMany).toHaveBeenCalledTimes(1)
  })

  it('returns error when credentials missing', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }
    const subscription = buildSubscription()

    const result = await ingestSpotifySubscription(repo, subscription)
    expect(result.errors).toBe(1)
    expect(repo.upsertMany).not.toHaveBeenCalled()
  })

  it('skips non-podcast subscriptions', async () => {
    const repo: ContentRepository = {
      upsertMany: vi.fn(async (items) => items.length),
    }
    const subscription = buildSubscription({ sourceType: 'news' })

    const result = await ingestSpotifySubscription(repo, subscription, {
      credentials: { clientId: 'id', clientSecret: 'secret' },
    })

    expect(result.attempted).toBe(0)
    expect(result.errors).toBe(0)
  })
})
