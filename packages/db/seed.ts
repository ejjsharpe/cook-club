import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schemas";
import { users as userData } from "./data/users";
import { recipes as recipeData } from "./data/recipes";
import * as readline from "readline";
import bcrypt from "bcryptjs";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Hash password using bcrypt (Better Auth compatible)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Generate random date within the last N days
function randomDate(daysAgo: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const randomTime =
    past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(randomTime);
}

// Shuffle array
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

async function clearDatabase(db: ReturnType<typeof drizzle>) {
  console.log("🗑️  Clearing existing data...");

  // Delete in order to respect foreign key constraints
  await db.delete(schema.follows);
  await db.delete(schema.userLikes);
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

async function seedTags(db: ReturnType<typeof drizzle>) {
  console.log("🏷️  Seeding tags...");

  const cuisines = [
    "Italian",
    "Mexican",
    "Chinese",
    "Japanese",
    "Thai",
    "Indian",
    "French",
    "American",
    "Mediterranean",
    "Korean",
    "Vietnamese",
    "Greek",
    "Spanish",
    "Middle Eastern",
  ];

  const categories = [
    "Breakfast",
    "Lunch",
    "Dinner",
    "Dessert",
    "Snack",
    "Appetizer",
    "Main Course",
    "Side Dish",
    "Salad",
    "Soup",
    "Beverage",
    "Baking",
  ];

  const cuisineTags = await db
    .insert(schema.tags)
    .values(cuisines.map((name) => ({ name, type: "cuisine" })))
    .returning();

  const categoryTags = await db
    .insert(schema.tags)
    .values(categories.map((name) => ({ name, type: "category" })))
    .returning();

  console.log(
    `✅ Seeded ${cuisineTags.length} cuisines and ${categoryTags.length} categories`
  );

  return { cuisineTags, categoryTags };
}

async function seedUsers(db: ReturnType<typeof drizzle>) {
  console.log("👥 Seeding users...");

  const hashedUsers = await Promise.all(
    userData.map(async (user) => ({
      ...user,
      password: await hashPassword(user.password),
      createdAt: randomDate(90),
      updatedAt: new Date(),
      emailVerified: true,
    }))
  );

  const insertedUsers = await db
    .insert(schema.user)
    .values(hashedUsers)
    .returning();

  console.log(`✅ Seeded ${insertedUsers.length} users`);

  return insertedUsers;
}

async function seedRecipes(
  db: ReturnType<typeof drizzle>,
  users: (typeof schema.user.$inferSelect)[],
  allTags: (typeof schema.tags.$inferSelect)[]
) {
  console.log("🍳 Seeding recipes...");

  let recipeCount = 0;
  const allRecipes: (typeof schema.recipes.$inferSelect)[] = [];

  // Distribute recipes among users
  for (let i = 0; i < users.length; i++) {
    const user = users[i]!;
    const recipesPerUser = 5 + Math.floor(Math.random() * 3); // 5-7 recipes per user

    for (
      let j = 0;
      j < recipesPerUser && recipeCount < recipeData.length;
      j++
    ) {
      const recipeInfo = recipeData[recipeCount]!;
      const createdAt = randomDate(60);

      // Insert recipe
      const [insertedRecipe] = await db
        .insert(schema.recipes)
        .values({
          name: recipeInfo.name,
          description: recipeInfo.description,
          prepTime: recipeInfo.prepTime,
          cookTime: recipeInfo.cookTime,
          totalTime: recipeInfo.totalTime,
          servings: recipeInfo.servings,
          uploadedBy: user.id,
          sourceUrl: recipeInfo.sourceUrl,
          createdAt,
          updatedAt: createdAt,
        })
        .returning();

      allRecipes.push(insertedRecipe!);

      // Insert ingredients
      await db.insert(schema.recipeIngredients).values(
        recipeInfo.ingredients.map((ingredient: string, idx: number) => ({
          recipeId: insertedRecipe!.id,
          index: idx,
          ingredient,
        }))
      );

      // Insert instructions
      await db.insert(schema.recipeInstructions).values(
        recipeInfo.instructions.map((instruction: string, idx: number) => ({
          recipeId: insertedRecipe!.id,
          index: idx,
          instruction,
        }))
      );

      // Insert image
      await db.insert(schema.recipeImages).values({
        recipeId: insertedRecipe!.id,
        url: recipeInfo.imageUrl,
      });

      // Link tags
      const cuisineTagIds = allTags
        .filter(
          (t) => t.type === "cuisine" && recipeInfo.cuisines.includes(t.name)
        )
        .map((t) => t.id);

      const categoryTagIds = allTags
        .filter(
          (t) => t.type === "category" && recipeInfo.categories.includes(t.name)
        )
        .map((t) => t.id);

      const tagIds = [...cuisineTagIds, ...categoryTagIds];

      if (tagIds.length > 0) {
        await db.insert(schema.recipeTags).values(
          tagIds.map((tagId) => ({
            recipeId: insertedRecipe!.id,
            tagId,
          }))
        );
      }

      recipeCount++;
    }
  }

  console.log(`✅ Seeded ${recipeCount} recipes`);

  return allRecipes;
}

async function seedCollections(
  db: ReturnType<typeof drizzle>,
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

async function seedEngagement(
  db: ReturnType<typeof drizzle>,
  users: (typeof schema.user.$inferSelect)[],
  recipes: (typeof schema.recipes.$inferSelect)[],
  collections: (typeof schema.collections.$inferSelect)[]
) {
  console.log("❤️  Seeding engagement data...");

  let likesCount = 0;
  let savesCount = 0;
  let followsCount = 0;

  // Each user likes some random recipes (not their own)
  for (const user of users) {
    const otherRecipes = recipes.filter((r) => r.uploadedBy !== user.id);
    const shuffledRecipes = shuffle(otherRecipes);
    const recipesToLike = shuffledRecipes.slice(
      0,
      8 + Math.floor(Math.random() * 7)
    ); // 8-14 likes per user

    for (const recipe of recipesToLike) {
      await db.insert(schema.userLikes).values({
        userId: user.id,
        recipeId: recipe.id,
        createdAt: randomDate(30),
      });
      likesCount++;
    }

    // Each user saves some recipes to their collection
    const recipesToSave = shuffledRecipes.slice(
      0,
      5 + Math.floor(Math.random() * 5)
    ); // 5-9 saves per user
    const userCollection = collections.find((c) => c.userId === user.id);

    if (userCollection) {
      for (const recipe of recipesToSave) {
        await db.insert(schema.recipeCollections).values({
          recipeId: recipe.id,
          collectionId: userCollection.id,
          createdAt: randomDate(45),
        });
        savesCount++;
      }
    }
  }

  // Create some follow relationships
  for (const user of users) {
    const otherUsers = users.filter((u) => u.id !== user.id);
    const shuffledUsers = shuffle(otherUsers);
    const usersToFollow = shuffledUsers.slice(
      0,
      3 + Math.floor(Math.random() * 4)
    ); // 3-6 follows per user

    for (const userToFollow of usersToFollow) {
      await db.insert(schema.follows).values({
        followerId: user.id,
        followingId: userToFollow.id,
        createdAt: randomDate(60),
      });
      followsCount++;
    }
  }

  console.log(
    `✅ Seeded ${likesCount} likes, ${savesCount} saves, ${followsCount} follows`
  );
}

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
    // Ask if user wants to clear existing data
    const answer = await question(
      "⚠️  Do you want to clear existing data before seeding? (yes/no): "
    );

    if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
      await clearDatabase(db);
      console.log("");
    }

    // Seed data
    const { cuisineTags, categoryTags } = await seedTags(db);
    const allTags = [...cuisineTags, ...categoryTags];
    console.log("");

    const users = await seedUsers(db);
    console.log("");

    const recipes = await seedRecipes(db, users, allTags);
    console.log("");

    const collections = await seedCollections(db, users);
    console.log("");

    await seedEngagement(db, users, recipes, collections);
    console.log("");

    console.log("✨ Database seeded successfully!");
    console.log("\n📊 Summary:");
    console.log(`   👥 ${users.length} users`);
    console.log(`   🍳 ${recipes.length} recipes`);
    console.log(`   🏷️  ${allTags.length} tags`);
    console.log(`   📚 ${collections.length} collections`);
    console.log("\n🔑 All users have password: Password123!");
    console.log("\n📧 Sample login credentials:");
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
