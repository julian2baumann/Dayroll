import { describe, expect, it } from 'vitest'
import { mapEpisodesToContent } from './mapper'
import type { SpotifyEpisode, SpotifyShow } from './types'

const SHOW: SpotifyShow = {
  id: 'show123',
  name: 'Daily Pod',
  publisher: 'Dayroll Studios',
  images: [{ url: 'https://cdn.example.com/show.jpg' }],
}

const EPISODE: SpotifyEpisode = {
  id: 'episode123',
  name: 'Morning Brief',
  description: 'Highlights for the day',
  release_date: '2025-09-17',
  duration_ms: 1234567,
  external_urls: {
    spotify: 'https://open.spotify.com/episode/episode123',
  },
  images: [{ url: 'https://cdn.example.com/episode.jpg' }],
}

describe('Spotify episode mapper', () => {
  it('maps episodes into content items', () => {
    const { entries, skipped } = mapEpisodesToContent([EPISODE], SHOW)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      sourceType: 'podcast',
      externalId: 'episode123',
      sourceId: 'show123',
      url: 'https://open.spotify.com/episode/episode123',
      creator: 'Dayroll Studios',
    })
    expect(entries[0].durationSeconds).toBe(Math.round(EPISODE.duration_ms / 1000))
    expect(entries[0].thumbnailUrl).toBe('https://cdn.example.com/episode.jpg')
    expect(skipped).toHaveLength(0)
  })

  it('skips invalid episode metadata', () => {
    const invalidEpisode: SpotifyEpisode = {
      id: '',
      name: '',
      description: '',
      release_date: '2025-09-17',
      duration_ms: 0,
    }

    const { entries, skipped } = mapEpisodesToContent([invalidEpisode], SHOW)
    expect(entries).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })
})
