import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  date,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { recipes } from "./recipe-schema";

// ─── Meal Plans: multiple per user (personal + shared) ─────────────────────────
export const mealPlans = pgTable(
  "meal_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Marks user's primary personal plan (enforced in app code - one default per user)
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    // Index for listing user's plans (no unique - allows multiple)
    index("meal_plans_user_id_idx").on(table.userId),
  ]
);

// ─── Meal Plan Entries: recipe assignments to breakfast/lunch/dinner slots ─────
export const mealPlanEntries = pgTable(
  "meal_plan_entries",
  {
    id: serial("id").primaryKey(),
    mealPlanId: integer("meal_plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    // Date for the meal (stores just date, no time)
    date: date("date").notNull(),
    // Meal type: breakfast, lunch, or dinner
    mealType: text("meal_type").notNull(), // "breakfast" | "lunch" | "dinner"
    // Reference to the recipe
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    // Cached recipe data for fast queries (avoids joins)
    recipeName: text("recipe_name").notNull(),
    recipeImageUrl: text("recipe_image_url"),
    // Metadata
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    // Index for querying entries by meal plan
    index("meal_plan_entries_meal_plan_id_idx").on(table.mealPlanId),
    // Index for querying entries by date range (common query pattern)
    index("meal_plan_entries_meal_plan_date_idx").on(
      table.mealPlanId,
      table.date
    ),
    // Index for finding entries by recipe (for cascade-like operations)
    index("meal_plan_entries_recipe_id_idx").on(table.recipeId),
    // Unique constraint: one recipe per meal slot per day
    uniqueIndex("meal_plan_entries_unique_slot_idx").on(
      table.mealPlanId,
      table.date,
      table.mealType
    ),
  ]
);

// ─── Shared Meal Plans: sharing calendars with friends ─────────────────────────
export const mealPlanShares = pgTable(
  "meal_plan_shares",
  {
    id: serial("id").primaryKey(),
    mealPlanId: integer("meal_plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    // User who is granted access to the meal plan
    sharedWithUserId: text("shared_with_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Whether shared user can add/remove entries
    canEdit: boolean("can_edit").notNull().default(false),
    // Cached owner info for efficient "shared with me" queries
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ownerName: text("owner_name").notNull(),
    ownerImage: text("owner_image"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    // Index for finding all plans shared with a user
    index("meal_plan_shares_shared_with_idx").on(table.sharedWithUserId),
    // Index for finding all shares of a meal plan
    index("meal_plan_shares_meal_plan_id_idx").on(table.mealPlanId),
    // Unique: prevent duplicate shares
    uniqueIndex("meal_plan_shares_unique_idx").on(
      table.mealPlanId,
      table.sharedWithUserId
    ),
  ]
);
