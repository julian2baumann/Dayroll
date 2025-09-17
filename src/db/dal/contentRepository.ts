import crypto from 'node:crypto'
import { and, eq, gte, lte } from 'drizzle-orm'
import type { AnyPgDatabase } from 'drizzle-orm'
import * as schema from '../schema'
import { contentItems } from '../schema'
import type { ContentFilter, ContentUpsertInput } from '../validation'
import { normalizeContentInput } from '../validation'
import { getRangeBounds } from '../dateRanges'
import type { FeedRange } from '../dateRanges'

export type ContentRepository = ReturnType<typeof createContentRepository>

export function createContentRepository(db: AnyPgDatabase<typeof schema>) {
  async function upsertMany(items: ContentUpsertInput[]): Promise<number> {
    if (items.length === 0) return 0

    const normalized = items.map((item) => {
      const prepared = normalizeContentInput(item)
      return {
        id: prepared.id ?? crypto.randomUUID(),
        sourceType: prepared.sourceType,
        externalId: prepared.externalId,
        sourceId: prepared.sourceId,
        title: prepared.title,
        creator: prepared.creator ?? null,
        url: prepared.url,
        thumbnailUrl: prepared.thumbnailUrl ?? null,
        description: prepared.description ?? null,
        publishedAt: new Date(
          typeof prepared.publishedAt === 'number'
            ? prepared.publishedAt
            : prepared.publishedAt instanceof Date
              ? prepared.publishedAt.getTime()
              : new Date(prepared.publishedAt as unknown as string).getTime(),
        ),
        dedupeHash: prepared.dedupeHash,
        durationSeconds: prepared.durationSeconds ?? null,
        summary: prepared.summary ?? null,
        topics: prepared.topics ?? null,
      }
    })

    const chunkSize = 100
    let affected = 0

    for (let i = 0; i < normalized.length; i += chunkSize) {
      const slice = normalized.slice(i, i + chunkSize)
      const result = await db
        .insert(contentItems)
        .values(slice)
        .onConflictDoUpdate({
          target: [contentItems.sourceType, contentItems.externalId],
          set: {
            title: (values) => values.title,
            creator: (values) => values.creator,
            url: (values) => values.url,
            thumbnailUrl: (values) => values.thumbnailUrl,
            description: (values) => values.description,
            publishedAt: (values) => values.publishedAt,
            dedupeHash: (values) => values.dedupeHash,
            summary: (values) => values.summary,
            topics: (values) => values.topics,
            durationSeconds: (values) => values.durationSeconds,
          },
        })
        .returning({ id: contentItems.id })

      affected += result.length
    }

    return affected
  }

  async function listByRange(params: ContentFilter & { now?: Date }) {
    const { sourceType, range, limit, offset, now } = params
    const referenceNow = now ?? new Date()
    const window = getRangeBounds(range as FeedRange, referenceNow)

    return db.query.contentItems.findMany({
      where: (table) => {
        const rangePredicate = and(
          gte(table.publishedAt, window.start),
          lte(table.publishedAt, window.end),
        )

        return sourceType ? and(eq(table.sourceType, sourceType), rangePredicate) : rangePredicate
      },
      limit: limit ?? 50,
      offset: offset ?? 0,
      orderBy: (table, { desc: orderDesc }) => orderDesc(table.publishedAt),
    })
  }

  return {
    upsertMany,
    listByRange,
  }
}
