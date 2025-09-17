import fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from './supabase'
import { createSubscriptionRepository } from '../db/dal/subscriptionRepository'
import { subscriptionCreateSchema } from '../db/validation'

declare module 'fastify' {
  interface FastifyRequest {
    supabaseUser?: User
  }
}

interface Dependencies {
  getSupabaseClient: () => SupabaseClient
  getSubscriptionRepository: (
    client: SupabaseClient,
  ) => ReturnType<typeof createSubscriptionRepository>
}

const defaultDeps: Dependencies = {
  getSupabaseClient: () => createSupabaseServiceClient(),
  getSubscriptionRepository: (client) => createSubscriptionRepository(client),
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

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  app.get('/health', async () => ({ status: 'ok' }))

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
