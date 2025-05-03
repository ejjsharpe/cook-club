import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema';

// ─── Central recipes store ────────────────────────────────────────────────────
export const recipes = sqliteTable('recipes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceUrl: text('source_url').unique(),                    // URL if scraped, null if user input
    name: text('name').notNull(),
    description: text('description'),
    author: text('author'),
    datePublished: integer('date_published', { mode: 'timestamp' }), // optional timestamp
    prepTime: text('prep_time'),
    cookTime: text('cook_time'),
    totalTime: text('total_time'),
    recipeYield: text('recipe_yield'),
    recipeCategory: text('recipe_category'),
    recipeCuisine: text('recipe_cuisine'),
    keywords: text('keywords'),
    nutrition: text('nutrition'),
    scrapedAt: integer('scraped_at', { mode: 'timestamp' }),     // only for scraped recipes
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),                                               
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()                                               
  });
  
  // ─── Join table: which users have saved or uploaded recipes ─────────────────
  export const userRecipes = sqliteTable('user_recipes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()

  });
  
  // ─── Additional recipe detail tables ─────────────────────────────────────────
  export const recipeImages = sqliteTable('recipe_images', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
  });
  
  export const recipeIngredients = sqliteTable('recipe_ingredients', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    ingredient: text('ingredient').notNull(),
  });
  
  export const recipeInstructions = sqliteTable('recipe_instructions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    instruction: text('instruction').notNull(),
  });
  