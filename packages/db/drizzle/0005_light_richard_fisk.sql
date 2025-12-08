ALTER TABLE "recipe_ingredients" ADD COLUMN "quantity" numeric;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP COLUMN "ingredient";