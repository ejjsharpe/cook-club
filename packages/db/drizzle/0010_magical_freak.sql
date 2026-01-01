ALTER TABLE "shopping_list_items" ADD COLUMN "aisle" text DEFAULT 'Other' NOT NULL;--> statement-breakpoint
CREATE INDEX "shopping_list_items_aisle_idx" ON "shopping_list_items" USING btree ("aisle");