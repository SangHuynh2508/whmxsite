CREATE TYPE "public"."asset_provenance" AS ENUM('source_extracted', 'manual_official', 'manual_preview', 'manual_placeholder');--> statement-breakpoint
CREATE TYPE "public"."asset_storage_tier" AS ENUM('public_delivery', 'private_original', 'local_public');--> statement-breakpoint
CREATE TYPE "public"."asset_verification_state" AS ENUM('pending', 'verified', 'quarantined', 'retired');--> statement-breakpoint
CREATE TYPE "public"."asset_selection_mode" AS ENUM('source', 'manual');--> statement-breakpoint
CREATE TYPE "public"."asset_source_state" AS ENUM('no_source', 'current', 'replacement_pending', 'source_changed');--> statement-breakpoint
CREATE TYPE "public"."character_lifecycle" AS ENUM('unverified', 'unreleased', 'released', 'retired');--> statement-breakpoint
CREATE TYPE "public"."character_origin" AS ENUM('manual_preview', 'source_backed');--> statement-breakpoint
CREATE TYPE "public"."character_visibility" AS ENUM('hidden', 'preview', 'public');--> statement-breakpoint
CREATE TYPE "public"."preview_reconciliation_status" AS ENUM('proposed', 'confirmed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."preview_retired_reason" AS ENUM('reconciled', 'identity_incorrect', 'duplicate_preview', 'withdrawn', 'other');--> statement-breakpoint
CREATE TYPE "public"."upload_intent_status" AS ENUM('issued', 'uploaded', 'verified', 'finalized', 'expired', 'rejected', 'cleaned');--> statement-breakpoint
ALTER TYPE "public"."managed_entity_type" ADD VALUE IF NOT EXISTS 'preview_character';--> statement-breakpoint
CREATE UNIQUE INDEX "managed_entities_id_type_unique" ON "managed_entities" USING btree ("id","entity_type");--> statement-breakpoint
CREATE TABLE "asset_upload_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" "managed_entity_type" NOT NULL,
	"asset_role" text NOT NULL,
	"requested_provenance" "asset_provenance" NOT NULL,
	"requested_filename" text,
	"quarantine_object_key" text NOT NULL,
	"max_bytes" bigint NOT NULL,
	"allowed_mime_types" jsonb NOT NULL,
	"expected_revision" bigint NOT NULL,
	"status" "upload_intent_status" DEFAULT 'issued' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"finalized_by_user_id" uuid,
	"finalized_at" timestamp with time zone,
	"failure_reason" text,
	CONSTRAINT "asset_upload_intents_max_bytes_check" CHECK ("asset_upload_intents"."max_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "character_publication_states" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"entity_type" "managed_entity_type" NOT NULL,
	"origin" character_origin NOT NULL,
	"lifecycle" character_lifecycle NOT NULL,
	"visibility" character_visibility NOT NULL,
	"public_key" text NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid,
	CONSTRAINT "character_publication_states_origin_type_check" CHECK ((
        ("character_publication_states"."entity_type" = 'preview_character' and "character_publication_states"."origin" = 'manual_preview')
        or
        ("character_publication_states"."entity_type" = 'character' and "character_publication_states"."origin" = 'source_backed')
      )),
	CONSTRAINT "character_publication_states_entity_type_check" CHECK ("character_publication_states"."entity_type" in ('preview_character', 'character'))
);
--> statement-breakpoint
CREATE TABLE "entity_asset_mappings" (
	"entity_id" uuid NOT NULL,
	"entity_type" "managed_entity_type" NOT NULL,
	"asset_role" text NOT NULL,
	"mapping_slot" text DEFAULT 'primary' NOT NULL,
	"active_asset_id" uuid NOT NULL,
	"source_asset_id" uuid,
	"selection_mode" "asset_selection_mode" NOT NULL,
	"source_state" "asset_source_state" NOT NULL,
	"base_source_hash" text,
	"base_source_snapshot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid,
	CONSTRAINT "entity_asset_mappings_pk" PRIMARY KEY("entity_id","asset_role","mapping_slot"),
	CONSTRAINT "entity_asset_mappings_selection_check" CHECK (("entity_asset_mappings"."selection_mode" = 'source' and "entity_asset_mappings"."source_asset_id" is not null and "entity_asset_mappings"."active_asset_id" = "entity_asset_mappings"."source_asset_id") or "entity_asset_mappings"."selection_mode" = 'manual')
);
--> statement-breakpoint
CREATE TABLE "entity_asset_role_rules" (
	"entity_type" "managed_entity_type" NOT NULL,
	"asset_role" text NOT NULL,
	"allows_source" boolean NOT NULL,
	"allows_manual" boolean NOT NULL,
	"maximum_active_mappings" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "entity_asset_role_rules_pk" PRIMARY KEY("entity_type","asset_role"),
	CONSTRAINT "entity_asset_role_rules_maximum_active_mappings_check" CHECK ("entity_asset_role_rules"."maximum_active_mappings" > 0)
);
--> statement-breakpoint
CREATE TABLE "preview_character_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preview_entity_id" uuid NOT NULL,
	"official_character_entity_id" uuid NOT NULL,
	"evaluated_source_snapshot_id" uuid NOT NULL,
	"status" "preview_reconciliation_status" NOT NULL,
	"candidate_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decision_notes" text,
	"proposed_by_user_id" uuid,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"change_group_id" uuid NOT NULL,
	"request_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preview_characters" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"claimed_raw_id" text,
	"claimed_raw_id_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"name_cn" text,
	"fullname_cn" text,
	"name_vi" text,
	"fullname_vi" text,
	"nickname_vi" text,
	"tags_vi" text,
	"manual_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provenance_notes" text,
	"retired_reason" "preview_retired_reason",
	"reconciled_to_character_entity_id" uuid,
	"reconciled_at" timestamp with time zone,
	"reconciled_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	CONSTRAINT "preview_characters_reconciliation_fields_check" CHECK ((
        ("preview_characters"."reconciled_to_character_entity_id" is null and "preview_characters"."reconciled_at" is null and "preview_characters"."reconciled_by_user_id" is null)
        or
        ("preview_characters"."reconciled_to_character_entity_id" is not null and "preview_characters"."reconciled_at" is not null and "preview_characters"."reconciled_by_user_id" is not null)
      ))
);
--> statement-breakpoint
ALTER TABLE "asset_objects" ALTER COLUMN "source_snapshot_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "provenance" "asset_provenance" DEFAULT 'source_extracted' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "storage_tier" "asset_storage_tier" DEFAULT 'local_public' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "verification_state" "asset_verification_state" DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "derived_from_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "byte_size" bigint;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "detected_mime_type" text;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asset_upload_intents" ADD CONSTRAINT "asset_upload_intents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_upload_intents" ADD CONSTRAINT "asset_upload_intents_finalized_by_user_id_users_id_fk" FOREIGN KEY ("finalized_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_upload_intents" ADD CONSTRAINT "asset_upload_intents_managed_entity_fk" FOREIGN KEY ("entity_id","entity_type") REFERENCES "public"."managed_entities"("id","entity_type") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_upload_intents" ADD CONSTRAINT "asset_upload_intents_role_rule_fk" FOREIGN KEY ("entity_type","asset_role") REFERENCES "public"."entity_asset_role_rules"("entity_type","asset_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_publication_states" ADD CONSTRAINT "character_publication_states_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_publication_states" ADD CONSTRAINT "character_publication_states_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_publication_states" ADD CONSTRAINT "character_publication_states_managed_entity_fk" FOREIGN KEY ("entity_id","entity_type") REFERENCES "public"."managed_entities"("id","entity_type") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_asset_mappings" ADD CONSTRAINT "entity_asset_mappings_active_asset_id_asset_objects_id_fk" FOREIGN KEY ("active_asset_id") REFERENCES "public"."asset_objects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_asset_mappings" ADD CONSTRAINT "entity_asset_mappings_source_asset_id_asset_objects_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."asset_objects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_asset_mappings" ADD CONSTRAINT "entity_asset_mappings_base_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("base_source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_asset_mappings" ADD CONSTRAINT "entity_asset_mappings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_asset_mappings" ADD CONSTRAINT "entity_asset_mappings_managed_entity_fk" FOREIGN KEY ("entity_id","entity_type") REFERENCES "public"."managed_entities"("id","entity_type") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_asset_mappings" ADD CONSTRAINT "entity_asset_mappings_role_rule_fk" FOREIGN KEY ("entity_type","asset_role") REFERENCES "public"."entity_asset_role_rules"("entity_type","asset_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_character_reconciliations" ADD CONSTRAINT "preview_character_reconciliations_preview_entity_id_preview_characters_entity_id_fk" FOREIGN KEY ("preview_entity_id") REFERENCES "public"."preview_characters"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_character_reconciliations" ADD CONSTRAINT "preview_character_reconciliations_official_character_entity_id_characters_entity_id_fk" FOREIGN KEY ("official_character_entity_id") REFERENCES "public"."characters"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_character_reconciliations" ADD CONSTRAINT "preview_character_reconciliations_evaluated_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("evaluated_source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_character_reconciliations" ADD CONSTRAINT "preview_character_reconciliations_proposed_by_user_id_users_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_character_reconciliations" ADD CONSTRAINT "preview_character_reconciliations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_characters" ADD CONSTRAINT "preview_characters_entity_id_managed_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."managed_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_characters" ADD CONSTRAINT "preview_characters_reconciled_to_character_entity_id_characters_entity_id_fk" FOREIGN KEY ("reconciled_to_character_entity_id") REFERENCES "public"."characters"("entity_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_characters" ADD CONSTRAINT "preview_characters_reconciled_by_user_id_users_id_fk" FOREIGN KEY ("reconciled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_characters" ADD CONSTRAINT "preview_characters_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_characters" ADD CONSTRAINT "preview_characters_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_upload_intents_quarantine_key_unique" ON "asset_upload_intents" USING btree ("quarantine_object_key");--> statement-breakpoint
CREATE INDEX "asset_upload_intents_entity_status_idx" ON "asset_upload_intents" USING btree ("entity_id","status");--> statement-breakpoint
CREATE INDEX "asset_upload_intents_expires_at_idx" ON "asset_upload_intents" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "character_publication_states_public_key_unique" ON "character_publication_states" USING btree ("public_key");--> statement-breakpoint
CREATE INDEX "entity_asset_mappings_active_asset_idx" ON "entity_asset_mappings" USING btree ("active_asset_id");--> statement-breakpoint
CREATE INDEX "entity_asset_mappings_source_asset_idx" ON "entity_asset_mappings" USING btree ("source_asset_id") WHERE "entity_asset_mappings"."source_asset_id" is not null;--> statement-breakpoint
CREATE INDEX "entity_asset_mappings_type_role_idx" ON "entity_asset_mappings" USING btree ("entity_type","asset_role");--> statement-breakpoint
CREATE INDEX "preview_character_reconciliations_preview_proposed_idx" ON "preview_character_reconciliations" USING btree ("preview_entity_id","proposed_at");--> statement-breakpoint
CREATE INDEX "preview_character_reconciliations_official_proposed_idx" ON "preview_character_reconciliations" USING btree ("official_character_entity_id","proposed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "preview_character_reconciliations_confirmed_preview_unique" ON "preview_character_reconciliations" USING btree ("preview_entity_id") WHERE "preview_character_reconciliations"."status" = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX "preview_character_reconciliations_confirmed_official_unique" ON "preview_character_reconciliations" USING btree ("official_character_entity_id") WHERE "preview_character_reconciliations"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "preview_characters_claimed_raw_id_idx" ON "preview_characters" USING btree ("claimed_raw_id") WHERE "preview_characters"."claimed_raw_id" is not null;--> statement-breakpoint
CREATE INDEX "preview_characters_reconciled_to_character_idx" ON "preview_characters" USING btree ("reconciled_to_character_entity_id") WHERE "preview_characters"."reconciled_to_character_entity_id" is not null;--> statement-breakpoint
CREATE INDEX "preview_characters_updated_at_idx" ON "preview_characters" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "asset_objects" ADD CONSTRAINT "asset_objects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_objects" ADD CONSTRAINT "asset_objects_derived_from_asset_id_asset_objects_id_fk" FOREIGN KEY ("derived_from_asset_id") REFERENCES "public"."asset_objects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_objects_provenance_verification_idx" ON "asset_objects" USING btree ("provenance","verification_state");--> statement-breakpoint
CREATE INDEX "asset_objects_derived_from_asset_idx" ON "asset_objects" USING btree ("derived_from_asset_id");--> statement-breakpoint
ALTER TABLE "asset_objects" ADD CONSTRAINT "asset_objects_provenance_owner_check" CHECK ((
        ("asset_objects"."provenance" = 'source_extracted' and "asset_objects"."source_snapshot_id" is not null and "asset_objects"."created_by_user_id" is null)
        or
        ("asset_objects"."provenance" in ('manual_official', 'manual_preview', 'manual_placeholder') and "asset_objects"."source_snapshot_id" is null and "asset_objects"."created_by_user_id" is not null)
      ));--> statement-breakpoint
ALTER TABLE "asset_objects" ADD CONSTRAINT "asset_objects_private_original_url_check" CHECK ("asset_objects"."storage_tier" <> 'private_original' or "asset_objects"."public_url" is null);
--> statement-breakpoint
INSERT INTO "entity_asset_role_rules" ("entity_type", "asset_role", "allows_source", "allows_manual", "maximum_active_mappings")
VALUES
  ('character', 'avatar', true, true, 1),
  ('character', 'card', true, true, 1),
  ('character', 'drawing', true, true, 1),
  ('preview_character', 'avatar', false, true, 1),
  ('preview_character', 'card', false, true, 1),
  ('preview_character', 'drawing', false, true, 1);
--> statement-breakpoint
CREATE FUNCTION "prevent_unverified_entity_asset_mapping"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "asset_objects"
    WHERE "id" = NEW."active_asset_id"
      AND ("verification_state" <> 'verified' OR "storage_tier" = 'private_original')
  ) THEN
    RAISE EXCEPTION 'active entity asset mappings require a verified non-private asset'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "entity_asset_mappings_verified_active_asset_trigger"
BEFORE INSERT OR UPDATE OF "active_asset_id" ON "entity_asset_mappings"
FOR EACH ROW
EXECUTE FUNCTION "prevent_unverified_entity_asset_mapping"();
