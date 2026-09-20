CREATE TYPE "public"."asset_provider" AS ENUM('r2', 'public');--> statement-breakpoint
CREATE TYPE "public"."asset_role" AS ENUM('drawing', 'card', 'avatar');--> statement-breakpoint
CREATE TYPE "public"."override_mode" AS ENUM('inherit', 'set', 'clear');--> statement-breakpoint
CREATE TYPE "public"."override_state" AS ENUM('none', 'active', 'source_changed', 'resolved', 'cleared');--> statement-breakpoint
CREATE TABLE "acquisition_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"label_vi" text NOT NULL,
	"label_cn" text,
	"sort_order" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_provider" "asset_provider" NOT NULL,
	"object_key" text NOT NULL,
	"public_url" text,
	"content_hash" text NOT NULL,
	"mime_type" text,
	"source_snapshot_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"source_snapshot_id" uuid NOT NULL,
	"workbook_snapshot_id" uuid NOT NULL,
	"name_cn" text NOT NULL,
	"fullname_cn" text,
	"name_vi" text,
	"fullname_vi" text,
	"nickname_vi" text,
	"tags_vi" text,
	"raw_rare" integer,
	"raw_job" integer,
	"raw_attack_type" integer,
	"raw_unlock_date" integer,
	"raw_identity" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_value_hash" text NOT NULL,
	"workbook_value_hash" text NOT NULL,
	"source_present" boolean DEFAULT true NOT NULL,
	"source_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"override_value" jsonb NOT NULL,
	"base_source_value" jsonb NOT NULL,
	"base_source_hash" text NOT NULL,
	"base_source_snapshot_id" uuid NOT NULL,
	"state" "override_state" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"series_id" smallint NOT NULL,
	"source_snapshot_id" uuid NOT NULL,
	"workbook_snapshot_id" uuid NOT NULL,
	"name_cn" text NOT NULL,
	"name_vi" text NOT NULL,
	"badge_asset_id" uuid,
	"source_value_hash" text NOT NULL,
	"source_present" boolean DEFAULT true NOT NULL,
	"source_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_series_id_unique" UNIQUE("series_id")
);
--> statement-breakpoint
CREATE TABLE "skin_acquisition_state" (
	"skin_entity_id" uuid PRIMARY KEY NOT NULL,
	"source_category_id" text,
	"override_category_id" text,
	"base_source_value" jsonb,
	"base_source_hash" text NOT NULL,
	"base_source_snapshot_id" uuid NOT NULL,
	"state" "override_state" DEFAULT 'none' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skin_asset_mappings" (
	"skin_entity_id" uuid NOT NULL,
	"asset_role" "asset_role" NOT NULL,
	"source_asset_id" uuid NOT NULL,
	"override_asset_id" uuid,
	"base_source_hash" text NOT NULL,
	"base_source_snapshot_id" uuid NOT NULL,
	"state" "override_state" DEFAULT 'none' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skin_asset_mappings_pk" PRIMARY KEY("skin_entity_id","asset_role")
);
--> statement-breakpoint
CREATE TABLE "skin_series_state" (
	"skin_entity_id" uuid PRIMARY KEY NOT NULL,
	"source_series_id" smallint,
	"override_mode" "override_mode" DEFAULT 'inherit' NOT NULL,
	"override_series_id" smallint,
	"base_source_value" jsonb,
	"base_source_hash" text NOT NULL,
	"base_source_snapshot_id" uuid NOT NULL,
	"state" "override_state" DEFAULT 'none' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skin_series_state_override_check" CHECK (("skin_series_state"."override_mode" = 'set' AND "skin_series_state"."override_series_id" IS NOT NULL) OR ("skin_series_state"."override_mode" IN ('inherit', 'clear') AND "skin_series_state"."override_series_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "skins" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"skin_id" text NOT NULL,
	"character_entity_id" uuid NOT NULL,
	"source_snapshot_id" uuid NOT NULL,
	"workbook_snapshot_id" uuid NOT NULL,
	"skin_name_cn" text NOT NULL,
	"skin_name_vi" text,
	"description_cn" text,
	"description_vi" text,
	"obtain_cn" text,
	"obtain_vi" text,
	"is_base_skin" boolean NOT NULL,
	"skin_type" integer NOT NULL,
	"unlock_date" integer,
	"price" integer,
	"currency" text,
	"is_high_skin" boolean NOT NULL,
	"skin_rare_raw" jsonb,
	"cv_name" text,
	"raw_item_id" text,
	"raw_goods_id" text,
	"raw_discount_goods_id" text,
	"raw_discount_price" integer,
	"raw_discount_start" integer,
	"raw_discount_end" integer,
	"raw_series_id" smallint,
	"raw_source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_value_hash" text NOT NULL,
	"workbook_value_hash" text NOT NULL,
	"source_present" boolean DEFAULT true NOT NULL,
	"source_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_objects" ADD CONSTRAINT "asset_objects_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_workbook_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("workbook_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_overrides" ADD CONSTRAINT "field_overrides_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_overrides" ADD CONSTRAINT "field_overrides_base_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("base_source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_overrides" ADD CONSTRAINT "field_overrides_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_overrides" ADD CONSTRAINT "field_overrides_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_workbook_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("workbook_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_acquisition_state" ADD CONSTRAINT "skin_acq_skin_fk" FOREIGN KEY ("skin_entity_id") REFERENCES "public"."skins"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_acquisition_state" ADD CONSTRAINT "skin_acq_source_category_fk" FOREIGN KEY ("source_category_id") REFERENCES "public"."acquisition_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_acquisition_state" ADD CONSTRAINT "skin_acq_override_category_fk" FOREIGN KEY ("override_category_id") REFERENCES "public"."acquisition_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_acquisition_state" ADD CONSTRAINT "skin_acq_source_snapshot_fk" FOREIGN KEY ("base_source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_asset_mappings" ADD CONSTRAINT "skin_asset_mapping_skin_fk" FOREIGN KEY ("skin_entity_id") REFERENCES "public"."skins"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_asset_mappings" ADD CONSTRAINT "skin_asset_mapping_source_asset_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."asset_objects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_asset_mappings" ADD CONSTRAINT "skin_asset_mapping_override_asset_fk" FOREIGN KEY ("override_asset_id") REFERENCES "public"."asset_objects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_asset_mappings" ADD CONSTRAINT "skin_asset_mapping_source_snapshot_fk" FOREIGN KEY ("base_source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_series_state" ADD CONSTRAINT "skin_series_state_skin_entity_id_skins_entity_id_fk" FOREIGN KEY ("skin_entity_id") REFERENCES "public"."skins"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_series_state" ADD CONSTRAINT "skin_series_state_source_series_id_series_series_id_fk" FOREIGN KEY ("source_series_id") REFERENCES "public"."series"("series_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_series_state" ADD CONSTRAINT "skin_series_state_override_series_id_series_series_id_fk" FOREIGN KEY ("override_series_id") REFERENCES "public"."series"("series_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skin_series_state" ADD CONSTRAINT "skin_series_state_base_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("base_source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skins" ADD CONSTRAINT "skins_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skins" ADD CONSTRAINT "skins_character_entity_id_characters_entity_id_fk" FOREIGN KEY ("character_entity_id") REFERENCES "public"."characters"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skins" ADD CONSTRAINT "skins_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skins" ADD CONSTRAINT "skins_workbook_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("workbook_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acquisition_categories_sort_order_unique" ON "acquisition_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_objects_provider_key_unique" ON "asset_objects" USING btree ("storage_provider","object_key");--> statement-breakpoint
CREATE INDEX "asset_objects_content_hash_idx" ON "asset_objects" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_character_id_unique" ON "characters" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "characters_source_snapshot_idx" ON "characters" USING btree ("source_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "field_overrides_entity_field_unique" ON "field_overrides" USING btree ("entity_id","field_name");--> statement-breakpoint
CREATE INDEX "field_overrides_state_idx" ON "field_overrides" USING btree ("state");--> statement-breakpoint
CREATE INDEX "series_source_snapshot_idx" ON "series" USING btree ("source_snapshot_id");--> statement-breakpoint
CREATE INDEX "skin_asset_mappings_source_asset_idx" ON "skin_asset_mappings" USING btree ("source_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skins_skin_id_unique" ON "skins" USING btree ("skin_id");--> statement-breakpoint
CREATE INDEX "skins_character_entity_idx" ON "skins" USING btree ("character_entity_id");--> statement-breakpoint
CREATE INDEX "skins_source_series_idx" ON "skins" USING btree ("raw_series_id");--> statement-breakpoint
CREATE INDEX "skins_source_snapshot_idx" ON "skins" USING btree ("source_snapshot_id");