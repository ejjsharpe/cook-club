CREATE TABLE "activity_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activity_event_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activity_event_id" integer NOT NULL,
	"parent_comment_id" integer,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"name" text,
	"index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruction_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"name" text,
	"index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_nutrition" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"calories" integer,
	"protein" numeric(6, 2),
	"carbohydrates" numeric(6, 2),
	"fat" numeric(6, 2),
	"saturated_fat" numeric(6, 2),
	"fiber" numeric(6, 2),
	"sugar" numeric(6, 2),
	"sodium" integer,
	"cholesterol" integer,
	"potassium" integer,
	"vitamin_a" integer,
	"vitamin_c" integer,
	"calcium" integer,
	"iron" integer
);
--> statement-breakpoint
CREATE TABLE "user_tag_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tag_id" integer NOT NULL,
	"preference_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"date" date NOT NULL,
	"meal_type" text NOT NULL,
	"recipe_id" integer NOT NULL,
	"recipe_name" text NOT NULL,
	"recipe_image_url" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"shared_with_user_id" text NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"owner_user_id" text NOT NULL,
	"owner_name" text NOT NULL,
	"owner_image" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk";
--> statement-breakpoint
ALTER TABLE "recipe_instructions" DROP CONSTRAINT "recipe_instructions_recipe_id_recipes_id_fk";
--> statement-breakpoint
DROP INDEX "collections_user_default_unique_idx";--> statement-breakpoint
DROP INDEX "recipe_ingredients_recipe_id_idx";--> statement-breakpoint
DROP INDEX "recipe_ingredients_recipe_id_index_idx";--> statement-breakpoint
DROP INDEX "recipe_instructions_recipe_id_idx";--> statement-breakpoint
DROP INDEX "recipe_instructions_recipe_id_index_idx";--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "comment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "default_type" text;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "section_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_instructions" ADD COLUMN "section_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_likes" ADD CONSTRAINT "activity_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_likes" ADD CONSTRAINT "activity_likes_activity_event_id_activity_events_id_fk" FOREIGN KEY ("activity_event_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_activity_event_id_activity_events_id_fk" FOREIGN KEY ("activity_event_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_sections" ADD CONSTRAINT "ingredient_sections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruction_sections" ADD CONSTRAINT "instruction_sections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD CONSTRAINT "recipe_nutrition_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tag_preferences" ADD CONSTRAINT "user_tag_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tag_preferences" ADD CONSTRAINT "user_tag_preferences_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_shares" ADD CONSTRAINT "meal_plan_shares_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_shares" ADD CONSTRAINT "meal_plan_shares_shared_with_user_id_user_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_shares" ADD CONSTRAINT "meal_plan_shares_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_likes_activity_event_id_idx" ON "activity_likes" USING btree ("activity_event_id");--> statement-breakpoint
CREATE INDEX "activity_likes_user_id_idx" ON "activity_likes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_likes_user_activity_unique_idx" ON "activity_likes" USING btree ("user_id","activity_event_id");--> statement-breakpoint
CREATE INDEX "comments_activity_event_id_idx" ON "comments" USING btree ("activity_event_id");--> statement-breakpoint
CREATE INDEX "comments_parent_comment_id_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ingredient_sections_recipe_id_idx" ON "ingredient_sections" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "ingredient_sections_recipe_id_index_idx" ON "ingredient_sections" USING btree ("recipe_id","index");--> statement-breakpoint
CREATE INDEX "instruction_sections_recipe_id_idx" ON "instruction_sections" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "instruction_sections_recipe_id_index_idx" ON "instruction_sections" USING btree ("recipe_id","index");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_nutrition_recipe_id_unique_idx" ON "recipe_nutrition" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_nutrition_calories_idx" ON "recipe_nutrition" USING btree ("calories");--> statement-breakpoint
CREATE INDEX "recipe_nutrition_protein_idx" ON "recipe_nutrition" USING btree ("protein");--> statement-breakpoint
CREATE INDEX "user_tag_preferences_user_id_idx" ON "user_tag_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_tag_preferences_tag_id_idx" ON "user_tag_preferences" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "user_tag_preferences_user_type_idx" ON "user_tag_preferences" USING btree ("user_id","preference_type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tag_preferences_user_tag_type_idx" ON "user_tag_preferences" USING btree ("user_id","tag_id","preference_type");--> statement-breakpoint
CREATE INDEX "meal_plan_entries_meal_plan_id_idx" ON "meal_plan_entries" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX "meal_plan_entries_meal_plan_date_idx" ON "meal_plan_entries" USING btree ("meal_plan_id","date");--> statement-breakpoint
CREATE INDEX "meal_plan_entries_recipe_id_idx" ON "meal_plan_entries" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plan_entries_unique_slot_idx" ON "meal_plan_entries" USING btree ("meal_plan_id","date","meal_type");--> statement-breakpoint
CREATE INDEX "meal_plan_shares_shared_with_idx" ON "meal_plan_shares" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE INDEX "meal_plan_shares_meal_plan_id_idx" ON "meal_plan_shares" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plan_shares_unique_idx" ON "meal_plan_shares" USING btree ("meal_plan_id","shared_with_user_id");--> statement-breakpoint
CREATE INDEX "meal_plans_user_id_idx" ON "meal_plans" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_section_id_ingredient_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."ingredient_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_instructions" ADD CONSTRAINT "recipe_instructions_section_id_instruction_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."instruction_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "follows_follower_id_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_id_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_follower_following_unique_idx" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_default_type_unique_idx" ON "collections" USING btree ("user_id","default_type") WHERE "collections"."default_type" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "recipe_ingredients_section_id_idx" ON "recipe_ingredients" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_section_id_index_idx" ON "recipe_ingredients" USING btree ("section_id","index");--> statement-breakpoint
CREATE INDEX "recipe_instructions_section_id_idx" ON "recipe_instructions" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "recipe_instructions_section_id_index_idx" ON "recipe_instructions" USING btree ("section_id","index");--> statement-breakpoint
CREATE INDEX "recipes_name_search_idx" ON "recipes" USING gin (to_tsvector('english', "name"));--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "cuisine_likes";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "cuisine_dislikes";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ingredient_likes";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ingredient_dislikes";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "dietary_requirements";--> statement-breakpoint
ALTER TABLE "collections" DROP COLUMN "is_default";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP COLUMN "recipe_id";--> statement-breakpoint
ALTER TABLE "recipe_instructions" DROP COLUMN "recipe_id";--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "nutrition";