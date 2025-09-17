import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const subscriptionSourceType = pgEnum('subscription_source_type', [
  'youtube',
  'podcast',
  'news',
  'topic',
])

export const contentItemSourceType = pgEnum('content_item_source_type', [
  'youtube',
  'podcast',
  'news',
  'recommendation',
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').notNull().primaryKey(),
    email: text('email').notNull(),
    authProvider: text('auth_provider').default('supabase').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_key').on(table.email),
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
  }),
)

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').notNull().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceType: subscriptionSourceType('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    sourceName: text('source_name').notNull(),
    metadata: jsonb('metadata'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userSourceIdx: uniqueIndex('subscriptions_user_source_unique').on(
      table.userId,
      table.sourceType,
      table.sourceId,
    ),
    userCreatedIdx: index('subscriptions_user_created_at_idx').on(table.userId, table.createdAt),
  }),
)

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').notNull().primaryKey(),
    sourceType: contentItemSourceType('source_type').notNull(),
    externalId: text('external_id').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    creator: text('creator'),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    description: text('description'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    dedupeHash: text('dedupe_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    durationSeconds: integer('duration_seconds'),
    summary: text('summary'),
    topics: jsonb('topics'),
  },
  (table) => ({
    dedupeUnique: uniqueIndex('content_items_dedupe_hash_key').on(table.dedupeHash),
    externalUnique: uniqueIndex('content_items_external_unique').on(
      table.sourceType,
      table.externalId,
    ),
    publishedIdx: index('content_items_published_idx').on(table.publishedAt.desc()),
    sourcePublishedIdx: index('content_items_source_type_published_idx').on(
      table.sourceType,
      table.publishedAt.desc(),
    ),
  }),
)

export const savedItems = pgTable(
  'saved_items',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.contentItemId], name: 'saved_items_pkey' }),
    savedAtIdx: index('saved_items_saved_at_idx').on(table.savedAt.desc()),
  }),
)

export const userInteractions = pgTable(
  'user_interactions',
  {
    id: uuid('id').notNull().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }).notNull().defaultNow(),
    openedExternally: boolean('opened_externally').default(true),
  },
  (table) => ({
    userContentIdx: index('user_interactions_user_content_idx').on(
      table.userId,
      table.contentItemId,
      table.clickedAt.desc(),
    ),
  }),
)

export const ttsAssets = pgTable(
  'tts_assets',
  {
    id: uuid('id').notNull().primaryKey(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    audioUrl: text('audio_url').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    contentItemIdx: uniqueIndex('tts_assets_content_item_id_key').on(table.contentItemId),
    expiryIdx: index('tts_assets_expires_at_idx').on(table.expiresAt),
  }),
)

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  savedItems: many(savedItems),
  interactions: many(userInteractions),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}))

export const contentItemsRelations = relations(contentItems, ({ many }) => ({
  savedBy: many(savedItems),
  interactions: many(userInteractions),
  ttsAssets: many(ttsAssets),
}))

export const savedItemsRelations = relations(savedItems, ({ one }) => ({
  user: one(users, {
    fields: [savedItems.userId],
    references: [users.id],
  }),
  contentItem: one(contentItems, {
    fields: [savedItems.contentItemId],
    references: [contentItems.id],
  }),
}))

export const ttsAssetsRelations = relations(ttsAssets, ({ one }) => ({
  contentItem: one(contentItems, {
    fields: [ttsAssets.contentItemId],
    references: [contentItems.id],
  }),
}))

export type User = typeof users.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type ContentItem = typeof contentItems.$inferSelect
export type SavedItem = typeof savedItems.$inferSelect
export type UserInteraction = typeof userInteractions.$inferSelect
export type TtsAsset = typeof ttsAssets.$inferSelect
