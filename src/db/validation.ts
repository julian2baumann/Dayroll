import { z } from 'zod'
import { contentItemSourceType, subscriptionSourceType } from './schema'
import { computeContentDedupeHash } from './utils/hash'

export const feedRangeSchema = z.enum(['today', '3d', '7d'])

export const topicPreferenceSchema = z
  .array(z.string().min(2, 'Topic must include at least two characters').max(64))
  .min(1, 'Select at least one topic')
  .max(5, 'Limit topics to five to keep suggestions focused')

const trimString = () => z.string().trim().min(1)

const youtubeChannelIdRegex = /^UC[A-Za-z0-9_-]{22}$/
const spotifyShowIdRegex = /^[0-9A-Za-z]{22}$/

export const subscriptionPayloadSchema = z
  .object({
    userId: z.string().uuid(),
    sourceType: z.enum(subscriptionSourceType.enumValues),
    sourceId: trimString(),
    sourceName: trimString().max(160),
    metadata: z.record(z.any()).optional(),
  })
  .superRefine((payload, ctx) => {
    const { sourceType, sourceId } = payload
    if (sourceType === 'youtube' && !youtubeChannelIdRegex.test(sourceId)) {
      ctx.addIssue({
        path: ['sourceId'],
        code: z.ZodIssueCode.custom,
        message: 'Expected YouTube channel ID (starts with UC...)',
      })
    }
    if (sourceType === 'podcast' && !spotifyShowIdRegex.test(sourceId)) {
      ctx.addIssue({
        path: ['sourceId'],
        code: z.ZodIssueCode.custom,
        message: 'Expected Spotify show ID',
      })
    }
    if (sourceType === 'news' && !sourceId.startsWith('http')) {
      ctx.addIssue({
        path: ['sourceId'],
        code: z.ZodIssueCode.custom,
        message: 'Provide a valid RSS feed URL',
      })
    }
  })

export const contentUpsertInputSchema = z.object({
  id: z.string().uuid().optional(),
  sourceType: z.enum(contentItemSourceType.enumValues),
  externalId: trimString(),
  sourceId: trimString(),
  title: trimString().max(240),
  creator: trimString().max(180).optional(),
  url: trimString().url(),
  thumbnailUrl: trimString().url().optional(),
  description: z.string().optional(),
  publishedAt: z.coerce.date(),
  summary: z.string().optional(),
  topics: z.array(trimString()).max(10).optional(),
  durationSeconds: z.number().int().positive().optional(),
})

export type ContentUpsertInput = z.infer<typeof contentUpsertInputSchema>

export function normalizeContentInput(raw: ContentUpsertInput) {
  const publishedAt = new Date(raw.publishedAt)
  const dedupeHash = computeContentDedupeHash({
    sourceType: raw.sourceType,
    externalId: raw.externalId,
    url: raw.url,
    title: raw.title,
  })

  return {
    ...raw,
    publishedAt,
    dedupeHash,
  }
}

export const contentFilterSchema = z.object({
  sourceType: z.enum(contentItemSourceType.enumValues).optional(),
  range: feedRangeSchema,
  limit: z.number().int().positive().max(200).default(50),
  offset: z.number().int().nonnegative().default(0),
})

export type ContentFilter = z.infer<typeof contentFilterSchema>
