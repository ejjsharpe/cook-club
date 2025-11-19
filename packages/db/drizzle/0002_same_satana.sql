CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"collection_id" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
DROP TABLE "user_recipes" CASCADE;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collections_user_id_created_at_idx" ON "collections" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_collections_recipe_id_idx" ON "recipe_collections" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_collections_collection_id_idx" ON "recipe_collections" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "recipe_collections_recipe_collection_idx" ON "recipe_collections" USING btree ("recipe_id","collection_id");