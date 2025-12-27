CREATE TABLE "activity_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"recipe_id" integer,
	"batch_import_count" integer,
	"batch_import_source" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cooking_review_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"url" text NOT NULL,
	"index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cooking_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" integer NOT NULL,
	"activity_event_id" integer,
	"rating" integer NOT NULL,
	"review_text" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking_review_images" ADD CONSTRAINT "cooking_review_images_review_id_cooking_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."cooking_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking_reviews" ADD CONSTRAINT "cooking_reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking_reviews" ADD CONSTRAINT "cooking_reviews_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking_reviews" ADD CONSTRAINT "cooking_reviews_activity_event_id_activity_events_id_fk" FOREIGN KEY ("activity_event_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_user_id_idx" ON "activity_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_events_created_at_idx" ON "activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_events_user_created_idx" ON "activity_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cooking_review_images_review_id_idx" ON "cooking_review_images" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "cooking_review_images_review_id_index_idx" ON "cooking_review_images" USING btree ("review_id","index");--> statement-breakpoint
CREATE INDEX "cooking_reviews_user_id_idx" ON "cooking_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cooking_reviews_recipe_id_idx" ON "cooking_reviews" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "cooking_reviews_user_recipe_idx" ON "cooking_reviews" USING btree ("user_id","recipe_id");