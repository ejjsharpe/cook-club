CREATE TABLE "shopping_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopping_list_id" integer NOT NULL,
	"ingredient_name" text NOT NULL,
	"quantity" numeric,
	"unit" text,
	"display_text" text NOT NULL,
	"is_checked" boolean DEFAULT false NOT NULL,
	"source_recipe_ids" text,
	"source_recipe_names" text,
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
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_recipes" ADD CONSTRAINT "shopping_list_recipes_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_recipes" ADD CONSTRAINT "shopping_list_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_list_items_shopping_list_id_idx" ON "shopping_list_items" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE INDEX "shopping_list_items_is_checked_idx" ON "shopping_list_items" USING btree ("is_checked");--> statement-breakpoint
CREATE INDEX "shopping_list_items_shopping_list_ingredient_idx" ON "shopping_list_items" USING btree ("shopping_list_id","ingredient_name");--> statement-breakpoint
CREATE INDEX "shopping_list_recipes_shopping_list_id_idx" ON "shopping_list_recipes" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE INDEX "shopping_list_recipes_recipe_id_idx" ON "shopping_list_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "shopping_list_recipes_shopping_list_recipe_idx" ON "shopping_list_recipes" USING btree ("shopping_list_id","recipe_id");--> statement-breakpoint
CREATE INDEX "shopping_lists_user_id_idx" ON "shopping_lists" USING btree ("user_id");