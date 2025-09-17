import crypto from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, closeDb } from './client'
import { contentItems, savedItems, subscriptions, ttsAssets, users } from './schema'

async function seed() {
  console.info('🌱 Seeding Dayroll development database...')

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE TABLE tts_assets, user_interactions, saved_items, content_items, subscriptions, users RESTART IDENTITY CASCADE`,
    )

    const userId = crypto.randomUUID()
    await tx.insert(users).values({
      id: userId,
      email: 'morning@example.com',
      onboardingCompleted: true,
    })

    const youtubeSubId = crypto.randomUUID()
    const newsSubId = crypto.randomUUID()

    await tx.insert(subscriptions).values([
      {
        id: youtubeSubId,
        userId,
        sourceType: 'youtube',
        sourceId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
        sourceName: 'Google Developers',
        metadata: {
          category: 'youtube',
          url: 'https://www.youtube.com/@GoogleDevelopers',
          thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
        },
      },
      {
        id: newsSubId,
        userId,
        sourceType: 'news',
        sourceId: 'https://www.theverge.com/rss/index.xml',
        sourceName: 'The Verge',
        metadata: {
          category: 'news',
          url: 'https://www.theverge.com',
        },
      },
    ])

    const videoItemId = crypto.randomUUID()
    const newsItemId = crypto.randomUUID()

    await tx.insert(contentItems).values([
      {
        id: videoItemId,
        sourceType: 'youtube',
        externalId: 'zv3ZV0F4Xxk',
        sourceId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
        title: 'State of the Web Platform 2025',
        creator: 'Google Developers',
        url: 'https://www.youtube.com/watch?v=zv3ZV0F4Xxk',
        thumbnailUrl: 'https://i.ytimg.com/vi/zv3ZV0F4Xxk/hqdefault.jpg',
        description: 'Highlights from the latest web capabilities update.',
        publishedAt: new Date(),
        dedupeHash: 'yt_zv3ZV0F4Xxk',
        durationSeconds: 980,
      },
      {
        id: newsItemId,
        sourceType: 'news',
        externalId: 'https://www.theverge.com/2025/9/17/dayroll-launch',
        sourceId: 'https://www.theverge.com/rss/index.xml',
        title: 'Dayroll launches a consolidated daily feed',
        creator: 'The Verge',
        url: 'https://www.theverge.com/2025/9/17/dayroll-launch',
        thumbnailUrl: 'https://cdn.theverge.com/logo.png',
        description: 'An overview of the Dayroll feed experience.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
        dedupeHash: 'news_dayroll_launch',
        summary: 'Dayroll rolls out a unified feed for videos, podcasts, and news.',
        topics: ['daily feed', 'productivity'],
      },
    ])

    await tx.insert(savedItems).values({
      userId,
      contentItemId: newsItemId,
    })

    await tx.insert(ttsAssets).values({
      id: crypto.randomUUID(),
      contentItemId: newsItemId,
      audioUrl: 'https://cdn.dayroll.app/tts/dayroll-launch.mp3',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    })
  })

  console.info('✅ Seed complete')
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDb()
  })
