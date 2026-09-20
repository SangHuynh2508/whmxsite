CREATE TYPE "public"."admin_account_audit_action" AS ENUM('bootstrap_owner', 'provisioned', 'role_changed', 'disabled', 'enabled');--> statement-breakpoint
CREATE TABLE "admin_account_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "admin_account_audit_action" NOT NULL,
	"actor_user_id" uuid,
	"subject_user_id" uuid NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_account_audits" ADD CONSTRAINT "admin_account_audits_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_account_audits" ADD CONSTRAINT "admin_account_audits_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_account_audits_subject_created_at_idx" ON "admin_account_audits" USING btree ("subject_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_account_audits_actor_created_at_idx" ON "admin_account_audits" USING btree ("actor_user_id","created_at");