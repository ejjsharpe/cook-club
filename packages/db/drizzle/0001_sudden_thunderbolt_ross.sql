CREATE TABLE "push_notification_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"push_token_id" integer NOT NULL,
	"expo_ticket_id" text,
	"status" text NOT NULL,
	"message" text,
	"details" jsonb,
	"receipt_status" text DEFAULT 'pending' NOT NULL,
	"receipt_checked_at" timestamp,
	"receipt_error" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "push_notification_tickets_status_check" CHECK ("push_notification_tickets"."status" IN ('ok', 'error')),
	CONSTRAINT "push_notification_tickets_receipt_status_check" CHECK ("push_notification_tickets"."receipt_status" IN ('pending', 'ok', 'error', 'unavailable'))
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expo_push_token" text NOT NULL,
	"platform" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"disabled_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "push_tokens_platform_check" CHECK ("push_tokens"."platform" IN ('ios', 'android', 'web'))
);
--> statement-breakpoint
ALTER TABLE "push_notification_tickets" ADD CONSTRAINT "push_notification_tickets_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notification_tickets" ADD CONSTRAINT "push_notification_tickets_push_token_id_push_tokens_id_fk" FOREIGN KEY ("push_token_id") REFERENCES "public"."push_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_notification_tickets_expo_ticket_id_unique" ON "push_notification_tickets" USING btree ("expo_ticket_id");--> statement-breakpoint
CREATE INDEX "push_notification_tickets_notification_idx" ON "push_notification_tickets" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "push_notification_tickets_receipt_idx" ON "push_notification_tickets" USING btree ("receipt_status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_expo_push_token_unique" ON "push_tokens" USING btree ("expo_push_token");--> statement-breakpoint
CREATE INDEX "push_tokens_user_enabled_idx" ON "push_tokens" USING btree ("user_id","enabled");