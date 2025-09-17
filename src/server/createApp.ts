import fastify from 'fastify'
import cors from '@fastify/cors'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from './supabase'

declare module 'fastify' {
  interface FastifyRequest {
    supabaseUser?: User
  }
}

interface Dependencies {
  getSupabaseClient: () => SupabaseClient
}

const defaultDeps: Dependencies = {
  getSupabaseClient: () => createSupabaseServiceClient(),
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

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  app.get('/health', async () => ({ status: 'ok' }))

  app.get(
    '/api/me',
    {
      preHandler: (request, reply) => authenticateRequest(request, reply, dependencies),
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

  return app
}
