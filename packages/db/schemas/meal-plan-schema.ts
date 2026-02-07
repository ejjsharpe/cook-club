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

// ─── Meal Plan Invitations: invitation-based sharing with friends ─────────────
// Pending invitations expire after 7 days. Accepted invitations represent active access.
export const mealPlanInvitations = pgTable(
  "meal_plan_invitations",
  {
    id: serial("id").primaryKey(),
    mealPlanId: integer("meal_plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    // User who is being invited
    invitedUserId: text("invited_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // User who sent the invitation (owner)
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "pending" = awaiting response, "accepted" = user has access
    status: text("status").notNull().default("pending"),
    // Denormalized inviter info for efficient "shared with me" queries
    inviterName: text("inviter_name").notNull(),
    inviterImage: text("inviter_image"),
    // Denormalized meal plan name for display in banners/notifications
    mealPlanName: text("meal_plan_name").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    // Index for finding all invitations for a user
    index("meal_plan_invitations_invited_user_idx").on(table.invitedUserId),
    // Index for finding all invitations for a meal plan
    index("meal_plan_invitations_meal_plan_id_idx").on(table.mealPlanId),
    // Composite index for access control checks
    index("meal_plan_invitations_user_status_idx").on(
      table.invitedUserId,
      table.status
    ),
    // Unique: prevent duplicate invitations
    uniqueIndex("meal_plan_invitations_unique_idx").on(
      table.mealPlanId,
      table.invitedUserId
    ),
  ]
);
