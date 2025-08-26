DROP INDEX `recipes_source_url_unique`;--> statement-breakpoint
ALTER TABLE `recipes` ADD `uploaded_by` text NOT NULL;