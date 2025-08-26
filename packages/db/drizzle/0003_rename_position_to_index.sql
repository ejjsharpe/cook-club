-- Rename position column to index in recipe_ingredients table
ALTER TABLE recipe_ingredients RENAME COLUMN position TO `index`;

-- Rename position column to index in recipe_instructions table  
ALTER TABLE recipe_instructions RENAME COLUMN position TO `index`;