import { contentUpsertInputSchema } from '../../db/validation'
import type { ContentUpsertInput } from '../../db/validation'
import type { MapContentResult, SkippedItem } from '../rss/types'
import type { SpotifyEpisode, SpotifyShow } from './types'

function pickImageUrl(images?: Array<{ url: string }>): string | undefined {
  if (!images?.length) return undefined
  return images[0]?.url
}

export function mapEpisodesToContent(
  episodes: SpotifyEpisode[],
  show: SpotifyShow,
  now: Date = new Date(),
): MapContentResult {
  const entries: ContentUpsertInput[] = []
  const skipped: SkippedItem[] = []

  for (const episode of episodes) {
    const title = episode.name?.trim()
    const link = episode.external_urls?.spotify ?? `https://open.spotify.com/episode/${episode.id}`
    if (!episode.id || !title || !link) {
      skipped.push({
        item: {
          id: episode.id ?? 'unknown',
          title: title ?? 'Untitled episode',
          link,
        },
        reason: 'Missing required Spotify episode metadata',
      })
      continue
    }

    const description = episode.description ? episode.description.slice(0, 5000) : undefined
    const publishedAt = episode.release_date ? new Date(episode.release_date) : now

    const candidate = {
      sourceType: 'podcast' as const,
      externalId: episode.id,
      sourceId: show.id,
      title,
      url: link,
      creator: show.publisher ?? show.name ?? undefined,
      thumbnailUrl: pickImageUrl(episode.images) ?? pickImageUrl(show.images),
      description,
      publishedAt,
      durationSeconds: Math.round((episode.duration_ms ?? 0) / 1000),
      summary: undefined,
      topics: undefined,
    }

    const parsed = contentUpsertInputSchema.safeParse(candidate)
    if (parsed.success) {
      entries.push(parsed.data)
    } else {
      skipped.push({
        item: {
          id: episode.id,
          title,
          link,
        },
        reason: parsed.error.issues.map((issue) => issue.message).join('; '),
      })
    }
  }

  return { entries, skipped }
}
