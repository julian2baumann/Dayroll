import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  contentFilterSchema,
  contentUpsertInputSchema,
  subscriptionPayloadSchema,
  topicPreferenceSchema,
} from './validation'

describe('validation schemas', () => {
  it('rejects invalid YouTube channel id', () => {
    const result = subscriptionPayloadSchema.safeParse({
      userId: crypto.randomUUID(),
      sourceType: 'youtube',
      sourceId: 'invalid',
      sourceName: 'Bad Channel',
    })

    expect(result.success).toBe(false)
  })

  it('allows valid RSS subscription', () => {
    const result = subscriptionPayloadSchema.safeParse({
      userId: crypto.randomUUID(),
      sourceType: 'news',
      sourceId: 'https://example.com/rss.xml',
      sourceName: 'Example News',
    })

    expect(result.success).toBe(true)
  })

  it('parses content inputs and coerces publication date', () => {
    const result = contentUpsertInputSchema.parse({
      sourceType: 'podcast',
      externalId: 'episode-1',
      sourceId: '1234567890123456789012',
      title: 'Episode Title',
      url: 'https://example.com/episode',
      publishedAt: '2025-09-17T00:00:00.000Z',
    })

    expect(result.publishedAt).toBeInstanceOf(Date)
  })

  it('limits topics list length', () => {
    const result = topicPreferenceSchema.safeParse([
      'ai',
      'news',
      'design',
      'culture',
      'space',
      'food',
    ])
    expect(result.success).toBe(false)
  })

  it('applies defaults in content filter schema', () => {
    const parsed = contentFilterSchema.parse({ range: 'today' })
    expect(parsed.limit).toBe(50)
    expect(parsed.offset).toBe(0)
  })
})
