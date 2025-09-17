import { describe, expect, it } from 'vitest'
import { computeContentDedupeHash } from './hash'

describe('computeContentDedupeHash', () => {
  it('produces stable hash for same inputs regardless of casing', () => {
    const a = computeContentDedupeHash({
      sourceType: 'youtube',
      externalId: 'abc123',
      url: 'https://example.com/video',
      title: 'Hello World',
    })
    const b = computeContentDedupeHash({
      sourceType: 'youtube',
      externalId: 'abc123',
      url: 'https://example.com/video',
      title: 'hello world ',
    })

    expect(a).toBe(b)
  })

  it('differentiates distinct content', () => {
    const original = computeContentDedupeHash({
      sourceType: 'news',
      externalId: 'story',
      url: 'https://example.com/story',
    })
    const other = computeContentDedupeHash({
      sourceType: 'news',
      externalId: 'story-2',
      url: 'https://example.com/story',
    })

    expect(original).not.toBe(other)
  })
})
