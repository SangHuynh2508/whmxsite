CREATE TYPE "public"."game_ref_kind" AS ENUM('weapon', 'weapon_affix', 'job_style', 'style_sector', 'character_style');--> statement-breakpoint
ALTER TYPE "public"."managed_entity_type" ADD VALUE 'character_build';--> statement-breakpoint
ALTER TYPE "public"."lore_term_kind" ADD VALUE 'weapon';--> statement-breakpoint
ALTER TYPE "public"."lore_term_kind" ADD VALUE 'weapon_skill';--> statement-breakpoint
ALTER TYPE "public"."lore_term_kind" ADD VALUE 'weapon_affix';--> statement-breakpoint
ALTER TYPE "public"."lore_term_kind" ADD VALUE 'job_style';--> statement-breakpoint
ALTER TYPE "public"."lore_term_kind" ADD VALUE 'style_sector';--> statement-breakpoint
ALTER TYPE "public"."lore_term_kind" ADD VALUE 'style_talent';--> statement-breakpoint
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
ALTER TABLE "character_builds" ADD CONSTRAINT "character_builds_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_builds" ADD CONSTRAINT "character_builds_character_entity_id_characters_entity_id_fk" FOREIGN KEY ("character_entity_id") REFERENCES "public"."characters"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_builds_character_idx" ON "character_builds" USING btree ("character_entity_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "game_references_kind_code_unique" ON "game_references" USING btree ("kind","code");