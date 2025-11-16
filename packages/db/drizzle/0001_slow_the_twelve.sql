CREATE TABLE "user_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_likes" ADD CONSTRAINT "user_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_likes" ADD CONSTRAINT "user_likes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_likes_user_id_idx" ON "user_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_likes_recipe_id_idx" ON "user_likes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "user_likes_user_recipe_idx" ON "user_likes" USING btree ("user_id","recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_images_recipe_id_idx" ON "recipe_images" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_id_index_idx" ON "recipe_ingredients" USING btree ("recipe_id","index");--> statement-breakpoint
CREATE INDEX "recipe_instructions_recipe_id_idx" ON "recipe_instructions" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_instructions_recipe_id_index_idx" ON "recipe_instructions" USING btree ("recipe_id","index");--> statement-breakpoint
CREATE INDEX "recipe_tags_recipe_id_idx" ON "recipe_tags" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_tags_tag_id_idx" ON "recipe_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "recipes_uploaded_by_idx" ON "recipes" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "recipes_created_at_idx" ON "recipes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "recipes_name_idx" ON "recipes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tags_type_idx" ON "tags" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tags_type_name_idx" ON "tags" USING btree ("type","name");--> statement-breakpoint
CREATE INDEX "user_recipes_user_id_idx" ON "user_recipes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_recipes_recipe_id_idx" ON "user_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "user_recipes_created_at_idx" ON "user_recipes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_recipes_user_id_created_at_idx" ON "user_recipes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_recipes_user_recipe_idx" ON "user_recipes" USING btree ("user_id","recipe_id");