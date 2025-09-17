import { describe, expect, it } from 'vitest'
import { deriveUploadsPlaylistId, mapPlaylistItemsToContent } from './mapper'
import type { YouTubePlaylistItem } from './types'

const ITEM: YouTubePlaylistItem = {
  contentDetails: {
    videoId: 'abc123',
    videoPublishedAt: '2025-09-17T07:00:00Z',
  },
  snippet: {
    title: 'Launch Recap',
    description: 'Highlights from launch.',
    channelId: 'UCexample',
    channelTitle: 'Dayroll Channel',
    thumbnails: {
      high: { url: 'https://img.youtube.com/high.jpg' },
      medium: { url: 'https://img.youtube.com/medium.jpg' },
    },
  },
}

describe('YouTube mapper', () => {
  it('derives uploads playlist id from channel id', () => {
    expect(deriveUploadsPlaylistId('UCabcd123')).toBe('UUabcd123')
    expect(deriveUploadsPlaylistId('something')).toBeUndefined()
  })

  it('maps playlist items to content inputs and records skips', () => {
    const invalidItem: YouTubePlaylistItem = { snippet: { title: '' } }
    const { entries, skipped } = mapPlaylistItemsToContent([ITEM, invalidItem], 'UCabcd123')

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      externalId: 'abc123',
      sourceType: 'youtube',
      sourceId: 'UCabcd123',
      url: 'https://www.youtube.com/watch?v=abc123',
      creator: 'Dayroll Channel',
    })

    expect(skipped).toHaveLength(1)
  })
})
