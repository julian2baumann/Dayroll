import fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from './supabase'
import { createSubscriptionRepository } from '../db/dal/subscriptionRepository'
import { subscriptionCreateSchema, feedRangeSchema } from '../db/validation'
import { contentItemSourceType } from '../db/schema'
import { getRangeBounds } from '../db/dateRanges'
import {
  buildSections,
  deserializeContentRow,
  emptyContentGroups,
  serializeFeedItem,
  type ContentItemRecord,
  type SavedContentRecord,
  serializeSavedItem,
} from './feedSerializers'

declare module 'fastify' {
  interface FastifyRequest {
    supabaseUser?: User
  }
}

type SourceType = (typeof contentItemSourceType.enumValues)[number]

export interface ContentService {
  listToday(params: {
    userId: string
    now?: Date
  }): Promise<Record<SourceType, ContentItemRecord[]>>
  listByRange(params: {
    userId: string
    sourceType: SourceType
    range: 'today' | '3d' | '7d'
    limit: number
    offset: number
    now?: Date
  }): Promise<ContentItemRecord[]>
  listSaved(params: {
    userId: string
    limit: number
    offset: number
  }): Promise<SavedContentRecord[]>
  listRecommendations(params: { userId: string; limit: number }): Promise<ContentItemRecord[]>
  saveContent(userId: string, contentItemId: string): Promise<void>
  removeSavedContent(userId: string, contentItemId: string): Promise<boolean>
}

interface Dependencies {
  getSupabaseClient: () => SupabaseClient
  getSubscriptionRepository: (
    client: SupabaseClient,
  ) => ReturnType<typeof createSubscriptionRepository>
  getContentService: (client: SupabaseClient) => ContentService
}

const defaultDeps: Dependencies = {
  getSupabaseClient: () => createSupabaseServiceClient(),
  getSubscriptionRepository: (client) => createSubscriptionRepository(client),
  getContentService: (client) => createSupabaseContentService(client),
}

function createSupabaseContentService(client: SupabaseClient): ContentService {
  const listToday: ContentService['listToday'] = async ({ userId, now = new Date() }) => {
    const window = getRangeBounds('today', now)
    const { data, error } = await client
      .from('content_items')
      .select('*')
      .gte('published_at', window.start.toISOString())
      .lte('published_at', window.end.toISOString())
      .order('published_at', { ascending: false })

    if (error) throw error

    const savedIds = await fetchSavedContentIds(client, userId)

    const grouped = emptyContentGroups()

    for (const item of data ?? []) {
      const record = markSaved(deserializeContentRow(item as never), savedIds)
      grouped[record.sourceType].push(record)
    }

    return grouped
  }

  const listByRange: ContentService['listByRange'] = async ({
    userId,
    sourceType,
    range,
    limit,
    offset,
    now,
  }) => {
    const referenceNow = now ?? new Date()
    const window = getRangeBounds(range, referenceNow)
    const { data, error } = await client
      .from('content_items')
      .select('*')
      .eq('source_type', sourceType)
      .gte('published_at', window.start.toISOString())
      .lte('published_at', window.end.toISOString())
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    const savedIds = await fetchSavedContentIds(client, userId)
    return (data ?? []).map((item) => markSaved(deserializeContentRow(item as never), savedIds))
  }

  const listSaved: ContentService['listSaved'] = async ({ userId, limit, offset }) => {
    const { data, error } = await client
      .from('saved_items')
      .select('content_item_id, saved_at, content_items(*)')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const rows = data ?? []

    return rows
      .map((row) => {
        const nested = (row as Record<string, unknown>).content_items as Record<
          string,
          unknown
        > | null
        if (!nested) return null
        const record = markSaved(
          deserializeContentRow(nested as never),
          new Set([row.content_item_id]),
        )
        return {
          ...record,
          savedAt: row.saved_at ? new Date(row.saved_at as string) : new Date(),
        }
      })
      .filter((value): value is SavedContentRecord => Boolean(value))
  }

  const listRecommendations: ContentService['listRecommendations'] = async ({ userId, limit }) => {
    void userId
    const { data, error } = await client
      .from('content_items')
      .select('*')
      .eq('source_type', 'recommendation')
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data ?? []).map((item) => deserializeContentRow(item as never))
  }

  const saveContent: ContentService['saveContent'] = async (userId, contentItemId) => {
    const { error } = await client
      .from('saved_items')
      .insert({ user_id: userId, content_item_id: contentItemId })
    if (error) throw error
  }

  const removeSavedContent: ContentService['removeSavedContent'] = async (
    userId,
    contentItemId,
  ) => {
    const { data, error } = await client
      .from('saved_items')
      .delete()
      .eq('user_id', userId)
      .eq('content_item_id', contentItemId)
      .select('content_item_id')

    if (error) throw error
    return (data ?? []).length > 0
  }

  return {
    listToday,
    listByRange,
    listSaved,
    listRecommendations,
    saveContent,
    removeSavedContent,
  }
}

async function fetchSavedContentIds(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('saved_items')
    .select('content_item_id')
    .eq('user_id', userId)

  if (error) throw error
  return new Set((data ?? []).map((row) => row.content_item_id))
}

function markSaved(record: ContentItemRecord, savedIds: Set<string>): ContentItemRecord {
  return {
    ...record,
    isSaved: savedIds.has(record.id),
  }
}

async function ensureApplicationUser(client: SupabaseClient, user: User) {
  const email = user.email
  if (!email) {
    console.error('[auth] Supabase user missing email', { userId: user.id })
    return { success: false as const }
  }

  const authProvider =
    (typeof user.app_metadata?.provider === 'string' && user.app_metadata.provider) || 'supabase'

  const { error } = await client.from('users').upsert(
    {
      id: user.id,
      email,
      auth_provider: authProvider,
    },
    { onConflict: 'id' },
  )

  if (error) {
    console.error('[auth] Failed to upsert user record', {
      userId: user.id,
      code: error.code,
      message: error.message,
    })
    return { success: false as const }
  }

  return { success: true as const }
}

async function authenticateRequest(
  request: fastify.FastifyRequest,
  reply: fastify.FastifyReply,
  deps: Dependencies,
) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized' })
    return
  }

  const token = authHeader.slice('Bearer '.length)
  const client = deps.getSupabaseClient()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) {
    reply.code(401).send({ error: 'Unauthorized' })
    return
  }

  const ensureResult = await ensureApplicationUser(client, data.user)
  if (!ensureResult.success) {
    reply.code(500).send({ error: 'Failed to provision user profile' })
    return
  }

  request.supabaseUser = data.user
}

export async function createApp(deps: Partial<Dependencies> = {}) {
  const dependencies: Dependencies = { ...defaultDeps, ...deps }

  const app = fastify({ logger: false })

  const serviceClient = dependencies.getSupabaseClient()
  const subscriptionRepo = dependencies.getSubscriptionRepository(serviceClient)
  const contentService = dependencies.getContentService(serviceClient)

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  app.get('/health', async () => ({ status: 'ok' }))

  const feedParamsSchema = z.object({
    type: z.enum(contentItemSourceType.enumValues),
  })

  const feedQuerySchema = z.object({
    range: feedRangeSchema.default('today'),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
  })

  const saveParamsSchema = z.object({ id: z.string().uuid() })

  app.get(
    '/api/feed/today',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }
      const now = new Date()
      const grouped = await contentService.listToday({ userId: user.id, now })
      reply.send({
        generatedAt: now.toISOString(),
        groups: contentItemSourceType.enumValues.map((type) => ({
          type,
          title: FEED_GROUP_TITLES[type],
          items: grouped[type].map((item) => serializeFeedItem(item, now)),
        })),
      })
    },
  )

  app.get(
    '/api/feed/:type',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const parseParams = feedParamsSchema.safeParse(request.params)
      if (!parseParams.success) {
        reply.code(400).send({ error: 'Invalid feed type' })
        return
      }

      const parseQuery = feedQuerySchema.safeParse(request.query)
      if (!parseQuery.success) {
        reply.code(400).send({ error: 'Invalid feed query parameters' })
        return
      }

      const now = new Date()
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }
      const items = await contentService.listByRange({
        userId: user.id,
        sourceType: parseParams.data.type,
        range: parseQuery.data.range,
        limit: parseQuery.data.limit,
        offset: parseQuery.data.offset,
        now,
      })

      reply.send({
        type: parseParams.data.type,
        range: parseQuery.data.range,
        generatedAt: now.toISOString(),
        sections: buildSections(items, now, parseQuery.data.range),
      })
    },
  )

  app.get(
    '/api/me',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      if (!request.supabaseUser) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }
      return {
        id: request.supabaseUser.id,
        email: request.supabaseUser.email,
      }
    },
  )

  app.get(
    '/api/subscriptions',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }
      const subscriptions = await subscriptionRepo.listSubscriptionsByUser(user.id)
      reply.send(subscriptions)
    },
  )

  app.post(
    '/api/subscriptions',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }

      const parsed = subscriptionCreateSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .code(400)
          .send({ error: parsed.error.issues.map((issue) => issue.message).join('; ') })
        return
      }

      try {
        const created = await subscriptionRepo.createSubscription({
          userId: user.id,
          sourceType: parsed.data.sourceType,
          sourceId: parsed.data.sourceId,
          sourceName: parsed.data.sourceName,
          metadata: parsed.data.metadata ?? null,
        })
        reply.code(201).send(created)
      } catch (error: unknown) {
        const code = isPostgrestError(error) ? error.code : undefined
        const message = error instanceof Error ? error.message : undefined
        console.error('[subscriptions:create] failed', {
          userId: user.id,
          sourceType: parsed.data.sourceType,
          sourceId: parsed.data.sourceId,
          code,
          message,
          error,
        })
        if (code === '23505') {
          reply.code(409).send({ error: 'Subscription already exists for this source' })
          return
        }
        if (code === '23503') {
          reply.code(400).send({ error: 'User profile missing for subscription' })
          return
        }
        reply.code(500).send({ error: 'Failed to create subscription' })
      }
    },
  )

  const deleteParamsSchema = z.object({ id: z.string().uuid() })
  const savedListQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
  })

  const forYouQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(5).default(5),
  })

  app.post(
    '/api/save/:id',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }

      const parseParams = saveParamsSchema.safeParse(request.params)
      if (!parseParams.success) {
        reply.code(400).send({ error: 'Invalid content item id' })
        return
      }

      try {
        await contentService.saveContent(user.id, parseParams.data.id)
        reply.code(204).send()
      } catch (error) {
        if (isPostgrestError(error)) {
          if (error.code === '23505') {
            reply.code(409).send({ error: 'Content already saved' })
            return
          }
          if (error.code === '23503') {
            reply.code(404).send({ error: 'Content item not found' })
            return
          }
        }
        reply.code(500).send({ error: 'Failed to save content item' })
      }
    },
  )

  app.delete(
    '/api/save/:id',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }

      const parseParams = saveParamsSchema.safeParse(request.params)
      if (!parseParams.success) {
        reply.code(400).send({ error: 'Invalid content item id' })
        return
      }

      try {
        const removed = await contentService.removeSavedContent(user.id, parseParams.data.id)
        if (!removed) {
          reply.code(404).send({ error: 'Saved content not found' })
          return
        }
        reply.code(204).send()
      } catch (_error) {
        void _error
        reply.code(500).send({ error: 'Failed to remove saved content' })
      }
    },
  )

  app.delete(
    '/api/subscriptions/:id',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }

      const parseParams = deleteParamsSchema.safeParse(request.params)
      if (!parseParams.success) {
        reply.code(400).send({ error: 'Invalid subscription id' })
        return
      }

      try {
        await subscriptionRepo.deleteSubscription(user.id, parseParams.data.id)
        reply.code(204).send()
      } catch (_error) {
        void _error
        reply.code(404).send({ error: 'Subscription not found' })
      }
    },
  )

  app.get(
    '/api/save',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }

      const query = savedListQuerySchema.safeParse(request.query)
      if (!query.success) {
        reply.code(400).send({ error: 'Invalid query parameters' })
        return
      }

      const now = new Date()
      const items = await contentService.listSaved({
        userId: user.id,
        limit: query.data.limit,
        offset: query.data.offset,
      })

      reply.send({
        generatedAt: now.toISOString(),
        items: items.map((item) => serializeSavedItem(item, now)),
      })
    },
  )

  app.get(
    '/api/for-you',
    {
      preHandler: (request, reply) =>
        authenticateRequest(request, reply, {
          ...dependencies,
          getSupabaseClient: () => serviceClient,
        }),
    },
    async (request, reply) => {
      const user = request.supabaseUser
      if (!user) {
        reply.code(401).send({ error: 'Unauthorized' })
        return
      }

      const parsed = forYouQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters' })
        return
      }

      const now = new Date()
      const items = await contentService.listRecommendations({
        userId: user.id,
        limit: parsed.data.limit,
      })

      reply.send({
        generatedAt: now.toISOString(),
        items: items.map((item) => serializeFeedItem(item, now)).slice(0, parsed.data.limit),
      })
    },
  )

  return app
}

const FEED_GROUP_TITLES: Record<SourceType, string> = {
  youtube: 'YouTube',
  podcast: 'Podcasts',
  news: 'News',
  recommendation: 'For You',
}

interface PostgrestErrorLike {
  code?: string
}

function isPostgrestError(error: unknown): error is PostgrestErrorLike {
  return typeof error === 'object' && error !== null && 'code' in error
}
