import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Subscription } from '../db/schema'
import type { SubscriptionRepository } from '../db/dal/subscriptionRepository'
import { createApp } from './createApp'

describe('createApp', () => {
  const buildMockClient = (user: User | null, shouldError = false) => {
    return {
      auth: {
        getUser: vi.fn(async () => {
          if (shouldError) {
            return { data: { user: null }, error: { message: 'boom' } }
          }
          return { data: { user }, error: null }
        }),
      },
    } as unknown as SupabaseClient
  }

  const buildSubscriptionRepo = (overrides: Partial<SubscriptionRepository> = {}) =>
    ({
      listActiveSubscriptions: vi.fn(async () => []),
      listSubscriptionsByUser: vi.fn(async () => []),
      createSubscription: vi.fn(async () => ({ id: 'sub-1' }) as unknown as Subscription),
      deleteSubscription: vi.fn(async () => {}),
      ...overrides,
    }) as SubscriptionRepository

  it('responds to health check', async () => {
    const subscriptionRepo = buildSubscriptionRepo()
    const app = await createApp({
      getSupabaseClient: () => buildMockClient(null),
      getSubscriptionRepository: () => subscriptionRepo,
    })
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('rejects protected routes without authorization header', async () => {
    const subscriptionRepo = buildSubscriptionRepo()
    const app = await createApp({
      getSupabaseClient: () => buildMockClient(null),
      getSubscriptionRepository: () => subscriptionRepo,
    })

    const response = await app.inject({ method: 'GET', url: '/api/me' })
    expect(response.statusCode).toBe(401)
  })

  it('permits protected routes with valid bearer token', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User
    const subscriptionRepo = buildSubscriptionRepo()
    const app = await createApp({
      getSupabaseClient: () => buildMockClient(user),
      getSubscriptionRepository: () => subscriptionRepo,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ id: 'user-1', email: 'user@example.com' })
  })

  it('returns 401 when Supabase rejects the token', async () => {
    const subscriptionRepo = buildSubscriptionRepo()
    const app = await createApp({
      getSupabaseClient: () => buildMockClient(null, true),
      getSubscriptionRepository: () => subscriptionRepo,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(401)
  })

  it('lists subscriptions for the current user', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const subscriptions: Subscription[] = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: 'user-1',
        sourceType: 'news',
        sourceId: 'https://example.com/rss.xml',
        sourceName: 'Example RSS',
        metadata: null,
        isActive: true,
        createdAt: new Date(),
      },
    ]

    const subscriptionRepo = buildSubscriptionRepo({
      listSubscriptionsByUser: vi.fn(async () => subscriptions),
    })

    const app = await createApp({
      getSupabaseClient: () => buildMockClient(user),
      getSubscriptionRepository: () => subscriptionRepo,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/subscriptions',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload).toHaveLength(1)
    expect(payload[0]).toMatchObject({
      id: subscriptions[0].id,
      sourceId: 'https://example.com/rss.xml',
      sourceType: 'news',
    })
    expect(subscriptionRepo.listSubscriptionsByUser).toHaveBeenCalledWith('user-1')
  })

  it('creates a subscription and handles duplicates gracefully', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const subscriptionRepo = buildSubscriptionRepo({
      createSubscription: vi.fn(
        async () =>
          ({
            id: 'sub-1',
            userId: 'user-1',
            sourceType: 'news',
            sourceId: 'https://example.com/rss.xml',
            sourceName: 'Example RSS',
            metadata: null,
            isActive: true,
            createdAt: new Date(),
          }) as Subscription,
      ),
    })

    const app = await createApp({
      getSupabaseClient: () => buildMockClient(user),
      getSubscriptionRepository: () => subscriptionRepo,
    })

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: {
        authorization: 'Bearer token',
      },
      payload: {
        sourceType: 'news',
        sourceId: 'https://example.com/rss.xml',
        sourceName: 'Example RSS',
      },
    })

    expect(createResponse.statusCode).toBe(201)
    expect(subscriptionRepo.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    )

    subscriptionRepo.createSubscription.mockRejectedValueOnce({ code: '23505' })

    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: {
        authorization: 'Bearer token',
      },
      payload: {
        sourceType: 'news',
        sourceId: 'https://example.com/rss.xml',
        sourceName: 'Example RSS',
      },
    })

    expect(duplicateResponse.statusCode).toBe(409)
  })

  it('validates subscription payloads', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const subscriptionRepo = buildSubscriptionRepo()

    const app = await createApp({
      getSupabaseClient: () => buildMockClient(user),
      getSubscriptionRepository: () => subscriptionRepo,
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: {
        authorization: 'Bearer token',
      },
      payload: {
        sourceType: 'news',
        sourceId: 'not-a-url',
        sourceName: '',
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('removes a subscription owned by the user', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const subscriptionRepo = buildSubscriptionRepo({
      deleteSubscription: vi.fn(async () => {}),
    })

    const app = await createApp({
      getSupabaseClient: () => buildMockClient(user),
      getSubscriptionRepository: () => subscriptionRepo,
    })

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/subscriptions/00000000-0000-4000-8000-000000000009',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(subscriptionRepo.deleteSubscription).toHaveBeenCalledWith(
      'user-1',
      '00000000-0000-4000-8000-000000000009',
    )
  })
})
