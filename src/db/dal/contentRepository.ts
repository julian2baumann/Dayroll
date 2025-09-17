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

export function createContentRepository(
  db: AnyPgDatabase<typeof schema>,
  options: { emulateUpsert?: boolean } = {},
) {
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
        publishedAt: new Date(prepared.publishedAt),
        dedupeHash: prepared.dedupeHash,
        durationSeconds: prepared.durationSeconds ?? null,
        summary: prepared.summary ?? null,
        topics: prepared.topics ?? null,
      }
    })

    let affected = 0

    if (options.emulateUpsert) {
      for (const record of normalized) {
        await db.transaction(async (tx) => {
          await tx
            .delete(contentItems)
            .where(
              and(
                eq(contentItems.sourceType, record.sourceType),
                eq(contentItems.externalId, record.externalId),
              ),
            )

          await tx.insert(contentItems).values(record)
        })

        affected += 1
      }
      return affected
    }

    for (const record of normalized) {
      await db
        .insert(contentItems)
        .values(record)
        .onConflictDoUpdate({
          target: [contentItems.sourceType, contentItems.externalId],
          set: {
            title: record.title,
            creator: record.creator,
            url: record.url,
            thumbnailUrl: record.thumbnailUrl,
            description: record.description,
            publishedAt: record.publishedAt,
            dedupeHash: record.dedupeHash,
            summary: record.summary,
            topics: record.topics,
            durationSeconds: record.durationSeconds,
          },
        })

      affected += 1
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
      orderBy: (table, { desc }) => desc(table.publishedAt),
    })
  }

  async function listTodayGrouped(now: Date = new Date()) {
    const window = getRangeBounds('today', now)
    const items = await db
      .select()
      .from(contentItems)
      .where(
        and(gte(contentItems.publishedAt, window.start), lte(contentItems.publishedAt, window.end)),
      )
      .orderBy(contentItems.publishedAt.desc())

    return items.reduce<Record<string, schema.ContentItem[]>>((acc, item) => {
      const group = item.sourceType
      if (!acc[group]) {
        acc[group] = []
      }
      acc[group].push(item)
      return acc
    }, {})
  }

  return {
    upsertMany,
    listByRange,
    listTodayGrouped,
  }
}

export type GroupedTodayFeed = Awaited<
  ReturnType<ReturnType<typeof createContentRepository>['listTodayGrouped']>
>
