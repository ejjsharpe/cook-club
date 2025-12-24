ALTER TABLE "user" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cuisine_likes" integer[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cuisine_dislikes" integer[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ingredient_likes" integer[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ingredient_dislikes" integer[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "dietary_requirements" integer[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;