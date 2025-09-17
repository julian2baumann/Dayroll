import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Subscription } from '../db/schema'
import type { SubscriptionRepository } from '../db/dal/subscriptionRepository'
import { createApp, type ContentService } from './createApp'
import {
  emptyContentGroups,
  type ContentItemRecord,
  type SavedContentRecord,
} from './feedSerializers'

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

  const createContentServiceStub = (overrides: Partial<ContentService> = {}) => {
    const stub: ContentService = {
      listToday: vi.fn(async (params: { userId: string; now?: Date }) => {
        void params
        return emptyContentGroups()
      }),
      listByRange: vi.fn(
        async (params: {
          userId: string
          sourceType: ContentItemRecord['sourceType']
          range: 'today' | '3d' | '7d'
          limit: number
          offset: number
          now?: Date
        }) => {
          void params
          return [] as ContentItemRecord[]
        },
      ),
      listSaved: vi.fn(async (params: { userId: string; limit: number; offset: number }) => {
        void params
        return []
      }),
      saveContent: vi.fn(async () => {}),
      removeSavedContent: vi.fn(async () => true),
    }
    return { ...stub, ...overrides }
  }

  const createContentItem = (overrides: Partial<ContentItemRecord> = {}): ContentItemRecord => ({
    id: 'content-1',
    sourceType: 'youtube',
    externalId: 'ext-1',
    sourceId: 'source-1',
    title: 'Sample Item',
    creator: 'Creator',
    url: 'https://example.com/content',
    thumbnailUrl: null,
    description: null,
    summary: null,
    topics: null,
    durationSeconds: null,
    publishedAt: new Date('2025-09-17T08:00:00Z'),
    isSaved: false,
    ...overrides,
  })

  const createSavedRecord = (overrides: Partial<SavedContentRecord> = {}): SavedContentRecord => ({
    ...createContentItem(overrides),
    isSaved: true,
    savedAt: new Date('2025-09-17T10:00:00Z'),
    ...overrides,
  })

  async function setupApp(
    options: {
      user?: User | null
      shouldError?: boolean
      subscriptionOverrides?: Partial<SubscriptionRepository>
      contentOverrides?: Partial<ContentService>
    } = {},
  ) {
    const { user = null, shouldError = false, subscriptionOverrides, contentOverrides } = options
    const subscriptionRepo = buildSubscriptionRepo(subscriptionOverrides)
    const contentService = createContentServiceStub(contentOverrides)

    const app = await createApp({
      getSupabaseClient: () => buildMockClient(user, shouldError),
      getSubscriptionRepository: () => subscriptionRepo,
      getContentService: () => contentService,
    })

    return { app, subscriptionRepo, contentService }
  }

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

  it('returns grouped today feed with serialized items', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const now = new Date('2025-09-17T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const item = createContentItem({
      id: 'content-42',
      title: 'Breaking News',
      sourceType: 'news',
      sourceId: 'https://news.example/rss',
      publishedAt: new Date('2025-09-17T08:00:00Z'),
    })

    const groups = emptyContentGroups()
    groups.news.push(item)

    const listTodayMock = vi.fn(async () => groups)

    const { app } = await setupApp({
      user,
      contentOverrides: {
        listToday: listTodayMock as ContentService['listToday'],
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/feed/today',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload).toHaveProperty('generatedAt', now.toISOString())
    const newsGroup = payload.groups.find((group: { type: string }) => group.type === 'news')
    expect(newsGroup).toBeDefined()
    expect(newsGroup.items).toHaveLength(1)
    expect(newsGroup.items[0]).toMatchObject({
      id: 'content-42',
      title: 'Breaking News',
      timeAgo: '4 hours ago',
      isSaved: false,
    })
    expect(listTodayMock).toHaveBeenCalledWith({ userId: 'user-1', now: expect.any(Date) })

    vi.useRealTimers()
  })

  it('returns sections for ranged feed requests', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const now = new Date('2025-09-18T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const items = [
      createContentItem({
        id: 'today-item',
        publishedAt: new Date('2025-09-18T09:00:00Z'),
      }),
      createContentItem({
        id: 'yesterday-item',
        publishedAt: new Date('2025-09-17T11:00:00Z'),
      }),
      createContentItem({
        id: 'two-days-ago-item',
        publishedAt: new Date('2025-09-16T10:00:00Z'),
      }),
      createContentItem({
        id: 'earlier-item',
        publishedAt: new Date('2025-09-14T14:00:00Z'),
      }),
    ]

    const listByRangeMock = vi.fn(async () => items)

    const { app } = await setupApp({
      user,
      contentOverrides: {
        listByRange: listByRangeMock as ContentService['listByRange'],
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/feed/youtube?range=7d&limit=25&offset=0',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload.type).toBe('youtube')
    expect(payload.range).toBe('7d')
    expect(payload.generatedAt).toBe(now.toISOString())

    const sections = payload.sections
    expect(sections[0]).toMatchObject({ label: 'Today' })
    expect(sections[0].items).toHaveLength(1)
    expect(sections[1]).toMatchObject({ label: 'Yesterday' })
    expect(sections[2]).toMatchObject({ label: '2 days ago' })
    expect(sections[3]).toMatchObject({ label: 'Earlier this week' })
    expect(listByRangeMock).toHaveBeenCalledWith({
      userId: 'user-1',
      sourceType: 'youtube',
      range: '7d',
      limit: 25,
      offset: 0,
      now,
    })

    vi.useRealTimers()
  })

  it('saves content items and handles duplicates/foreign key errors', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const saveMock = vi.fn(async () => {})
    const { app } = await setupApp({
      user,
      contentOverrides: {
        saveContent: saveMock,
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/save/11111111-1111-4111-8111-111111111111',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(saveMock).toHaveBeenCalledWith('user-1', '11111111-1111-4111-8111-111111111111')

    saveMock.mockRejectedValueOnce({ code: '23505' })
    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/api/save/11111111-1111-4111-8111-111111111111',
      headers: {
        authorization: 'Bearer token',
      },
    })
    expect(duplicateResponse.statusCode).toBe(409)

    saveMock.mockRejectedValueOnce({ code: '23503' })
    const missingResponse = await app.inject({
      method: 'POST',
      url: '/api/save/99999999-9999-4999-8999-999999999999',
      headers: {
        authorization: 'Bearer token',
      },
    })
    expect(missingResponse.statusCode).toBe(404)
  })

  it('removes saved items and reports when none exist', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const removeMock = vi.fn(async () => true)
    const { app } = await setupApp({
      user,
      contentOverrides: {
        removeSavedContent: removeMock,
      },
    })

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/save/11111111-1111-4111-8111-111111111111',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(removeMock).toHaveBeenCalledWith('user-1', '11111111-1111-4111-8111-111111111111')

    removeMock.mockResolvedValueOnce(false)

    const notFoundResponse = await app.inject({
      method: 'DELETE',
      url: '/api/save/11111111-1111-4111-8111-111111111111',
      headers: {
        authorization: 'Bearer token',
      },
    })
    expect(notFoundResponse.statusCode).toBe(404)
  })

  it('returns saved items for For Later tab', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User

    const savedRecords = [
      createSavedRecord({
        id: 'saved-1',
        title: 'Saved article',
        sourceType: 'news',
      }),
    ]

    const listSavedMock = vi.fn(async () => savedRecords)

    const { app } = await setupApp({
      user,
      contentOverrides: {
        listSaved: listSavedMock as ContentService['listSaved'],
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/save?limit=25&offset=0',
      headers: {
        authorization: 'Bearer token',
      },
    })

    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0]).toMatchObject({ id: 'saved-1', isSaved: true })
    expect(listSavedMock).toHaveBeenCalledWith({ userId: 'user-1', limit: 25, offset: 0 })
  })
})
