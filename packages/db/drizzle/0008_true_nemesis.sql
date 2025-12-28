ALTER TABLE "recipes" RENAME COLUMN "uploaded_by" TO "owner_id";--> statement-breakpoint
ALTER TABLE "recipes" RENAME COLUMN "original_uploader_id" TO "original_owner_id";--> statement-breakpoint
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_original_uploader_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "recipes_uploaded_by_idx";--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_original_owner_id_user_id_fk" FOREIGN KEY ("original_owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipes_owner_id_idx" ON "recipes" USING btree ("owner_id");