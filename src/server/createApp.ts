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
} from './feedSerializers'

declare module 'fastify' {
  interface FastifyRequest {
    supabaseUser?: User
  }
}

type SourceType = (typeof contentItemSourceType.enumValues)[number]

export interface ContentService {
  listToday(now?: Date): Promise<Record<SourceType, ContentItemRecord[]>>
  listByRange(params: {
    sourceType: SourceType
    range: 'today' | '3d' | '7d'
    limit: number
    offset: number
    now?: Date
  }): Promise<ContentItemRecord[]>
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
  const listToday: ContentService['listToday'] = async (now = new Date()) => {
    const window = getRangeBounds('today', now)
    const { data, error } = await client
      .from('content_items')
      .select('*')
      .gte('published_at', window.start.toISOString())
      .lte('published_at', window.end.toISOString())
      .order('published_at', { ascending: false })

    if (error) throw error

    const grouped = emptyContentGroups()

    for (const item of data ?? []) {
      const record = deserializeContentRow(item as never)
      grouped[record.sourceType].push(record)
    }

    return grouped
  }

  const listByRange: ContentService['listByRange'] = async ({
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
    saveContent,
    removeSavedContent,
  }
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
    async (_request, reply) => {
      const now = new Date()
      const grouped = await contentService.listToday(now)
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
      const items = await contentService.listByRange({
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
        if (
          typeof error === 'object' &&
          error &&
          'code' in error &&
          (error as { code?: string }).code === '23505'
        ) {
          reply.code(409).send({ error: 'Subscription already exists for this source' })
          return
        }
        reply.code(500).send({ error: 'Failed to create subscription' })
      }
    },
  )

  const deleteParamsSchema = z.object({ id: z.string().uuid() })

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
