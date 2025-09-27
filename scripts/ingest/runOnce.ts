import { config } from 'dotenv'
config()

import { createSupabaseServiceClient } from '../../src/server/supabase'
import { createSubscriptionRepository } from '../../src/db/dal/subscriptionRepository'
import { createContentRepository } from '../../src/db/dal/contentRepository'
import { db, closeDb } from '../../src/db/client'
import { runIngestionCycle } from '../../src/ingest/orchestrator'

async function main() {
  const youtubeApiKey = process.env.YT_API_KEY
  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID
  const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!youtubeApiKey) {
    throw new Error('YT_API_KEY is required to run the ingestion cycle.')
  }
  if (!spotifyClientId || !spotifyClientSecret) {
    throw new Error(
      'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required to run the ingestion cycle.',
    )
  }

  const supabase = createSupabaseServiceClient()
  const subscriptionRepo = createSubscriptionRepository(supabase)
  const contentRepo = createContentRepository(db)

  const summary = await runIngestionCycle(subscriptionRepo, contentRepo, {
    youtube: {
      apiKey: youtubeApiKey,
    },
    spotify: {
      credentials: {
        clientId: spotifyClientId,
        clientSecret: spotifyClientSecret,
      },
    },
  })

  console.log('[ingest] cycle completed:')
  console.table({
    attempted: summary.totals.attempted,
    ingested: summary.totals.ingested,
    skipped: summary.totals.skipped,
    errors: summary.totals.errors,
  })
}

main()
  .catch((error) => {
    console.error('[ingest] cycle failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDb()
  })
