import { describe, expect, it, vi } from 'vitest'
import type { AnyPgDatabase } from 'drizzle-orm'
import * as schema from '../schema'
import type { ContentItem } from '../schema'
import { contentUpsertInputSchema, contentFilterSchema } from '../validation'
import { createContentRepository } from './contentRepository'

type DbMock = AnyPgDatabase<typeof schema> & {
  __store: Array<schema.ContentItem>
}

function createDbStub(): DbMock {
  const store: ContentItem[] = []

  const db: Partial<DbMock> = {
    __store: store,
    insert: vi.fn(() => ({
      values: (rows: Array<Record<string, unknown>>) => ({
        onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => ({
          returning: async () => {
            rows.forEach((row) => {
              const existingIndex = store.findIndex(
                (item) => item.sourceType === row.sourceType && item.externalId === row.externalId,
              )
              if (existingIndex >= 0) {
                const existing = store[existingIndex]
                const resolvedUpdates = Object.entries(set).reduce<Record<string, unknown>>(
                  (acc, [key, resolver]) => {
                    acc[key] =
                      typeof resolver === 'function'
                        ? (resolver as (values: typeof row) => unknown)(row)
                        : resolver
                    return acc
                  },
                  {},
                )
                store[existingIndex] = { ...existing, ...resolvedUpdates }
              } else {
                store.push({ ...row })
              }
            })
            return rows.map((row) => ({ id: row.id }))
          },
        }),
      }),
    })),
    query: {
      contentItems: {
        findMany: vi.fn(async ({ limit, offset }: { limit?: number; offset?: number }) => {
          const ordered = [...store].sort(
            (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
          )
          return ordered.slice(offset ?? 0, (offset ?? 0) + (limit ?? 50))
        }),
      },
    },
  }

  return db as DbMock
}

describe('contentRepository (stubbed)', () => {
  it('generates dedupe hash when upserting', async () => {
    const db = createDbStub()
    const repo = createContentRepository(db)

    const payload = contentUpsertInputSchema.parse({
      sourceType: 'youtube',
      externalId: 'video-1',
      sourceId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      title: 'Original Title',
      url: 'https://example.com/watch?v=video-1',
      publishedAt: new Date(),
    })

    await repo.upsertMany([payload])

    expect(db.__store).toHaveLength(1)
    expect(db.__store[0].dedupeHash).toMatch(/^[a-f0-9]{64}$/)

    await repo.upsertMany([
      {
        ...payload,
        title: 'Updated Title',
        description: 'updated description',
      },
    ])

    expect(db.__store).toHaveLength(1)
    expect(db.__store[0].title).toBe('Updated Title')
    expect(db.__store[0].description).toBe('updated description')
  })

  it('builds range queries with defaults', async () => {
    const db = createDbStub()
    const repo = createContentRepository(db)
    const filter = contentFilterSchema.parse({ range: 'today' })
    await repo.listByRange(filter)

    expect(db.query.contentItems.findMany).toHaveBeenCalled()
  })
})
