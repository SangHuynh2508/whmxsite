CREATE TYPE "public"."tier_list_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
ALTER TYPE "public"."managed_entity_type" ADD VALUE 'tier_list';--> statement-breakpoint
CREATE TABLE "tier_lists" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" "tier_list_status" DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"doc" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tier_lists_slug_format" CHECK ("tier_lists"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("tier_lists"."slug") <= 40),
	CONSTRAINT "tier_lists_position_nonnegative" CHECK ("tier_lists"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tier_lists_slug_unique" ON "tier_lists" USING btree ("slug");