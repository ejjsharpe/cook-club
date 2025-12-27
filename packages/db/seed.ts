import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "./schemas";
import { users as userData } from "./data/users";
import { recipes as recipeData } from "./data/recipes";
import * as readline from "readline";
import { hashPassword } from "better-auth/crypto";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function randomDate(daysAgo: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const randomTime =
    past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(randomTime);
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

// Parse ingredient text to extract quantity, unit, and name
interface ParsedIngredient {
  quantity: string | null;
  unit: string | null;
  name: string;
}

function parseIngredient(ingredientText: string): ParsedIngredient {
  if (!ingredientText || typeof ingredientText !== "string") {
    return { quantity: null, unit: null, name: ingredientText || "" };
  }

  const match = ingredientText.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*([a-zA-Z]*)\s+(.+)$/
  );

  if (match) {
    const quantityStr = match[1];
    const unit = match[2]?.trim() || null;
    const name = match[3]?.trim() || ingredientText;

    let quantity: string | null = null;
    if (quantityStr) {
      if (quantityStr.includes("/")) {
        if (quantityStr.includes(" ")) {
          const [whole, fraction] = quantityStr.split(" ");
          if (whole && fraction) {
            const [numerator, denominator] = fraction.split("/");
            if (numerator && denominator) {
              quantity = String(
                parseInt(whole) +
                  parseInt(numerator) / parseInt(denominator)
              );
            }
          }
        } else {
          const [numerator, denominator] = quantityStr.split("/");
          if (numerator && denominator) {
            quantity = String(parseInt(numerator) / parseInt(denominator));
          }
        }
      } else {
        quantity = quantityStr;
      }
    }

    return { quantity, unit, name };
  }

  return { quantity: null, unit: null, name: ingredientText };
}

// ─── Database Operations ──────────────────────────────────────────────────────

type DbClient = ReturnType<typeof drizzle>;

async function clearDatabase(db: DbClient) {
  console.log("🗑️  Clearing existing data...");

  // Delete in order respecting foreign keys
  await db.delete(schema.cookingReviewImages);
  await db.delete(schema.cookingReviews);
  await db.delete(schema.activityEvents);
  await db.delete(schema.follows);
  await db.delete(schema.recipeCollections);
  await db.delete(schema.collections);
  await db.delete(schema.recipeTags);
  await db.delete(schema.recipeInstructions);
  await db.delete(schema.recipeIngredients);
  await db.delete(schema.recipeImages);
  await db.delete(schema.recipes);
  await db.delete(schema.tags);
  await db.delete(schema.verification);
  await db.delete(schema.session);
  await db.delete(schema.account);
  await db.delete(schema.user);

  console.log("✅ Database cleared");
}

async function seedTags(db: DbClient) {
  console.log("🏷️  Seeding tags...");

  const cuisineNames = [
    "Italian", "Mexican", "Chinese", "Japanese", "Thai", "Indian",
    "French", "American", "Mediterranean", "Korean", "Vietnamese",
    "Greek", "Spanish", "Middle Eastern",
  ];

  const categoryNames = [
    "Breakfast", "Lunch", "Dinner", "Dessert", "Snack", "Appetizer",
    "Main Course", "Side Dish", "Salad", "Soup", "Beverage", "Baking",
  ];

  const dietaryNames = [
    "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Nut-Free",
    "Keto", "Paleo", "Low-Carb",
  ];

  const cuisineTags = await db
    .insert(schema.tags)
    .values(cuisineNames.map((name) => ({ type: "cuisine", name })))
    .returning();

  const categoryTags = await db
    .insert(schema.tags)
    .values(categoryNames.map((name) => ({ type: "category", name })))
    .returning();

  const dietaryTags = await db
    .insert(schema.tags)
    .values(dietaryNames.map((name) => ({ type: "dietary", name })))
    .returning();

  console.log(
    `✅ Seeded ${cuisineTags.length} cuisines, ${categoryTags.length} categories, ${dietaryTags.length} dietary`
  );

  return { cuisineTags, categoryTags, dietaryTags };
}

async function seedUsers(db: DbClient) {
  console.log("👥 Seeding users...");

  const users: (typeof schema.user.$inferSelect)[] = [];

  for (const u of userData) {
    const createdAt = randomDate(90);
    const hashedPassword = await hashPassword(u.password);

    const [user] = await db
      .insert(schema.user)
      .values({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        image: u.image,
        createdAt,
        updatedAt: createdAt,
        onboardingCompleted: true,
      })
      .returning();

    if (user) {
      await db.insert(schema.account).values({
        id: `account_${u.id}`,
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: hashedPassword,
        createdAt,
        updatedAt: createdAt,
      });

      users.push(user);
    }
  }

  console.log(`✅ Seeded ${users.length} users`);
  return users;
}

async function seedRecipes(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[],
  allTags: (typeof schema.tags.$inferSelect)[]
) {
  console.log("🍳 Seeding recipes...");

  const recipes: (typeof schema.recipes.$inferSelect)[] = [];
  const shuffledUsers = shuffle(users);
  let userIndex = 0;

  for (const r of recipeData) {
    const user = shuffledUsers[userIndex % shuffledUsers.length]!;
    userIndex++;

    const createdAt = randomDate(60);

    // Create the recipe
    const [recipe] = await db
      .insert(schema.recipes)
      .values({
        name: r.name,
        description: r.description,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        totalTime: r.totalTime,
        servings: r.servings,
        uploadedBy: user.id,
        sourceUrl: r.sourceUrl || null,
        sourceType: r.sourceUrl ? "url" : "manual",
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    if (!recipe) continue;
    recipes.push(recipe);

    // Add image
    await db.insert(schema.recipeImages).values({
      recipeId: recipe.id,
      url: r.imageUrl,
    });

    // Add ingredients
    for (let i = 0; i < r.ingredients.length; i++) {
      const parsed = parseIngredient(r.ingredients[i]!);
      await db.insert(schema.recipeIngredients).values({
        recipeId: recipe.id,
        index: i,
        quantity: parsed.quantity,
        unit: parsed.unit,
        name: parsed.name,
      });
    }

    // Add instructions
    for (let i = 0; i < r.instructions.length; i++) {
      await db.insert(schema.recipeInstructions).values({
        recipeId: recipe.id,
        index: i,
        instruction: r.instructions[i]!,
      });
    }

    // Add tags
    const cuisineTagsToAdd = allTags.filter(
      (t) => t.type === "cuisine" && r.cuisines.includes(t.name)
    );
    const categoryTagsToAdd = allTags.filter(
      (t) => t.type === "category" && r.categories.includes(t.name)
    );

    for (const tag of [...cuisineTagsToAdd, ...categoryTagsToAdd]) {
      await db.insert(schema.recipeTags).values({
        recipeId: recipe.id,
        tagId: tag.id,
      });
    }
  }

  console.log(`✅ Seeded ${recipes.length} recipes`);
  return recipes;
}

async function seedCollections(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[]
) {
  console.log("📚 Seeding collections...");

  const collections = await db
    .insert(schema.collections)
    .values(
      users.map((user) => ({
        userId: user.id,
        name: "Saved Recipes",
        isDefault: true,
        createdAt: user.createdAt,
        updatedAt: new Date(),
      }))
    )
    .returning();

  console.log(`✅ Seeded ${collections.length} default collections`);
  return collections;
}

async function seedFollows(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[]
) {
  console.log("👥 Seeding follow relationships...");

  let followsCount = 0;

  for (const user of users) {
    const otherUsers = users.filter((u) => u.id !== user.id);
    const usersToFollow = shuffle(otherUsers).slice(0, randomInt(2, 5));

    for (const userToFollow of usersToFollow) {
      await db.insert(schema.follows).values({
        followerId: user.id,
        followingId: userToFollow.id,
        createdAt: randomDate(60),
      });
      followsCount++;
    }
  }

  console.log(`✅ Seeded ${followsCount} follow relationships`);
}

async function seedImportedRecipes(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[],
  originalRecipes: (typeof schema.recipes.$inferSelect)[],
  collections: (typeof schema.collections.$inferSelect)[]
) {
  console.log("📥 Seeding imported recipes...");

  const importedRecipes: (typeof schema.recipes.$inferSelect)[] = [];

  for (const user of users) {
    // Get recipes from other users
    const otherRecipes = originalRecipes.filter((r) => r.uploadedBy !== user.id);
    const recipesToImport = shuffle(otherRecipes).slice(0, randomInt(2, 4));
    const userCollection = collections.find((c) => c.userId === user.id);

    for (const sourceRecipe of recipesToImport) {
      const importedAt = randomDate(30);

      // Create imported recipe copy
      const [importedRecipe] = await db
        .insert(schema.recipes)
        .values({
          name: sourceRecipe.name,
          description: sourceRecipe.description,
          prepTime: sourceRecipe.prepTime,
          cookTime: sourceRecipe.cookTime,
          totalTime: sourceRecipe.totalTime,
          servings: sourceRecipe.servings,
          nutrition: sourceRecipe.nutrition,
          sourceUrl: null,
          sourceType: "user",
          originalRecipeId: sourceRecipe.id,
          originalUploaderId: sourceRecipe.uploadedBy,
          uploadedBy: user.id,
          createdAt: importedAt,
          updatedAt: importedAt,
        })
        .returning();

      if (!importedRecipe) continue;
      importedRecipes.push(importedRecipe);

      // Copy images
      const sourceImages = await db
        .select()
        .from(schema.recipeImages)
        .where(eq(schema.recipeImages.recipeId, sourceRecipe.id));

      for (const img of sourceImages) {
        await db.insert(schema.recipeImages).values({
          recipeId: importedRecipe.id,
          url: img.url,
        });
      }

      // Copy ingredients
      const sourceIngredients = await db
        .select()
        .from(schema.recipeIngredients)
        .where(eq(schema.recipeIngredients.recipeId, sourceRecipe.id));

      for (const ing of sourceIngredients) {
        await db.insert(schema.recipeIngredients).values({
          recipeId: importedRecipe.id,
          index: ing.index,
          quantity: ing.quantity,
          unit: ing.unit,
          name: ing.name,
        });
      }

      // Copy instructions
      const sourceInstructions = await db
        .select()
        .from(schema.recipeInstructions)
        .where(eq(schema.recipeInstructions.recipeId, sourceRecipe.id));

      for (const inst of sourceInstructions) {
        await db.insert(schema.recipeInstructions).values({
          recipeId: importedRecipe.id,
          index: inst.index,
          instruction: inst.instruction,
          imageUrl: inst.imageUrl,
        });
      }

      // Copy tags
      const sourceTags = await db
        .select()
        .from(schema.recipeTags)
        .where(eq(schema.recipeTags.recipeId, sourceRecipe.id));

      for (const tag of sourceTags) {
        await db.insert(schema.recipeTags).values({
          recipeId: importedRecipe.id,
          tagId: tag.tagId,
        });
      }

      // Add to user's default collection
      if (userCollection) {
        await db.insert(schema.recipeCollections).values({
          recipeId: importedRecipe.id,
          collectionId: userCollection.id,
          createdAt: importedAt,
        });
      }
    }
  }

  console.log(`✅ Seeded ${importedRecipes.length} imported recipes`);
  return importedRecipes;
}

async function seedActivityFeed(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[],
  allRecipes: (typeof schema.recipes.$inferSelect)[]
) {
  console.log("📰 Seeding activity feed...");

  let importEventCount = 0;
  let reviewCount = 0;

  // Create activity events for all recipe imports
  for (const recipe of allRecipes) {
    await db.insert(schema.activityEvents).values({
      userId: recipe.uploadedBy,
      type: "recipe_import",
      recipeId: recipe.id,
      createdAt: recipe.createdAt,
    });
    importEventCount++;
  }

  // Sample review texts
  const reviewTexts = [
    "Made this for dinner tonight and it was delicious!",
    "Super easy to follow and turned out great.",
    "This has become a weeknight staple. So quick and tasty!",
    "The flavors were incredible. Restaurant quality at home!",
    "Kids approved! That's the ultimate test.",
    "Perfect comfort food.",
    "Made this for a dinner party and got so many compliments.",
    "Finally found a recipe that works every time!",
    null, // Some reviews are rating-only
  ];

  // Create cooking reviews
  for (const user of users) {
    // Each user reviews 1-3 recipes they own
    const userRecipes = allRecipes.filter((r) => r.uploadedBy === user.id);
    const recipesToReview = shuffle(userRecipes).slice(0, randomInt(1, 3));

    for (const recipe of recipesToReview) {
      const reviewCreatedAt = randomDate(20);
      const rating = randomInt(3, 5);
      const reviewText = randomChoice(reviewTexts);

      const [activityEvent] = await db
        .insert(schema.activityEvents)
        .values({
          userId: user.id,
          type: "cooking_review",
          recipeId: recipe.id,
          createdAt: reviewCreatedAt,
        })
        .returning();

      if (!activityEvent) continue;

      await db.insert(schema.cookingReviews).values({
        userId: user.id,
        recipeId: recipe.id,
        activityEventId: activityEvent.id,
        rating,
        reviewText,
        createdAt: reviewCreatedAt,
        updatedAt: reviewCreatedAt,
      });

      reviewCount++;
    }
  }

  console.log(
    `✅ Seeded ${importEventCount} import events, ${reviewCount} cooking reviews`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🌱 Starting database seed...\n");

  const sql = neon(DATABASE_URL);
  const db = drizzle(sql, { schema });

  try {
    const answer = await question(
      "⚠️  Do you want to clear existing data before seeding? (yes/no): "
    );

    if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
      await clearDatabase(db);
      console.log("");
    }

    // Seed data
    const { cuisineTags, categoryTags, dietaryTags } = await seedTags(db);
    const allTags = [...cuisineTags, ...categoryTags, ...dietaryTags];
    console.log("");

    const users = await seedUsers(db);
    console.log("");

    const originalRecipes = await seedRecipes(db, users, allTags);
    console.log("");

    const collections = await seedCollections(db, users);
    console.log("");

    await seedFollows(db, users);
    console.log("");

    const importedRecipes = await seedImportedRecipes(
      db,
      users,
      originalRecipes,
      collections
    );
    console.log("");

    const allRecipes = [...originalRecipes, ...importedRecipes];
    await seedActivityFeed(db, users, allRecipes);
    console.log("");

    console.log("✨ Database seeded successfully!");
    console.log("\n📊 Summary:");
    console.log(`   👥 ${users.length} users`);
    console.log(`   🍳 ${originalRecipes.length} original + ${importedRecipes.length} imported recipes`);
    console.log(`   🏷️  ${allTags.length} tags`);
    console.log(`   📚 ${collections.length} collections`);
    console.log("\n🔑 All users have password: Password123!");
    console.log("\n📧 Sample login:");
    console.log("   Email: emma.rodriguez@example.com");
    console.log("   Password: Password123!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
