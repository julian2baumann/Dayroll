import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contentItemSourceType, contentItems, subscriptionSourceType } from './schema'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const migrationSql = readFileSync(
  resolve(__dirname, '../../drizzle/0000_chubby_mindworm.sql'),
).toString()

describe('database schema', () => {
  it('enumerates allowed subscription types', () => {
    expect([...subscriptionSourceType.enumValues]).toEqual(['youtube', 'podcast', 'news', 'topic'])
  })

  it('enumerates allowed content item source types', () => {
    expect([...contentItemSourceType.enumValues]).toEqual([
      'youtube',
      'podcast',
      'news',
      'recommendation',
    ])
  })

  it('creates the unique subscription tuple constraint', () => {
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_source_unique"',
    )
  })

  it('creates the saved items composite primary key', () => {
    expect(migrationSql).toContain(
      'CONSTRAINT "saved_items_pkey" PRIMARY KEY("user_id","content_item_id")',
    )
  })

  it('requires dedupe hash for content items', () => {
    expect(contentItems.dedupeHash.notNull).toBe(true)
  })
})
