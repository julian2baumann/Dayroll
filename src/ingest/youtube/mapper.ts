import { contentUpsertInputSchema } from '../../db/validation'
import type { ContentUpsertInput } from '../../db/validation'
import type { MapContentResult, SkippedItem } from '../rss/types'
import type { YouTubePlaylistItem } from './types'

const THUMBNAIL_ORDER = ['maxres', 'standard', 'high', 'medium', 'default'] as const

export function deriveUploadsPlaylistId(channelId: string): string | undefined {
  if (!channelId.startsWith('UC') || channelId.length < 3) {
    return undefined
  }
  return `UU${channelId.slice(2)}`
}

function pickThumbnail(thumbnails?: Record<string, { url?: string }>): string | undefined {
  if (!thumbnails) return undefined
  for (const key of THUMBNAIL_ORDER) {
    const thumb = thumbnails[key]
    if (thumb?.url) return thumb.url
  }
  const first = Object.values(thumbnails)[0]
  return first?.url
}

export function mapPlaylistItemsToContent(
  items: YouTubePlaylistItem[],
  channelId: string,
  channelTitle?: string,
  now: Date = new Date(),
): MapContentResult {
  const entries: ContentUpsertInput[] = []
  const skipped: SkippedItem[] = []

  for (const item of items) {
    const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
    const publishedAt = item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt
    const title = item.snippet?.title?.trim() ?? ''
    const description = item.snippet?.description
      ? item.snippet.description.slice(0, 5000)
      : undefined
    const thumbnailUrl = pickThumbnail(item.snippet?.thumbnails)

    if (!videoId || !title) {
      skipped.push({
        item: {
          id: videoId ?? item.id ?? 'unknown',
          title: title || 'Untitled',
          link: '',
        },
        reason: 'Missing video id or title',
      })
      continue
    }

    const candidate = {
      sourceType: 'youtube',
      externalId: videoId,
      sourceId: channelId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      creator: channelTitle ?? item.snippet?.channelTitle ?? undefined,
      thumbnailUrl: thumbnailUrl ?? undefined,
      description,
      publishedAt: publishedAt ? new Date(publishedAt) : now,
      summary: undefined,
      topics: undefined,
      durationSeconds: undefined,
    }

    const parsed = contentUpsertInputSchema.safeParse(candidate)
    if (parsed.success) {
      entries.push(parsed.data)
    } else {
      skipped.push({
        item: {
          id: videoId,
          title,
          link: candidate.url,
        },
        reason: parsed.error.issues.map((issue) => issue.message).join('; '),
      })
    }
  }

  return { entries, skipped }
}
