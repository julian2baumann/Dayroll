CREATE TYPE "public"."content_item_source_type" AS ENUM('youtube', 'podcast', 'news', 'recommendation');--> statement-breakpoint
CREATE TYPE "public"."subscription_source_type" AS ENUM('youtube', 'podcast', 'news', 'topic');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_type" "content_item_source_type" NOT NULL,
	"external_id" text NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"creator" text,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"description" text,
	"published_at" timestamp with time zone NOT NULL,
	"dedupe_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_seconds" integer,
	"summary" text,
	"topics" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_items" (
	"user_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_items_pkey" PRIMARY KEY("user_id","content_item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" "subscription_source_type" NOT NULL,
	"source_id" text NOT NULL,
	"source_name" text NOT NULL,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tts_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"content_item_id" uuid NOT NULL,
	"audio_url" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_interactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_externally" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"auth_provider" text DEFAULT 'supabase' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tts_assets" ADD CONSTRAINT "tts_assets_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_items_dedupe_hash_key" ON "content_items" USING btree ("dedupe_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_items_external_unique" ON "content_items" USING btree ("source_type","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_items_published_idx" ON "content_items" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_items_source_type_published_idx" ON "content_items" USING btree ("source_type","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_items_saved_at_idx" ON "saved_items" USING btree ("saved_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_source_unique" ON "subscriptions" USING btree ("user_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_user_created_at_idx" ON "subscriptions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tts_assets_content_item_id_key" ON "tts_assets" USING btree ("content_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tts_assets_expires_at_idx" ON "tts_assets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_interactions_user_content_idx" ON "user_interactions" USING btree ("user_id","content_item_id","clicked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" USING btree ("created_at");
