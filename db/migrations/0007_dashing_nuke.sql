CREATE TYPE "public"."game_ref_kind" AS ENUM('weapon', 'weapon_affix', 'job_style', 'style_sector', 'character_style');--> statement-breakpoint
CREATE TYPE "public"."game_text_kind" AS ENUM('weapon', 'weapon_skill', 'weapon_affix', 'job_style', 'style_sector', 'style_talent');--> statement-breakpoint
ALTER TYPE "public"."managed_entity_type" ADD VALUE 'character_build';--> statement-breakpoint
ALTER TYPE "public"."managed_entity_type" ADD VALUE 'game_text';--> statement-breakpoint
CREATE TABLE "character_builds" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"character_entity_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"doc" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_builds_position_nonnegative" CHECK ("character_builds"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "game_ref_kind" NOT NULL,
	"code" text NOT NULL,
	"data" jsonb NOT NULL,
	"source_hash" text NOT NULL,
	"source_present" boolean DEFAULT true NOT NULL,
	"source_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_texts" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"kind" "game_text_kind" NOT NULL,
	"code" text NOT NULL,
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
	CONSTRAINT "game_texts_vi_origin_pairing" CHECK (("game_texts"."name_vi" is null and "game_texts"."detail_vi" is null) = ("game_texts"."vi_origin" is null))
);
--> statement-breakpoint
ALTER TABLE "character_builds" ADD CONSTRAINT "character_builds_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_builds" ADD CONSTRAINT "character_builds_character_entity_id_characters_entity_id_fk" FOREIGN KEY ("character_entity_id") REFERENCES "public"."characters"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_texts" ADD CONSTRAINT "game_texts_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_texts" ADD CONSTRAINT "game_texts_vi_updated_by_user_id_users_id_fk" FOREIGN KEY ("vi_updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_builds_character_idx" ON "character_builds" USING btree ("character_entity_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "game_references_kind_code_unique" ON "game_references" USING btree ("kind","code");--> statement-breakpoint
CREATE UNIQUE INDEX "game_texts_kind_code_unique" ON "game_texts" USING btree ("kind","code");