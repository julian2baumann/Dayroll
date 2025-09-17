import { XMLParser } from 'fast-xml-parser'
import { contentUpsertInputSchema } from '../../db/validation'
import type { ContentUpsertInput } from '../../db/validation'
import type {
  MapContentResult,
  ParsedRssFeed,
  RssFeedItem,
  RssMapperOptions,
  SkippedItem,
} from './types'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
})

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function pickLink(node: unknown): string {
  const candidate = Array.isArray(node) ? node[0] : node
  if (!candidate) return ''
  if (typeof candidate === 'string') return candidate
  if (typeof candidate === 'object') {
    // Atom feeds encode link as { href: "..." }
    const href =
      (candidate as Record<string, unknown>).href ??
      (candidate as Record<string, unknown>)['@_href']
    if (typeof href === 'string') return href
    const text = (candidate as Record<string, unknown>)['#text']
    if (typeof text === 'string') return text
  }
  return ''
}

function pickValue(node: unknown): string | undefined {
  if (!node) return undefined
  if (typeof node === 'string') return node
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    if (typeof record['#text'] === 'string') return record['#text'] as string
    if (typeof record['_text'] === 'string') return record['_text'] as string
  }
  return undefined
}

function resolveImage(node: unknown): string | undefined {
  if (!node) return undefined
  if (typeof node === 'string') return node
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    if (typeof record.url === 'string') return record.url as string
    if (typeof record['@_url'] === 'string') return record['@_url'] as string
    if (typeof record['@_href'] === 'string') return record['@_href'] as string
  }
  return undefined
}

export function parseRss(xml: string): ParsedRssFeed {
  const root = xmlParser.parse(xml)
  const channel = root?.rss?.channel ?? root?.feed ?? root ?? {}

  const feedLink = pickLink(channel.link)
  const feedImage =
    resolveImage(channel.image) ??
    resolveImage(channel['itunes:image']) ??
    resolveImage(channel['media:thumbnail']) ??
    undefined

  const rawItems = ensureArray(channel.item ?? channel.entry)

  const items: RssFeedItem[] = rawItems
    .map((raw) => {
      if (!raw) return undefined
      const guid = pickValue(raw.guid)
      const id = String(guid ?? raw.id ?? '').trim()
      const title = pickValue(raw.title) ?? ''
      const link = pickLink(raw.link ?? raw.id)
      const description =
        pickValue(raw['content:encoded']) ??
        pickValue(raw.description) ??
        pickValue(raw.summary) ??
        pickValue(raw.content)
      const author =
        pickValue(raw['dc:creator']) ??
        pickValue(raw.author?.name) ??
        pickValue(raw.author) ??
        undefined
      const enclosureNode = raw.enclosure
        ? Array.isArray(raw.enclosure)
          ? raw.enclosure[0]
          : raw.enclosure
        : undefined
      const enclosureUrl = resolveImage(enclosureNode)
      const mediaImage =
        resolveImage(raw['media:thumbnail']) ??
        resolveImage(raw['media:content']) ??
        resolveImage(raw['itunes:image'])
      const publishedCandidate =
        pickValue(raw.pubDate) ??
        pickValue(raw.published) ??
        pickValue(raw.updated) ??
        pickValue(raw['dc:date'])
      const publishedAt = toDate(publishedCandidate)

      const cleanId = (id || link || title).trim()
      const cleanTitle = title.trim()
      const cleanLink = link.trim()
      if (!cleanId || !cleanTitle || !cleanLink) return undefined

      return {
        id: cleanId,
        title: cleanTitle,
        link: cleanLink,
        description,
        publishedAt,
        author: author?.trim(),
        enclosureUrl,
        imageUrl: mediaImage ?? resolveImage(raw.image),
      } satisfies RssFeedItem
    })
    .filter((item): item is RssFeedItem => Boolean(item))

  return {
    title: pickValue(channel.title),
    link: feedLink ? feedLink.trim() : undefined,
    imageUrl: feedImage ? feedImage.trim() : undefined,
    items,
  }
}

export function mapRssItemsToContent(
  feed: ParsedRssFeed,
  subscription: { sourceId: string; sourceName?: string },
  options: RssMapperOptions,
): MapContentResult {
  const now = options.now ?? new Date()
  const fallbackCreator = options.fallbackCreator ?? subscription.sourceName ?? undefined
  const fallbackImage = options.fallbackImage ?? feed.imageUrl ?? undefined

  const entries: ContentUpsertInput[] = []
  const skipped: SkippedItem[] = []

  for (const item of feed.items) {
    const description = item.description ? item.description.slice(0, 2000) : undefined
    const candidate = {
      sourceType: options.sourceType,
      externalId: item.id,
      sourceId: subscription.sourceId,
      title: item.title,
      url: item.link,
      creator: item.author ?? fallbackCreator,
      thumbnailUrl: item.imageUrl ?? fallbackImage,
      description,
      publishedAt: item.publishedAt ?? now,
      summary: undefined,
      topics: undefined,
      durationSeconds: undefined,
    }

    const parsed = contentUpsertInputSchema.safeParse(candidate)
    if (parsed.success) {
      entries.push(parsed.data)
    } else {
      skipped.push({
        item,
        reason: parsed.error.issues.map((issue) => issue.message).join('; '),
      })
    }
  }

  return { entries, skipped }
}
