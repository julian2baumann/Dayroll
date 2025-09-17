import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
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

  it('responds to health check', async () => {
    const app = await createApp({
      getSupabaseClient: () => buildMockClient(null),
    })
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('rejects protected routes without authorization header', async () => {
    const app = await createApp({
      getSupabaseClient: () => buildMockClient(null),
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
    const app = await createApp({
      getSupabaseClient: () => buildMockClient(user),
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
    const app = await createApp({
      getSupabaseClient: () => buildMockClient(null, true),
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
})
