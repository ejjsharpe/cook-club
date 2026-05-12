CREATE TABLE "activity_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"recipe_id" integer,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "activity_events_type_check" CHECK ("activity_events"."type" IN ('recipe_import', 'cooking_review'))
);
--> statement-breakpoint
CREATE TABLE "activity_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activity_event_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "cooking_reviews_rating_check" CHECK ("cooking_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"username" text,
	"bio" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"measurement_preference" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username"),
	CONSTRAINT "user_measurement_preference_check" CHECK ("user"."measurement_preference" IS NULL OR "user"."measurement_preference" IN ('auto', 'metric', 'imperial'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
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
CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"default_type" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "collections_default_type_check" CHECK ("collections"."default_type" IS NULL OR "collections"."default_type" IN ('want_to_cook', 'cooked'))
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
CREATE TABLE "recipe_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"collection_id" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"index" integer NOT NULL,
	"quantity" numeric,
	"unit" text,
	"name" text NOT NULL,
	"preparation" text
);
--> statement-breakpoint
CREATE TABLE "recipe_instructions" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"index" integer NOT NULL,
	"instruction" text NOT NULL,
	"image_url" text
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
CREATE TABLE "recipe_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"description" text,
	"prep_time" integer,
	"cook_time" integer,
	"total_time" integer,
	"servings" integer,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"source_url" text,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"original_recipe_id" integer,
	"original_owner_id" text,
	CONSTRAINT "recipes_source_type_check" CHECK ("recipes"."source_type" IN ('url', 'image', 'text', 'ai', 'manual', 'user'))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_type_check" CHECK ("tags"."type" IN ('cuisine', 'category', 'dietary', 'meal_type', 'occasion'))
);
--> statement-breakpoint
CREATE TABLE "shopping_list_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopping_list_id" integer NOT NULL,
	"invited_user_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"inviter_name" text NOT NULL,
	"inviter_image" text,
	"shopping_list_name" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "shopping_list_invitations_status_check" CHECK ("shopping_list_invitations"."status" IN ('pending', 'accepted', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopping_list_id" integer NOT NULL,
	"ingredient_name" text NOT NULL,
	"display_name" text NOT NULL,
	"quantity" numeric,
	"unit" text,
	"is_checked" boolean DEFAULT false NOT NULL,
	"source_recipe_id" integer,
	"source_recipe_name" text,
	"aisle" text DEFAULT 'Other' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopping_list_id" integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"recipe_name" text NOT NULL,
	"recipe_image_url" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Shopping List' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
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
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "meal_plan_entries_meal_type_check" CHECK ("meal_plan_entries"."meal_type" IN ('breakfast', 'lunch', 'dinner'))
);
--> statement-breakpoint
CREATE TABLE "meal_plan_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"invited_user_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"inviter_name" text NOT NULL,
	"inviter_image" text,
	"meal_plan_name" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "meal_plan_invitations_status_check" CHECK ("meal_plan_invitations"."status" IN ('pending', 'accepted', 'declined'))
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
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"type" text NOT NULL,
	"activity_event_id" integer,
	"meal_plan_id" integer,
	"shopping_list_id" integer,
	"comment_id" integer,
	"actor_name" text NOT NULL,
	"actor_image" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" IN ('follow', 'meal_plan_share', 'meal_plan_invite', 'shopping_list_invite', 'activity_like', 'activity_comment', 'comment_reply'))
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_likes" ADD CONSTRAINT "activity_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_likes" ADD CONSTRAINT "activity_likes_activity_event_id_activity_events_id_fk" FOREIGN KEY ("activity_event_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking_review_images" ADD CONSTRAINT "cooking_review_images_review_id_cooking_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."cooking_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking_reviews" ADD CONSTRAINT "cooking_reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking_reviews" ADD CONSTRAINT "cooking_reviews_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking_reviews" ADD CONSTRAINT "cooking_reviews_activity_event_id_activity_events_id_fk" FOREIGN KEY ("activity_event_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_activity_event_id_activity_events_id_fk" FOREIGN KEY ("activity_event_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_user_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_sections" ADD CONSTRAINT "ingredient_sections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruction_sections" ADD CONSTRAINT "instruction_sections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_images" ADD CONSTRAINT "recipe_images_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_section_id_ingredient_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."ingredient_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_instructions" ADD CONSTRAINT "recipe_instructions_section_id_instruction_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."instruction_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD CONSTRAINT "recipe_nutrition_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_original_recipe_id_recipes_id_fk" FOREIGN KEY ("original_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_original_owner_id_user_id_fk" FOREIGN KEY ("original_owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_invitations" ADD CONSTRAINT "shopping_list_invitations_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_invitations" ADD CONSTRAINT "shopping_list_invitations_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_invitations" ADD CONSTRAINT "shopping_list_invitations_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_recipes" ADD CONSTRAINT "shopping_list_recipes_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_recipes" ADD CONSTRAINT "shopping_list_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_invitations" ADD CONSTRAINT "meal_plan_invitations_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_invitations" ADD CONSTRAINT "meal_plan_invitations_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_invitations" ADD CONSTRAINT "meal_plan_invitations_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_activity_event_id_activity_events_id_fk" FOREIGN KEY ("activity_event_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_user_id_idx" ON "activity_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_events_created_at_idx" ON "activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_events_user_created_idx" ON "activity_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_likes_activity_event_id_idx" ON "activity_likes" USING btree ("activity_event_id");--> statement-breakpoint
CREATE INDEX "activity_likes_user_id_idx" ON "activity_likes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_likes_user_activity_unique_idx" ON "activity_likes" USING btree ("user_id","activity_event_id");--> statement-breakpoint
CREATE INDEX "cooking_review_images_review_id_idx" ON "cooking_review_images" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "cooking_review_images_review_id_index_idx" ON "cooking_review_images" USING btree ("review_id","index");--> statement-breakpoint
CREATE INDEX "cooking_reviews_user_id_idx" ON "cooking_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cooking_reviews_recipe_id_idx" ON "cooking_reviews" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cooking_reviews_user_recipe_idx" ON "cooking_reviews" USING btree ("user_id","recipe_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "comments_activity_event_id_idx" ON "comments" USING btree ("activity_event_id");--> statement-breakpoint
CREATE INDEX "comments_parent_comment_id_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "follows_follower_id_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_id_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_follower_following_unique_idx" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collections_user_id_created_at_idx" ON "collections" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_default_type_unique_idx" ON "collections" USING btree ("user_id","default_type") WHERE "collections"."default_type" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ingredient_sections_recipe_id_idx" ON "ingredient_sections" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "ingredient_sections_recipe_id_index_idx" ON "ingredient_sections" USING btree ("recipe_id","index");--> statement-breakpoint
CREATE INDEX "instruction_sections_recipe_id_idx" ON "instruction_sections" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "instruction_sections_recipe_id_index_idx" ON "instruction_sections" USING btree ("recipe_id","index");--> statement-breakpoint
CREATE INDEX "recipe_collections_recipe_id_idx" ON "recipe_collections" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_collections_collection_id_idx" ON "recipe_collections" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_collections_recipe_collection_idx" ON "recipe_collections" USING btree ("recipe_id","collection_id");--> statement-breakpoint
CREATE INDEX "recipe_images_recipe_id_idx" ON "recipe_images" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_section_id_idx" ON "recipe_ingredients" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_section_id_index_idx" ON "recipe_ingredients" USING btree ("section_id","index");--> statement-breakpoint
CREATE INDEX "recipe_instructions_section_id_idx" ON "recipe_instructions" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "recipe_instructions_section_id_index_idx" ON "recipe_instructions" USING btree ("section_id","index");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_nutrition_recipe_id_unique_idx" ON "recipe_nutrition" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_nutrition_calories_idx" ON "recipe_nutrition" USING btree ("calories");--> statement-breakpoint
CREATE INDEX "recipe_nutrition_protein_idx" ON "recipe_nutrition" USING btree ("protein");--> statement-breakpoint
CREATE INDEX "recipe_tags_recipe_id_idx" ON "recipe_tags" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_tags_tag_id_idx" ON "recipe_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_tags_recipe_tag_idx" ON "recipe_tags" USING btree ("recipe_id","tag_id");--> statement-breakpoint
CREATE INDEX "recipes_owner_id_idx" ON "recipes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recipes_created_at_idx" ON "recipes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "recipes_name_idx" ON "recipes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "recipes_name_search_idx" ON "recipes" USING gin (to_tsvector('english', "name"));--> statement-breakpoint
CREATE INDEX "tags_type_idx" ON "tags" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_type_name_idx" ON "tags" USING btree ("type","name");--> statement-breakpoint
CREATE INDEX "shopping_list_invitations_invited_user_idx" ON "shopping_list_invitations" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "shopping_list_invitations_list_id_idx" ON "shopping_list_invitations" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE INDEX "shopping_list_invitations_user_status_idx" ON "shopping_list_invitations" USING btree ("invited_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_list_invitations_unique_idx" ON "shopping_list_invitations" USING btree ("shopping_list_id","invited_user_id");--> statement-breakpoint
CREATE INDEX "shopping_list_items_shopping_list_id_idx" ON "shopping_list_items" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE INDEX "shopping_list_items_is_checked_idx" ON "shopping_list_items" USING btree ("is_checked");--> statement-breakpoint
CREATE INDEX "shopping_list_items_shopping_list_ingredient_idx" ON "shopping_list_items" USING btree ("shopping_list_id","ingredient_name");--> statement-breakpoint
CREATE INDEX "shopping_list_items_source_recipe_idx" ON "shopping_list_items" USING btree ("source_recipe_id");--> statement-breakpoint
CREATE INDEX "shopping_list_items_aisle_idx" ON "shopping_list_items" USING btree ("aisle");--> statement-breakpoint
CREATE INDEX "shopping_list_recipes_shopping_list_id_idx" ON "shopping_list_recipes" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE INDEX "shopping_list_recipes_recipe_id_idx" ON "shopping_list_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_list_recipes_shopping_list_recipe_idx" ON "shopping_list_recipes" USING btree ("shopping_list_id","recipe_id");--> statement-breakpoint
CREATE INDEX "shopping_lists_user_id_idx" ON "shopping_lists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_lists_one_default_per_user_idx" ON "shopping_lists" USING btree ("user_id") WHERE "shopping_lists"."is_default" = true;--> statement-breakpoint
CREATE INDEX "meal_plan_entries_meal_plan_id_idx" ON "meal_plan_entries" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX "meal_plan_entries_meal_plan_date_idx" ON "meal_plan_entries" USING btree ("meal_plan_id","date");--> statement-breakpoint
CREATE INDEX "meal_plan_entries_recipe_id_idx" ON "meal_plan_entries" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plan_entries_unique_slot_idx" ON "meal_plan_entries" USING btree ("meal_plan_id","date","meal_type");--> statement-breakpoint
CREATE INDEX "meal_plan_invitations_invited_user_idx" ON "meal_plan_invitations" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "meal_plan_invitations_meal_plan_id_idx" ON "meal_plan_invitations" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX "meal_plan_invitations_user_status_idx" ON "meal_plan_invitations" USING btree ("invited_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plan_invitations_unique_idx" ON "meal_plan_invitations" USING btree ("meal_plan_id","invited_user_id");--> statement-breakpoint
CREATE INDEX "meal_plans_user_id_idx" ON "meal_plans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plans_one_default_per_user_idx" ON "meal_plans" USING btree ("user_id") WHERE "meal_plans"."is_default" = true;--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_id","is_read");