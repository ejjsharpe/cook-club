ALTER TABLE "recipes" ADD COLUMN "original_recipe_id" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "original_uploader_id" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_original_recipe_id_recipes_id_fk" FOREIGN KEY ("original_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_original_uploader_id_user_id_fk" FOREIGN KEY ("original_uploader_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;