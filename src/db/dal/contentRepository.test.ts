import { describe, expect, it } from 'vitest'
import { newDb } from 'pg-mem'
import { drizzle } from 'drizzle-orm/node-postgres'
import crypto from 'node:crypto'
import { createContentRepository } from './contentRepository'

async function createDatabase() {
  const mem = newDb({ autoCreateForeignKeyIndices: true })
  const adapter = mem.adapters.createPg()
  const pool = new adapter.Pool()
  mem.public.registerFunction({
    name: 'uuid_generate_v4',
    returns: 'text',
    implementation: () => crypto.randomUUID(),
  })
  mem.public.none(`
    CREATE TYPE content_item_source_type AS ENUM ('youtube', 'podcast', 'news', 'recommendation');

    CREATE TABLE content_items (
      id uuid PRIMARY KEY,
      source_type content_item_source_type NOT NULL,
      external_id text NOT NULL,
      source_id text NOT NULL,
      title text NOT NULL,
      creator text,
      url text NOT NULL,
      thumbnail_url text,
      description text,
      published_at timestamptz NOT NULL,
      dedupe_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      duration_seconds integer,
      summary text,
      topics jsonb
    );

    CREATE UNIQUE INDEX content_items_external_unique ON content_items (source_type, external_id);
    CREATE UNIQUE INDEX content_items_dedupe_hash_key ON content_items (dedupe_hash);
  `)
  return drizzle(pool, { schema: await import('../schema') })
}

describe.skip('contentRepository (pg-mem lacks type parser support for timestamptz)', () => {
  it('upserts and groups items by type', async () => {
    const db = await createDatabase()
    const repo = createContentRepository(db, { emulateUpsert: true })

    const now = new Date('2025-09-17T08:00:00Z')

    await repo.upsertMany([
      {
        sourceType: 'news',
        externalId: 'article-1',
        sourceId: 'https://news.example/rss',
        title: 'Article 1',
        url: 'https://news.example/article-1',
        publishedAt: now,
      },
      {
        sourceType: 'youtube',
        externalId: 'video-1',
        sourceId: 'UCabcd1234567890123456',
        title: 'Video 1',
        url: 'https://youtube.com/watch?v=video-1',
        publishedAt: now,
      },
    ])

    const grouped = await repo.listTodayGrouped(now)
    expect(grouped.news).toHaveLength(1)
    expect(grouped.youtube).toHaveLength(1)
  })

  it('lists items by range and source type', async () => {
    const db = await createDatabase()
    const repo = createContentRepository(db, { emulateUpsert: true })

    const now = new Date('2025-09-17T08:00:00Z')

    await repo.upsertMany([
      {
        sourceType: 'news',
        externalId: 'article-1',
        sourceId: 'https://news.example/rss',
        title: 'Article 1',
        url: 'https://news.example/article-1',
        publishedAt: now,
      },
      {
        sourceType: 'news',
        externalId: 'article-2',
        sourceId: 'https://news.example/rss',
        title: 'Old Article',
        url: 'https://news.example/article-2',
        publishedAt: new Date('2025-09-10T08:00:00Z'),
      },
    ])

    const items = await repo.listByRange({
      sourceType: 'news',
      range: '3d',
      limit: 10,
      offset: 0,
      now,
    })

    expect(items).toHaveLength(1)
    expect(items[0].externalId).toBe('article-1')
  })
})
