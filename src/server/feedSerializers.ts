import { contentItemSourceType } from '../db/schema'
import type { FeedRange } from '../db/dateRanges'
import { startOfDay } from '../db/dateRanges'

type SourceType = (typeof contentItemSourceType.enumValues)[number]

export interface ContentItemRecord {
  id: string
  sourceType: SourceType
  externalId: string
  sourceId: string
  title: string
  creator: string | null
  url: string
  thumbnailUrl: string | null
  description: string | null
  summary: string | null
  topics: string[] | null
  durationSeconds: number | null
  publishedAt: Date
}

interface SupabaseContentRow {
  id: string
  source_type: SourceType
  external_id: string
  source_id: string
  title: string
  creator: string | null
  url: string
  thumbnail_url: string | null
  description: string | null
  published_at: string | Date
  summary: string | null
  topics: unknown
  duration_seconds: number | null
}

export function deserializeContentRow(row: SupabaseContentRow): ContentItemRecord {
  return {
    id: row.id,
    sourceType: row.source_type,
    externalId: row.external_id,
    sourceId: row.source_id,
    title: row.title,
    creator: row.creator,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    description: row.description,
    summary: row.summary,
    topics: Array.isArray(row.topics)
      ? row.topics.filter((topic): topic is string => typeof topic === 'string')
      : null,
    durationSeconds: row.duration_seconds,
    publishedAt: normalizeDate(row.published_at),
  }
}

function normalizeDate(value: string | Date): Date {
  if (value instanceof Date) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }
  return parsed
}

export interface SerializedFeedItem {
  id: string
  sourceType: SourceType
  sourceId: string
  title: string
  creator: string | null
  url: string
  thumbnailUrl: string | null
  description: string | null
  summary: string | null
  topics: string[] | null
  durationSeconds: number | null
  publishedAt: string
  timeAgo: string
}

export function serializeFeedItem(item: ContentItemRecord, now: Date): SerializedFeedItem {
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    title: item.title,
    creator: item.creator,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    description: item.description,
    summary: item.summary,
    topics: item.topics,
    durationSeconds: item.durationSeconds,
    publishedAt: item.publishedAt.toISOString(),
    timeAgo: formatRelativeTime(item.publishedAt, now),
  }
}

function formatRelativeTime(date: Date, reference: Date): string {
  const diffMs = reference.getTime() - date.getTime()
  if (diffMs <= 0) return 'just now'

  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 minute ago'
  if (minutes < 60) return `${minutes} minutes ago`

  const hours = Math.round(minutes / 60)
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`

  const days = Math.round(hours / 24)
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface FeedSection {
  label: string
  items: SerializedFeedItem[]
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function buildSections(
  items: ContentItemRecord[],
  now: Date,
  range: FeedRange,
): FeedSection[] {
  const buckets: Record<'today' | 'yesterday' | 'twoDaysAgo' | 'earlier', SerializedFeedItem[]> = {
    today: [],
    yesterday: [],
    twoDaysAgo: [],
    earlier: [],
  }

  const startToday = startOfDay(now)

  for (const item of items) {
    const serialized = serializeFeedItem(item, now)
    const diffDays = calculateDayDifference(startToday, item.publishedAt)

    if (diffDays <= 0) {
      buckets.today.push(serialized)
    } else if (diffDays === 1) {
      buckets.yesterday.push(serialized)
    } else if (diffDays === 2) {
      buckets.twoDaysAgo.push(serialized)
    } else {
      buckets.earlier.push(serialized)
    }
  }

  const sections: FeedSection[] = []

  if (buckets.today.length > 0 || range === 'today') {
    sections.push({ label: 'Today', items: buckets.today })
  }

  if (range !== 'today') {
    if (buckets.yesterday.length > 0 || range !== 'today') {
      sections.push({ label: 'Yesterday', items: buckets.yesterday })
    }
    if (range === '3d' || range === '7d') {
      sections.push({ label: '2 days ago', items: buckets.twoDaysAgo })
    }
    if (range === '7d') {
      sections.push({ label: 'Earlier this week', items: buckets.earlier })
    }
  }

  return sections
}

function calculateDayDifference(referenceStart: Date, target: Date): number {
  const targetStart = startOfDay(target)
  const diffMs = referenceStart.getTime() - targetStart.getTime()
  return Math.floor(diffMs / DAY_IN_MS)
}

export function emptyContentGroups(): Record<SourceType, ContentItemRecord[]> {
  return contentItemSourceType.enumValues.reduce(
    (acc, type) => {
      acc[type] = []
      return acc
    },
    {} as Record<SourceType, ContentItemRecord[]>,
  )
}
