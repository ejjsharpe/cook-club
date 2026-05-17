CREATE TABLE "subscription_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"adapty_profile_id" text,
	"adapty_customer_user_id" text,
	"access_level_id" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"will_renew" boolean,
	"expires_at" timestamp,
	"last_event_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_import_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "smart_import_usage_used_count_check" CHECK ("smart_import_usage"."used_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "adapty_webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text,
	"profile_id" text,
	"customer_user_id" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_import_usage" ADD CONSTRAINT "smart_import_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD COLUMN "confidence" text;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD COLUMN "generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD CONSTRAINT "recipe_nutrition_source_check" CHECK ("recipe_nutrition"."source" IN ('extracted', 'ai_estimated', 'manual', 'imported'));--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD CONSTRAINT "recipe_nutrition_confidence_check" CHECK ("recipe_nutrition"."confidence" IS NULL OR "recipe_nutrition"."confidence" IN ('high', 'medium', 'low'));--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_entitlements_user_id_unique_idx" ON "subscription_entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_adapty_profile_idx" ON "subscription_entitlements" USING btree ("adapty_profile_id");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_customer_user_idx" ON "subscription_entitlements" USING btree ("adapty_customer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_import_usage_user_period_unique_idx" ON "smart_import_usage" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "smart_import_usage_user_idx" ON "smart_import_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "adapty_webhook_events_customer_user_idx" ON "adapty_webhook_events" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "adapty_webhook_events_profile_idx" ON "adapty_webhook_events" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "adapty_webhook_events_received_at_idx" ON "adapty_webhook_events" USING btree ("received_at");
