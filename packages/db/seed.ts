import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "./schemas";
import { users as userData } from "./data/users";
import { recipes as recipeData, type SourceType } from "./data/recipes";
import { socialRecipes } from "./data/social-recipes";
import * as readline from "readline";
import { hashPassword } from "better-auth/crypto";
import { extractPreparation } from "./utils/ingredientParser";
import { classifyIngredientAisle, normalizeIngredientName } from "@repo/shared";

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

function randomDateBetween(start: Date, end: Date = new Date()): Date {
  if (start.getTime() >= end.getTime()) {
    return end;
  }

  const randomTime =
    start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

function randomDateAfter(start: Date, maxDaysAfter: number): Date {
  const now = new Date();
  const latest = new Date(
    Math.min(
      now.getTime(),
      start.getTime() + maxDaysAfter * 24 * 60 * 60 * 1000
    )
  );
  return randomDateBetween(start, latest);
}

function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
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

function formatDateOffset(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

async function seedNotification(
  db: DbClient,
  usersById: Map<string, typeof schema.user.$inferSelect>,
  params: {
    recipientId: string;
    actorId: string;
    type: typeof schema.notifications.$inferInsert.type;
    createdAt: Date;
    isRead?: boolean;
    activityEventId?: number;
    mealPlanId?: number;
    shoppingListId?: number;
    commentId?: number;
  }
): Promise<boolean> {
  if (params.recipientId === params.actorId) {
    return false;
  }

  const actor = usersById.get(params.actorId);
  if (!actor) {
    return false;
  }

  await db.insert(schema.notifications).values({
    recipientId: params.recipientId,
    actorId: params.actorId,
    type: params.type,
    activityEventId: params.activityEventId ?? null,
    mealPlanId: params.mealPlanId ?? null,
    shoppingListId: params.shoppingListId ?? null,
    commentId: params.commentId ?? null,
    actorName: actor.name,
    actorImage: actor.image,
    isRead: params.isRead ?? Math.random() < 0.55,
    createdAt: params.createdAt,
  });

  return true;
}

async function shouldClearDatabase(): Promise<boolean> {
  if (process.argv.includes("--clear")) {
    return true;
  }

  if (process.argv.includes("--no-clear")) {
    return false;
  }

  if (process.env.SEED_CLEAR === "true") {
    return true;
  }

  const answer = await question(
    "⚠️  Do you want to clear existing data before seeding? (yes/no): "
  );

  return answer.toLowerCase() === "yes" || answer.toLowerCase() === "y";
}

// Parse ingredient text to extract quantity, unit, name, and preparation
interface ParsedIngredient {
  quantity: string | null;
  unit: string | null;
  name: string;
  preparation: string | null;
}

function parseIngredient(ingredientText: string): ParsedIngredient {
  if (!ingredientText || typeof ingredientText !== "string") {
    return { quantity: null, unit: null, name: ingredientText || "", preparation: null };
  }

  const match = ingredientText.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*([a-zA-Z]*)\s+(.+)$/
  );

  if (match) {
    const quantityStr = match[1];
    const unit = match[2]?.trim() || null;
    const rawName = match[3]?.trim() || ingredientText;

    // Extract preparation from the ingredient name
    const { name, preparation } = extractPreparation(rawName);

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

    return { quantity, unit, name, preparation };
  }

  // Try to extract preparation from the entire text
  const { name, preparation } = extractPreparation(ingredientText);
  return { quantity: null, unit: null, name, preparation };
}

// ─── Database Operations ──────────────────────────────────────────────────────

type DbClient = ReturnType<typeof drizzle>;

async function clearDatabase(db: DbClient) {
  console.log("🗑️  Clearing existing data...");

  // Delete in order respecting foreign keys
  await db.delete(schema.notifications);
  await db.delete(schema.comments);
  await db.delete(schema.activityLikes);
  await db.delete(schema.cookingReviewImages);
  await db.delete(schema.cookingReviews);
  await db.delete(schema.activityEvents);
  await db.delete(schema.mealPlanInvitations);
  await db.delete(schema.mealPlanEntries);
  await db.delete(schema.mealPlans);
  await db.delete(schema.shoppingListInvitations);
  await db.delete(schema.shoppingListItems);
  await db.delete(schema.shoppingListRecipes);
  await db.delete(schema.shoppingLists);
  await db.delete(schema.follows);
  await db.delete(schema.recipeCollections);
  await db.delete(schema.collections);
  await db.delete(schema.recipeTags);
  await db.delete(schema.recipeNutrition);
  // Delete ingredients/instructions first, then their sections
  await db.delete(schema.recipeInstructions);
  await db.delete(schema.recipeIngredients);
  await db.delete(schema.instructionSections);
  await db.delete(schema.ingredientSections);
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
        username: u.username,
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

  // Source types to distribute across recipes (excluding "user" which is for imported recipes)
  // Half are URLs, the other half are distributed among text, ai, manual
  const sourceTypes: SourceType[] = ["url", "text", "url", "ai", "url", "manual"];

  // Fake source domains for URL-type recipes
  const fakeDomains = [
    "bonappetit.com",
    "seriouseats.com",
    "food52.com",
    "epicurious.com",
    "nytimes.com/cooking",
    "thekitchn.com",
    "delish.com",
    "allrecipes.com",
  ];

  for (const r of recipeData) {
    const user = shuffledUsers[userIndex % shuffledUsers.length]!;

    const createdAt = randomDateAfter(user.createdAt, 60);

    // Determine source type: use explicit sourceType if provided,
    // use "url" if sourceUrl exists, otherwise cycle through source types
    let sourceType: SourceType;
    if (r.sourceType) {
      sourceType = r.sourceType;
    } else if (r.sourceUrl) {
      sourceType = "url";
    } else {
      // Cycle through non-url source types for variety
      sourceType = sourceTypes[userIndex % sourceTypes.length]!;
    }

    // Only include sourceUrl if sourceType is "url"
    // Generate realistic-looking URLs using fake domains
    const generateFakeUrl = () => {
      const domain = fakeDomains[userIndex % fakeDomains.length]!;
      const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      return `https://www.${domain}/recipes/${slug}`;
    };
    const sourceUrl = sourceType === "url" ? (r.sourceUrl || generateFakeUrl()) : null;

    userIndex++;

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
        ownerId: user.id,
        sourceUrl,
        sourceType,
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

    // Create default ingredient section (null name = no header displayed)
    const [ingredientSection] = await db
      .insert(schema.ingredientSections)
      .values({
        recipeId: recipe.id,
        name: null,
        index: 0,
      })
      .returning();

    // Add ingredients to the section
    if (ingredientSection) {
      for (let i = 0; i < r.ingredients.length; i++) {
        const parsed = parseIngredient(r.ingredients[i]!);
        await db.insert(schema.recipeIngredients).values({
          sectionId: ingredientSection.id,
          index: i,
          quantity: parsed.quantity,
          unit: parsed.unit,
          name: parsed.name,
          preparation: parsed.preparation,
        });
      }
    }

    // Create default instruction section (null name = no header displayed)
    const [instructionSection] = await db
      .insert(schema.instructionSections)
      .values({
        recipeId: recipe.id,
        name: null,
        index: 0,
      })
      .returning();

    // Add instructions to the section
    if (instructionSection) {
      for (let i = 0; i < r.instructions.length; i++) {
        await db.insert(schema.recipeInstructions).values({
          sectionId: instructionSection.id,
          index: i,
          instruction: r.instructions[i]!,
        });
      }
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

  // Log source type distribution
  const sourceTypeCounts = recipes.reduce((acc, r) => {
    acc[r.sourceType] = (acc[r.sourceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const distribution = Object.entries(sourceTypeCounts)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");
  console.log(`✅ Seeded ${recipes.length} recipes (${distribution})`);
  return recipes;
}

async function seedSocialRecipes(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[],
  allTags: (typeof schema.tags.$inferSelect)[]
) {
  console.log("📱 Seeding social media recipes...");

  const recipes: (typeof schema.recipes.$inferSelect)[] = [];

  for (const r of socialRecipes) {
    const owner = users.find((user) => user.id === r.ownerId);
    const createdAt = owner ? randomDateAfter(owner.createdAt, 30) : randomDate(30);

    // Create the recipe with specific owner
    const [recipe] = await db
      .insert(schema.recipes)
      .values({
        name: r.name,
        description: r.description,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        totalTime: r.totalTime,
        servings: r.servings,
        ownerId: r.ownerId,
        sourceUrl: r.sourceUrl || null,
        sourceType: "url",
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

    // Create default ingredient section (null name = no header displayed)
    const [ingredientSection] = await db
      .insert(schema.ingredientSections)
      .values({
        recipeId: recipe.id,
        name: null,
        index: 0,
      })
      .returning();

    // Add ingredients to the section
    if (ingredientSection) {
      for (let i = 0; i < r.ingredients.length; i++) {
        const parsed = parseIngredient(r.ingredients[i]!);
        await db.insert(schema.recipeIngredients).values({
          sectionId: ingredientSection.id,
          index: i,
          quantity: parsed.quantity,
          unit: parsed.unit,
          name: parsed.name,
          preparation: parsed.preparation,
        });
      }
    }

    // Create default instruction section (null name = no header displayed)
    const [instructionSection] = await db
      .insert(schema.instructionSections)
      .values({
        recipeId: recipe.id,
        name: null,
        index: 0,
      })
      .returning();

    // Add instructions to the section
    if (instructionSection) {
      for (let i = 0; i < r.instructions.length; i++) {
        await db.insert(schema.recipeInstructions).values({
          sectionId: instructionSection.id,
          index: i,
          instruction: r.instructions[i]!,
        });
      }
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

  console.log(`✅ Seeded ${recipes.length} social media recipes`);
  return recipes;
}

async function seedCollections(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[]
) {
  console.log("📚 Seeding collections...");

  // Create both default collections for each user
  const collectionValues = users.flatMap((user) => [
    {
      userId: user.id,
      name: "Want to cook",
      defaultType: "want_to_cook",
      createdAt: user.createdAt,
      updatedAt: new Date(),
    },
    {
      userId: user.id,
      name: "Cooked",
      defaultType: "cooked",
      createdAt: user.createdAt,
      updatedAt: new Date(),
    },
  ]);

  const collections = await db
    .insert(schema.collections)
    .values(collectionValues)
    .returning();

  console.log(
    `✅ Seeded ${collections.length} default collections (2 per user)`
  );
  return collections;
}

async function seedFollows(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[]
) {
  console.log("👥 Seeding follow relationships...");

  // Users that everyone should follow (social media content creators)
  const socialMediaUsers = ["user_013", "user_014"];

  let followsCount = 0;
  const followPairs = new Set<string>();

  // First, make all users follow the social media users
  for (const user of users) {
    for (const socialUserId of socialMediaUsers) {
      if (user.id !== socialUserId) {
        const socialUser = users.find((u) => u.id === socialUserId);
        const pairKey = `${user.id}->${socialUserId}`;
        if (!followPairs.has(pairKey)) {
          await db.insert(schema.follows).values({
            followerId: user.id,
            followingId: socialUserId,
            createdAt: randomDateAfter(
              socialUser ? maxDate(user.createdAt, socialUser.createdAt) : user.createdAt,
              60
            ),
          });
          followPairs.add(pairKey);
          followsCount++;
        }
      }
    }
  }

  // Then add random follows for variety
  for (const user of users) {
    const otherUsers = users.filter((u) => u.id !== user.id);
    const usersToFollow = shuffle(otherUsers).slice(0, randomInt(2, 5));

    for (const userToFollow of usersToFollow) {
      const pairKey = `${user.id}->${userToFollow.id}`;
      if (!followPairs.has(pairKey)) {
        await db.insert(schema.follows).values({
          followerId: user.id,
          followingId: userToFollow.id,
          createdAt: randomDateAfter(
            maxDate(user.createdAt, userToFollow.createdAt),
            60
          ),
        });
        followPairs.add(pairKey);
        followsCount++;
      }
    }
  }

  console.log(`✅ Seeded ${followsCount} follow relationships`);
}

async function seedMealPlans(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[],
  allRecipes: (typeof schema.recipes.$inferSelect)[]
) {
  console.log("🗓️  Seeding meal plans...");

  const mealTypes = ["breakfast", "lunch", "dinner"] as const;
  const extraPlanNames = ["Meal Prep Week", "Family Dinners", "Weekend Cooking"];
  const seededPlans: (typeof schema.mealPlans.$inferSelect)[] = [];
  let entriesCount = 0;

  async function addEntries(
    plan: typeof schema.mealPlans.$inferSelect,
    recipesForPlan: (typeof schema.recipes.$inferSelect)[],
    dayOffset: number,
    maxEntries: number
  ) {
    const entryCount = Math.min(recipesForPlan.length, maxEntries);

    for (let i = 0; i < entryCount; i++) {
      const recipe = recipesForPlan[i]!;
      const [image] = await db
        .select({ url: schema.recipeImages.url })
        .from(schema.recipeImages)
        .where(eq(schema.recipeImages.recipeId, recipe.id))
        .limit(1);

      const createdAt = randomDateAfter(plan.createdAt, 7);
      await db.insert(schema.mealPlanEntries).values({
        mealPlanId: plan.id,
        date: formatDateOffset(dayOffset + i),
        mealType: mealTypes[i % mealTypes.length]!,
        recipeId: recipe.id,
        recipeName: recipe.name,
        recipeImageUrl: image?.url ?? null,
        createdAt,
        updatedAt: createdAt,
      });

      entriesCount++;
    }
  }

  for (const [index, user] of users.entries()) {
    const createdAt = randomDateAfter(user.createdAt, 20);
    const [defaultPlan] = await db
      .insert(schema.mealPlans)
      .values({
        userId: user.id,
        name: "My Meal Plan",
        isDefault: true,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    if (!defaultPlan) continue;
    seededPlans.push(defaultPlan);

    const userRecipes = shuffle(allRecipes.filter((r) => r.ownerId === user.id));
    await addEntries(defaultPlan, userRecipes, 0, randomInt(3, 6));

    if (index % 3 === 0 && userRecipes.length > 2) {
      const sharedPlanCreatedAt = randomDateAfter(createdAt, 5);
      const [sharedPlan] = await db
        .insert(schema.mealPlans)
        .values({
          userId: user.id,
          name: extraPlanNames[index % extraPlanNames.length]!,
          isDefault: false,
          createdAt: sharedPlanCreatedAt,
          updatedAt: sharedPlanCreatedAt,
        })
        .returning();

      if (sharedPlan) {
        seededPlans.push(sharedPlan);
        await addEntries(sharedPlan, shuffle(userRecipes), 3, randomInt(2, 4));
      }
    }
  }

  console.log(
    `✅ Seeded ${seededPlans.length} meal plans with ${entriesCount} entries`
  );
  return seededPlans;
}

async function seedShoppingLists(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[],
  allRecipes: (typeof schema.recipes.$inferSelect)[]
) {
  console.log("🛒 Seeding shopping lists...");

  const extraListNames = ["Batch Cook Shop", "Dinner Party List", "Weekend Market"];
  const seededLists: (typeof schema.shoppingLists.$inferSelect)[] = [];
  let recipeCount = 0;
  let itemCount = 0;

  async function addRecipesToList(
    shoppingList: typeof schema.shoppingLists.$inferSelect,
    recipesForList: (typeof schema.recipes.$inferSelect)[],
    maxRecipes: number
  ) {
    const recipesToAdd = recipesForList.slice(
      0,
      Math.min(recipesForList.length, maxRecipes)
    );

    for (const recipe of recipesToAdd) {
      const [image] = await db
        .select({ url: schema.recipeImages.url })
        .from(schema.recipeImages)
        .where(eq(schema.recipeImages.recipeId, recipe.id))
        .limit(1);

      const addedAt = randomDateAfter(shoppingList.createdAt, 5);
      await db.insert(schema.shoppingListRecipes).values({
        shoppingListId: shoppingList.id,
        recipeId: recipe.id,
        recipeName: recipe.name,
        recipeImageUrl: image?.url ?? null,
        createdAt: addedAt,
      });
      recipeCount++;

      const sections = await db
        .select()
        .from(schema.ingredientSections)
        .where(eq(schema.ingredientSections.recipeId, recipe.id));

      const ingredients = [];
      for (const section of sections) {
        const sectionIngredients = await db
          .select()
          .from(schema.recipeIngredients)
          .where(eq(schema.recipeIngredients.sectionId, section.id));
        ingredients.push(...sectionIngredients);
      }

      for (const ingredient of ingredients.slice(0, 6)) {
        const normalizedName = normalizeIngredientName(ingredient.name);
        const itemCreatedAt = randomDateAfter(addedAt, 2);
        await db.insert(schema.shoppingListItems).values({
          shoppingListId: shoppingList.id,
          ingredientName: normalizedName,
          displayName: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          isChecked: Math.random() < 0.15,
          sourceRecipeId: recipe.id,
          sourceRecipeName: recipe.name,
          aisle: classifyIngredientAisle(normalizedName),
          createdAt: itemCreatedAt,
          updatedAt: itemCreatedAt,
        });
        itemCount++;
      }
    }
  }

  for (const [index, user] of users.entries()) {
    const createdAt = randomDateAfter(user.createdAt, 10);
    const [shoppingList] = await db
      .insert(schema.shoppingLists)
      .values({
        userId: user.id,
        name: "Shopping List",
        isDefault: true,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    if (!shoppingList) continue;
    seededLists.push(shoppingList);

    const userRecipes = shuffle(allRecipes.filter((r) => r.ownerId === user.id));
    await addRecipesToList(shoppingList, userRecipes, randomInt(1, 3));

    if (index % 3 === 1 && userRecipes.length > 2) {
      const extraListCreatedAt = randomDateAfter(createdAt, 5);
      const [extraList] = await db
        .insert(schema.shoppingLists)
        .values({
          userId: user.id,
          name: extraListNames[index % extraListNames.length]!,
          isDefault: false,
          createdAt: extraListCreatedAt,
          updatedAt: extraListCreatedAt,
        })
        .returning();

      if (extraList) {
        seededLists.push(extraList);
        await addRecipesToList(extraList, shuffle(userRecipes), randomInt(2, 4));
      }
    }
  }

  console.log(
    `✅ Seeded ${seededLists.length} shopping lists, ${recipeCount} list recipes, ${itemCount} items`
  );
  return seededLists;
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
    const otherRecipes = originalRecipes.filter((r) => r.ownerId !== user.id);
    const recipesToImport = shuffle(otherRecipes).slice(0, randomInt(2, 4));
    const userCollection = collections.find((c) => c.userId === user.id);

    for (const sourceRecipe of recipesToImport) {
      const importedAt = randomDateAfter(
        maxDate(user.createdAt, sourceRecipe.createdAt),
        30
      );

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
          sourceUrl: null,
          sourceType: "user",
          originalRecipeId: sourceRecipe.id,
          originalOwnerId: sourceRecipe.ownerId,
          ownerId: user.id,
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

      // Copy ingredient sections and their ingredients
      const sourceIngredientSections = await db
        .select()
        .from(schema.ingredientSections)
        .where(eq(schema.ingredientSections.recipeId, sourceRecipe.id));

      for (const section of sourceIngredientSections) {
        // Create new section for imported recipe
        const [newSection] = await db
          .insert(schema.ingredientSections)
          .values({
            recipeId: importedRecipe.id,
            name: section.name,
            index: section.index,
          })
          .returning();

        if (newSection) {
          // Copy ingredients for this section
          const sourceIngredients = await db
            .select()
            .from(schema.recipeIngredients)
            .where(eq(schema.recipeIngredients.sectionId, section.id));

          for (const ing of sourceIngredients) {
            await db.insert(schema.recipeIngredients).values({
              sectionId: newSection.id,
              index: ing.index,
              quantity: ing.quantity,
              unit: ing.unit,
              name: ing.name,
              preparation: ing.preparation,
            });
          }
        }
      }

      // Copy instruction sections and their instructions
      const sourceInstructionSections = await db
        .select()
        .from(schema.instructionSections)
        .where(eq(schema.instructionSections.recipeId, sourceRecipe.id));

      for (const section of sourceInstructionSections) {
        // Create new section for imported recipe
        const [newSection] = await db
          .insert(schema.instructionSections)
          .values({
            recipeId: importedRecipe.id,
            name: section.name,
            index: section.index,
          })
          .returning();

        if (newSection) {
          // Copy instructions for this section
          const sourceInstructions = await db
            .select()
            .from(schema.recipeInstructions)
            .where(eq(schema.recipeInstructions.sectionId, section.id));

          for (const inst of sourceInstructions) {
            await db.insert(schema.recipeInstructions).values({
              sectionId: newSection.id,
              index: inst.index,
              instruction: inst.instruction,
              imageUrl: inst.imageUrl,
            });
          }
        }
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
      userId: recipe.ownerId,
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

  // Sample review images (food photos from Unsplash)
  const reviewImageSets = [
    [
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800",
    ],
    [
      "https://images.unsplash.com/photo-1482049016823-2e42b83c6cf3?w=800",
    ],
    [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800",
    ],
    [
      "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800",
    ],
    [
      "https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=800",
      "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=800",
    ],
  ];

  // Create cooking reviews
  let imageSetIndex = 0;
  for (const user of users) {
    // Each user reviews 1-3 recipes they own
    const userRecipes = allRecipes.filter((r) => r.ownerId === user.id);
    const recipesToReview = shuffle(userRecipes).slice(0, randomInt(1, 3));

    for (const recipe of recipesToReview) {
      const reviewCreatedAt = randomDateAfter(recipe.createdAt, 20);
      const rating = randomInt(3, 5);
      const reviewText = randomChoice(reviewTexts);

      // About 40% of reviews have images
      const hasImages = Math.random() < 0.4;
      const images = hasImages ? reviewImageSets[imageSetIndex % reviewImageSets.length]! : [];
      if (hasImages) imageSetIndex++;

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

      const [review] = await db.insert(schema.cookingReviews).values({
        userId: user.id,
        recipeId: recipe.id,
        activityEventId: activityEvent.id,
        rating,
        reviewText,
        createdAt: reviewCreatedAt,
        updatedAt: reviewCreatedAt,
      }).returning();

      // Add review images
      if (review && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          await db.insert(schema.cookingReviewImages).values({
            reviewId: review.id,
            url: images[i]!,
            index: i,
          });
        }
      }

      reviewCount++;
    }
  }

  console.log(
    `✅ Seeded ${importEventCount} import events, ${reviewCount} cooking reviews`
  );
}

async function seedLikesAndComments(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[]
) {
  console.log("💬 Seeding likes and comments...");

  // Get all activity events
  const activityEvents = await db.select().from(schema.activityEvents);

  // Sample comments for cooking reviews
  const reviewComments = [
    "This looks amazing! 😍",
    "I need to try this recipe!",
    "How long did it take you?",
    "Saving this for later!",
    "Your plating is beautiful!",
    "Did you make any substitutions?",
    "This is going on my meal plan!",
    "Looks delicious! Well done 👏",
    "I made this last week too - so good!",
    "What sides did you serve with this?",
    "Perfect for a weeknight dinner",
    "The colors look incredible",
    "My family would love this",
    "Great job! Looks restaurant quality",
    "Adding to my must-try list",
  ];

  // Sample comments for recipe imports
  const importComments = [
    "Great find!",
    "I've been looking for a recipe like this",
    "Thanks for sharing! 🙌",
    "Looks like a keeper",
    "Adding this to my collection too",
    "Perfect timing, I have all these ingredients",
    "This website has such good recipes",
    "Bookmarked!",
    "Can't wait to try this",
    "Looks straightforward and delicious",
  ];

  // Sample reply comments
  const replyComments = [
    "Thanks so much! 🙏",
    "It was actually pretty easy!",
    "No substitutions, followed it exactly",
    "About 45 minutes total",
    "Highly recommend it!",
    "Let me know how it turns out!",
    "I served it with rice",
    "Thanks for the kind words!",
  ];

  let likesCount = 0;
  let commentsCount = 0;
  let notificationsCount = 0;
  const usersById = new Map(users.map((user) => [user.id, user]));

  for (const event of activityEvents) {
    // Each activity gets 0-8 likes from random users
    const numLikes = randomInt(0, 8);
    const likers = shuffle(users.filter((u) => u.id !== event.userId)).slice(
      0,
      numLikes
    );

    for (const liker of likers) {
      const likeCreatedAt = randomDateAfter(event.createdAt, 14);
      try {
        await db.insert(schema.activityLikes).values({
          userId: liker.id,
          activityEventId: event.id,
          createdAt: likeCreatedAt,
        });
        likesCount++;
        if (
          await seedNotification(db, usersById, {
            recipientId: event.userId,
            actorId: liker.id,
            type: "activity_like",
            activityEventId: event.id,
            createdAt: likeCreatedAt,
            isRead: Math.random() < 0.7,
          })
        ) {
          notificationsCount++;
        }
      } catch {
        // Skip duplicates
      }
    }

    // Each activity gets 0-4 comments
    const numComments = randomInt(0, 4);
    const commenters = shuffle(users.filter((u) => u.id !== event.userId)).slice(
      0,
      numComments
    );

    const commentPool =
      event.type === "cooking_review" ? reviewComments : importComments;

    const insertedComments: { id: number; userId: string; createdAt: Date }[] =
      [];

    for (const commenter of commenters) {
      const commentCreatedAt = randomDateAfter(event.createdAt, 14);
      const [comment] = await db
        .insert(schema.comments)
        .values({
          userId: commenter.id,
          activityEventId: event.id,
          content: randomChoice(commentPool),
          createdAt: commentCreatedAt,
          updatedAt: commentCreatedAt,
        })
        .returning();

      if (comment) {
        insertedComments.push({
          id: comment.id,
          userId: commenter.id,
          createdAt: commentCreatedAt,
        });
        commentsCount++;
        if (
          await seedNotification(db, usersById, {
            recipientId: event.userId,
            actorId: commenter.id,
            type: "activity_comment",
            activityEventId: event.id,
            commentId: comment.id,
            createdAt: commentCreatedAt,
            isRead: Math.random() < 0.55,
          })
        ) {
          notificationsCount++;
        }
      }
    }

    // Add some replies to comments (about 30% chance per comment)
    for (const parentComment of insertedComments) {
      if (Math.random() < 0.3) {
        // Reply from the activity owner or another user
        const replier =
          Math.random() < 0.6
            ? users.find((u) => u.id === event.userId)
            : randomChoice(users.filter((u) => u.id !== parentComment.userId));

        if (replier) {
          const replyCreatedAt = randomDateAfter(parentComment.createdAt, 7);
          const [reply] = await db
            .insert(schema.comments)
            .values({
              userId: replier.id,
              activityEventId: event.id,
              parentCommentId: parentComment.id,
              content: randomChoice(replyComments),
              createdAt: replyCreatedAt,
              updatedAt: replyCreatedAt,
            })
            .returning();

          if (reply) {
            commentsCount++;
            if (
              await seedNotification(db, usersById, {
                recipientId: parentComment.userId,
                actorId: replier.id,
                type: "comment_reply",
                activityEventId: event.id,
                commentId: reply.id,
                createdAt: replyCreatedAt,
                isRead: Math.random() < 0.45,
              })
            ) {
              notificationsCount++;
            }
          }
        }
      }
    }

    // Update denormalized counts on activity event
    await db
      .update(schema.activityEvents)
      .set({
        likeCount: likers.length,
        commentCount: insertedComments.length,
      })
      .where(eq(schema.activityEvents.id, event.id));
  }

  console.log(
    `✅ Seeded ${likesCount} likes, ${commentsCount} comments, ${notificationsCount} social notifications`
  );
}

async function seedSharedResources(
  db: DbClient,
  users: (typeof schema.user.$inferSelect)[],
  mealPlans: (typeof schema.mealPlans.$inferSelect)[],
  shoppingLists: (typeof schema.shoppingLists.$inferSelect)[]
) {
  console.log("🤝 Seeding shared meal plans and shopping lists...");

  const usersById = new Map(users.map((user) => [user.id, user]));
  const follows = await db.select().from(schema.follows);

  function getFriends(userId: string) {
    const friendIds = new Set<string>();
    for (const follow of follows) {
      if (follow.followerId === userId) {
        friendIds.add(follow.followingId);
      }
      if (follow.followingId === userId) {
        friendIds.add(follow.followerId);
      }
    }
    friendIds.delete(userId);
    return shuffle(Array.from(friendIds));
  }

  let mealInvitesCount = 0;
  let shoppingInvitesCount = 0;
  let notificationsCount = 0;

  for (const plan of mealPlans.filter((plan) => !plan.isDefault)) {
    const owner = usersById.get(plan.userId);
    if (!owner) continue;

    const friends = getFriends(plan.userId).slice(0, 2);
    for (const [index, invitedUserId] of friends.entries()) {
      const createdAt = randomDateAfter(plan.createdAt, 7);
      const status = index === 0 ? "accepted" : "pending";
      await db.insert(schema.mealPlanInvitations).values({
        mealPlanId: plan.id,
        invitedUserId,
        invitedByUserId: plan.userId,
        status,
        inviterName: owner.name,
        inviterImage: owner.image,
        mealPlanName: plan.name,
        createdAt,
      });
      mealInvitesCount++;

      if (
        await seedNotification(db, usersById, {
          recipientId: invitedUserId,
          actorId: plan.userId,
          type: "meal_plan_invite",
          mealPlanId: plan.id,
          createdAt,
          isRead: status === "accepted",
        })
      ) {
        notificationsCount++;
      }
    }
  }

  for (const shoppingList of shoppingLists.filter((list) => !list.isDefault)) {
    const owner = usersById.get(shoppingList.userId);
    if (!owner) continue;

    const friends = getFriends(shoppingList.userId).slice(0, 2);
    for (const [index, invitedUserId] of friends.entries()) {
      const createdAt = randomDateAfter(shoppingList.createdAt, 7);
      const status = index === 0 ? "accepted" : "pending";
      await db.insert(schema.shoppingListInvitations).values({
        shoppingListId: shoppingList.id,
        invitedUserId,
        invitedByUserId: shoppingList.userId,
        status,
        inviterName: owner.name,
        inviterImage: owner.image,
        shoppingListName: shoppingList.name,
        createdAt,
      });
      shoppingInvitesCount++;

      if (
        await seedNotification(db, usersById, {
          recipientId: invitedUserId,
          actorId: shoppingList.userId,
          type: "shopping_list_invite",
          shoppingListId: shoppingList.id,
          createdAt,
          isRead: status === "accepted",
        })
      ) {
        notificationsCount++;
      }
    }
  }

  console.log(
    `✅ Seeded ${mealInvitesCount} meal plan invites, ${shoppingInvitesCount} shopping list invites, ${notificationsCount} invite notifications`
  );
}

async function seedNutrition(
  db: DbClient,
  recipes: (typeof schema.recipes.$inferSelect)[]
) {
  console.log("🥗 Seeding nutrition data...");

  let nutritionCount = 0;

  // Add nutrition data to about 60% of recipes
  for (const recipe of recipes) {
    if (Math.random() < 0.6) {
      await db.insert(schema.recipeNutrition).values({
        recipeId: recipe.id,
        calories: randomInt(150, 800),
        protein: String(randomInt(5, 45)),
        carbohydrates: String(randomInt(10, 80)),
        fat: String(randomInt(5, 40)),
        saturatedFat: String(randomInt(1, 15)),
        fiber: String(randomInt(1, 12)),
        sugar: String(randomInt(1, 25)),
        sodium: randomInt(100, 1200),
      });
      nutritionCount++;
    }
  }

  console.log(`✅ Seeded nutrition for ${nutritionCount} recipes`);
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
    if (await shouldClearDatabase()) {
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

    const socialMediaRecipes = await seedSocialRecipes(db, users, allTags);
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

    const allRecipes = [...originalRecipes, ...socialMediaRecipes, ...importedRecipes];
    await seedActivityFeed(db, users, allRecipes);
    console.log("");

    await seedLikesAndComments(db, users);
    console.log("");

    await seedNutrition(db, allRecipes);
    console.log("");

    const mealPlans = await seedMealPlans(db, users, allRecipes);
    console.log("");

    const shoppingLists = await seedShoppingLists(db, users, allRecipes);
    console.log("");

    await seedSharedResources(db, users, mealPlans, shoppingLists);
    console.log("");

    console.log("✨ Database seeded successfully!");
    console.log("\n📊 Summary:");
    console.log(`   👥 ${users.length} users`);
    console.log(`   🍳 ${originalRecipes.length} original + ${socialMediaRecipes.length} social + ${importedRecipes.length} imported recipes`);
    console.log(`   🏷️  ${allTags.length} tags`);
    console.log(`   📚 ${collections.length} collections`);
    console.log(`   🗓️  ${mealPlans.length} meal plans`);
    console.log(`   🛒 ${shoppingLists.length} shopping lists`);
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
