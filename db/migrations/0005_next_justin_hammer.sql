CREATE TYPE "public"."lore_term_kind" AS ENUM('relic_type', 'era', 'museum', 'era_range', 'affinity_level', 'organisation');--> statement-breakpoint
CREATE TYPE "public"."lore_text_state" AS ENUM('ok', 'source_changed');--> statement-breakpoint
CREATE TYPE "public"."vi_origin" AS ENUM('legacy_workbook', 'admin');--> statement-breakpoint
ALTER TYPE "public"."managed_entity_type" ADD VALUE 'character_profile';--> statement-breakpoint
ALTER TYPE "public"."managed_entity_type" ADD VALUE 'lore_term';--> statement-breakpoint
CREATE TABLE "character_profiles" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"character_entity_id" uuid NOT NULL,
	"record_id" text DEFAULT '' NOT NULL,
	"staff_status_cn" text DEFAULT '' NOT NULL,
	"store_status_cn" text DEFAULT '' NOT NULL,
	"organisation_code" text,
	"relic_type_code" text,
	"era_code" text,
	"museum_code" text,
	"era_range_code" text,
	"legacy_relic_fields" jsonb NOT NULL,
	"structure" jsonb NOT NULL,
	"source_snapshot_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"source_present" boolean DEFAULT true NOT NULL,
	"source_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lore_publish_state" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"published_file" text,
	"published_hash" text,
	"published_at" timestamp with time zone,
	"published_by_user_id" uuid,
	"last_edit_at" timestamp with time zone,
	CONSTRAINT "lore_publish_state_single_row" CHECK ("lore_publish_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "lore_terms" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"kind" "lore_term_kind" NOT NULL,
	"name_cn" text NOT NULL,
	"detail_cn" text DEFAULT '' NOT NULL,
	"name_vi" text,
	"detail_vi" text,
	"vi_origin" "vi_origin",
	"state" "lore_text_state" DEFAULT 'ok' NOT NULL,
	"vi_updated_by_user_id" uuid,
	"vi_updated_at" timestamp with time zone,
	"source_hash" text NOT NULL,
	"source_present" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lore_terms_vi_origin_pairing" CHECK (("lore_terms"."name_vi" is null and "lore_terms"."detail_vi" is null) = ("lore_terms"."vi_origin" is null))
);
--> statement-breakpoint
CREATE TABLE "profile_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_entity_id" uuid NOT NULL,
	"unit_key" text NOT NULL,
	"source_cn" text NOT NULL,
	"source_ref" text NOT NULL,
	"vi" text,
	"vi_origin" "vi_origin",
	"state" "lore_text_state" DEFAULT 'ok' NOT NULL,
	"vi_updated_by_user_id" uuid,
	"vi_updated_at" timestamp with time zone,
	"source_hash" text NOT NULL,
	"source_present" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_texts_vi_origin_pairing" CHECK (("profile_texts"."vi" is null) = ("profile_texts"."vi_origin" is null))
);
--> statement-breakpoint
ALTER TABLE "character_profiles" ADD CONSTRAINT "character_profiles_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_profiles" ADD CONSTRAINT "character_profiles_character_entity_id_characters_entity_id_fk" FOREIGN KEY ("character_entity_id") REFERENCES "public"."characters"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_profiles" ADD CONSTRAINT "character_profiles_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_publish_state" ADD CONSTRAINT "lore_publish_state_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_terms" ADD CONSTRAINT "lore_terms_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_terms" ADD CONSTRAINT "lore_terms_vi_updated_by_user_id_users_id_fk" FOREIGN KEY ("vi_updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_texts" ADD CONSTRAINT "profile_texts_profile_entity_id_character_profiles_entity_id_fk" FOREIGN KEY ("profile_entity_id") REFERENCES "public"."character_profiles"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_texts" ADD CONSTRAINT "profile_texts_vi_updated_by_user_id_users_id_fk" FOREIGN KEY ("vi_updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "character_profiles_character_unique" ON "character_profiles" USING btree ("character_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lore_terms_code_unique" ON "lore_terms" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_texts_profile_unit_unique" ON "profile_texts" USING btree ("profile_entity_id","unit_key");--> statement-breakpoint
CREATE INDEX "profile_texts_state_idx" ON "profile_texts" USING btree ("state");