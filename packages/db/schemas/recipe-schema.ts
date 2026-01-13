import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  index,
  boolean,
  numeric,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

// ─── Central recipes store ────────────────────────────────────────────────────
export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    description: text("description"),
    prepTime: integer("prep_time"), // minutes
    cookTime: integer("cook_time"), // minutes
    totalTime: integer("total_time"), // minutes
    servings: integer("servings"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),

    // properties for scraped recipes
    sourceUrl: text("source_url"),
    // Source type: "url" (scraped), "image" (OCR), "text" (pasted), "ai" (generated), "manual" (created), "user" (imported from another user)
    sourceType: text("source_type").notNull().default("manual"),

    // For recipes imported from another user
    originalRecipeId: integer("original_recipe_id").references(
      (): AnyPgColumn => recipes.id,
      { onDelete: "set null" }
    ),
    originalOwnerId: text("original_owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("recipes_owner_id_idx").on(table.ownerId),
    index("recipes_created_at_idx").on(table.createdAt),
    index("recipes_name_idx").on(table.name),
    // Full-text search index for recipe name queries
    index("recipes_name_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.name})`
    ),
  ]
);

// ─── Collections: user-created recipe collections ────────────────────────────
// defaultType: 'want_to_cook' | 'cooked' | null (for custom collections)
export const collections = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    defaultType: text("default_type"), // 'want_to_cook' | 'cooked' | null
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("collections_user_id_idx").on(table.userId),
    index("collections_user_id_created_at_idx").on(
      table.userId,
      table.createdAt.desc()
    ),
    // Ensure only one of each default type per user
    uniqueIndex("collections_user_default_type_unique_idx")
      .on(table.userId, table.defaultType)
      .where(sql`${table.defaultType} IS NOT NULL`),
  ]
);

// ─── Join table: which recipes are in which collections ──────────────────────
export const recipeCollections = pgTable(
  "recipe_collections",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("recipe_collections_recipe_id_idx").on(table.recipeId),
    index("recipe_collections_collection_id_idx").on(table.collectionId),
    index("recipe_collections_recipe_collection_idx").on(
      table.recipeId,
      table.collectionId
    ),
  ]
);

// ─── Additional recipe detail tables ─────────────────────────────────────────
export const recipeImages = pgTable(
  "recipe_images",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
  },
  (table) => [index("recipe_images_recipe_id_idx").on(table.recipeId)]
);

// ─── Section tables (normalized) ──────────────────────────────────────────────
export const ingredientSections = pgTable(
  "ingredient_sections",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    name: text("name"), // NULL = default section (no header displayed)
    index: integer("index").notNull(), // ordering
  },
  (table) => [
    index("ingredient_sections_recipe_id_idx").on(table.recipeId),
    index("ingredient_sections_recipe_id_index_idx").on(
      table.recipeId,
      table.index
    ),
  ]
);

export const instructionSections = pgTable(
  "instruction_sections",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    name: text("name"), // NULL = default section (no header displayed)
    index: integer("index").notNull(), // ordering
  },
  (table) => [
    index("instruction_sections_recipe_id_idx").on(table.recipeId),
    index("instruction_sections_recipe_id_index_idx").on(
      table.recipeId,
      table.index
    ),
  ]
);

// ─── Ingredient and instruction items ─────────────────────────────────────────
export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: serial("id").primaryKey(),
    sectionId: integer("section_id")
      .notNull()
      .references(() => ingredientSections.id, { onDelete: "cascade" }),
    index: integer("index").notNull(), // ordering within section
    quantity: numeric("quantity"),
    unit: text("unit"),
    name: text("name").notNull(),
  },
  (table) => [
    index("recipe_ingredients_section_id_idx").on(table.sectionId),
    index("recipe_ingredients_section_id_index_idx").on(
      table.sectionId,
      table.index
    ),
  ]
);

export const recipeInstructions = pgTable(
  "recipe_instructions",
  {
    id: serial("id").primaryKey(),
    sectionId: integer("section_id")
      .notNull()
      .references(() => instructionSections.id, { onDelete: "cascade" }),
    index: integer("index").notNull(), // ordering within section
    instruction: text("instruction").notNull(),
    imageUrl: text("image_url"),
  },
  (table) => [
    index("recipe_instructions_section_id_idx").on(table.sectionId),
    index("recipe_instructions_section_id_index_idx").on(
      table.sectionId,
      table.index
    ),
  ]
);

// ─── Tags system ─────────────────────────────────────────────────────────────
export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // e.g., "cuisine", "meal_type", "occasion"
    name: text("name").notNull(), // e.g., "Italian", "Breakfast", "Birthday Party"
  },
  (table) => [
    index("tags_type_idx").on(table.type),
    index("tags_type_name_idx").on(table.type, table.name),
  ]
);

export const recipeTags = pgTable(
  "recipe_tags",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("recipe_tags_recipe_id_idx").on(table.recipeId),
    index("recipe_tags_tag_id_idx").on(table.tagId),
  ]
);

// ─── Recipe nutrition (1:1 with recipes) ──────────────────────────────────────
export const recipeNutrition = pgTable(
  "recipe_nutrition",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),

    // Per serving values
    calories: integer("calories"), // kcal
    protein: numeric("protein", { precision: 6, scale: 2 }), // grams
    carbohydrates: numeric("carbohydrates", { precision: 6, scale: 2 }), // grams
    fat: numeric("fat", { precision: 6, scale: 2 }), // grams
    saturatedFat: numeric("saturated_fat", { precision: 6, scale: 2 }), // grams
    fiber: numeric("fiber", { precision: 6, scale: 2 }), // grams
    sugar: numeric("sugar", { precision: 6, scale: 2 }), // grams
    sodium: integer("sodium"), // mg

    // Optional extended nutrition
    cholesterol: integer("cholesterol"), // mg
    potassium: integer("potassium"), // mg
    vitaminA: integer("vitamin_a"), // % daily value
    vitaminC: integer("vitamin_c"), // % daily value
    calcium: integer("calcium"), // % daily value
    iron: integer("iron"), // % daily value
  },
  (table) => [
    uniqueIndex("recipe_nutrition_recipe_id_unique_idx").on(table.recipeId),
    index("recipe_nutrition_calories_idx").on(table.calories),
    index("recipe_nutrition_protein_idx").on(table.protein),
  ]
);
