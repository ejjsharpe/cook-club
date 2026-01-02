import {
  recipes,
  recipeImages,
  recipeIngredients,
  recipeInstructions,
  ingredientSections,
  instructionSections,
  recipeCollections,
  recipeTags,
  collections,
  shoppingLists,
  shoppingListRecipes,
  tags,
  user,
} from "@repo/db/schemas";
import { TRPCError } from "@trpc/server";
import type { ImageWorkerService } from "cook-club-image-worker/service";
import { eq, and, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { parseIngredient } from "../../../utils/ingredientParser";
import { normalizeUnit } from "../../../utils/unitNormalizer";
import type { DbClient } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CreateRecipeIngredient {
  index: number;
  ingredient?: string; // Unparsed format
  quantity?: string | null; // Parsed format
  unit?: string | null;
  name?: string;
}

export interface CreateRecipeInstruction {
  index: number;
  instruction: string;
  imageUrl?: string | null;
}

export interface CreateIngredientSection {
  name: string | null;
  ingredients: CreateRecipeIngredient[];
}

export interface CreateInstructionSection {
  name: string | null;
  instructions: CreateRecipeInstruction[];
}

export interface CreateRecipeImage {
  url: string;
}

export type SourceType = "url" | "image" | "text" | "ai" | "manual" | "user";

export interface CreateRecipeInput {
  name: string;
  ingredientSections: CreateIngredientSection[];
  instructionSections: CreateInstructionSection[];
  // Either images (direct URLs) or imageUploadIds (temp keys to be moved)
  images?: CreateRecipeImage[];
  imageUploadIds?: string[];
  sourceUrl?: string;
  sourceType?: SourceType;
  categories?: string[];
  cuisines?: string[];
  description?: string;
  prepTime?: number; // minutes
  cookTime?: number; // minutes
  totalTime?: number; // minutes
  servings: number;
}

export type { ImageWorkerService };

export interface IngredientSectionWithItems {
  id: number;
  name: string | null;
  index: number;
  ingredients: {
    id: number;
    index: number;
    quantity: string | null;
    unit: string | null;
    name: string;
  }[];
}

export interface InstructionSectionWithItems {
  id: number;
  name: string | null;
  index: number;
  instructions: {
    id: number;
    index: number;
    instruction: string;
    imageUrl: string | null;
  }[];
}

export type RecipeWithDetails = Omit<typeof recipes.$inferSelect, "ownerId"> & {
  owner: Pick<typeof user.$inferSelect, "id" | "name" | "email" | "image">;
  images: Pick<typeof recipeImages.$inferSelect, "id" | "url">[];
  ingredientSections: IngredientSectionWithItems[];
  instructionSections: InstructionSectionWithItems[];
  userRecipesCount: number;
  collectionIds: number[];
  isInShoppingList: boolean;
  saveCount: number;
  // For recipes imported from another user
  originalOwner: Pick<typeof user.$inferSelect, "id" | "name" | "image"> | null;
};

// ─── Tag Validation ────────────────────────────────────────────────────────

/**
 * Validate that all categories and cuisines exist in the tags table
 */
export async function validateTags(
  db: DbClient,
  categories: string[] | undefined,
  cuisines: string[] | undefined,
): Promise<void> {
  // Parallelize validation queries
  const [existingCategoryTags, existingCuisineTags] = await Promise.all([
    categories && categories.length > 0
      ? db
          .select({ name: tags.name })
          .from(tags)
          .where(and(eq(tags.type, "category"), inArray(tags.name, categories)))
      : Promise.resolve([]),
    cuisines && cuisines.length > 0
      ? db
          .select({ name: tags.name })
          .from(tags)
          .where(and(eq(tags.type, "cuisine"), inArray(tags.name, cuisines)))
      : Promise.resolve([]),
  ]);

  // Validate categories
  if (categories && categories.length > 0) {
    const existingCategoryNames = existingCategoryTags.map((tag) => tag.name);
    const invalidCategories = categories.filter(
      (cat) => !existingCategoryNames.includes(cat),
    );

    if (invalidCategories.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid categories: ${invalidCategories.join(", ")}.`,
      });
    }
  }

  // Validate cuisines
  if (cuisines && cuisines.length > 0) {
    const existingCuisineNames = existingCuisineTags.map((tag) => tag.name);
    const invalidCuisines = cuisines.filter(
      (cuisine) => !existingCuisineNames.includes(cuisine),
    );

    if (invalidCuisines.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid cuisines: ${invalidCuisines.join(", ")}.`,
      });
    }
  }
}

// ─── Recipe Creation ───────────────────────────────────────────────────────

/**
 * Create a new recipe with ingredients, instructions, and images.
 * Supports both direct image URLs and uploaded image keys that need to be moved.
 */
export async function createRecipe(
  db: DbClient,
  userId: string,
  input: CreateRecipeInput,
  imageWorker?: ImageWorkerService,
  imagePublicUrl?: string,
) {
  // Validate that we have either images or imageUploadIds
  const hasDirectImages = input.images && input.images.length > 0;
  const hasUploadIds = input.imageUploadIds && input.imageUploadIds.length > 0;

  if (!hasDirectImages && !hasUploadIds) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one image is required",
    });
  }

  // Use transaction to ensure all inserts succeed or all fail
  return await db.transaction(async (tx) => {
    // Insert recipe
    const recipe = await tx
      .insert(recipes)
      .values({
        name: input.name,
        description: input.description || null,
        sourceUrl: input.sourceUrl || null,
        sourceType: input.sourceType || "manual",
        prepTime: input.prepTime || null,
        cookTime: input.cookTime || null,
        totalTime: input.totalTime || null,
        servings: input.servings,
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerId: userId,
      })
      .returning()
      .then((rows) => rows[0]);

    if (!recipe) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create recipe",
      });
    }

    // Insert ingredient sections and their items
    const insertedIngredientSections: IngredientSectionWithItems[] = [];
    for (
      let sectionIdx = 0;
      sectionIdx < input.ingredientSections.length;
      sectionIdx++
    ) {
      const section = input.ingredientSections[sectionIdx]!;

      // Insert section
      const [insertedSection] = await tx
        .insert(ingredientSections)
        .values({
          recipeId: recipe.id,
          name: section.name,
          index: sectionIdx,
        })
        .returning();

      if (!insertedSection) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create ingredient section",
        });
      }

      // Parse and insert ingredients for this section
      const parsedIngredients = section.ingredients.map((ing) => {
        if (ing.ingredient) {
          const parsed = parseIngredient(ing.ingredient);
          return {
            index: ing.index,
            quantity: parsed.quantity?.toString() || null,
            unit: normalizeUnit(parsed.unit),
            name: parsed.name,
          };
        }
        return {
          index: ing.index,
          quantity: ing.quantity || null,
          unit: normalizeUnit(ing.unit || null),
          name: ing.name || "",
        };
      });

      const insertedIngredients =
        parsedIngredients.length > 0
          ? await tx
              .insert(recipeIngredients)
              .values(
                parsedIngredients.map((ingredient) => ({
                  sectionId: insertedSection.id,
                  index: ingredient.index,
                  quantity: ingredient.quantity,
                  unit: ingredient.unit,
                  name: ingredient.name,
                })),
              )
              .returning({
                id: recipeIngredients.id,
                index: recipeIngredients.index,
                quantity: recipeIngredients.quantity,
                unit: recipeIngredients.unit,
                name: recipeIngredients.name,
              })
          : [];

      insertedIngredientSections.push({
        id: insertedSection.id,
        name: insertedSection.name,
        index: insertedSection.index,
        ingredients: insertedIngredients,
      });
    }

    // Insert instruction sections and their items
    const insertedInstructionSections: InstructionSectionWithItems[] = [];
    for (
      let sectionIdx = 0;
      sectionIdx < input.instructionSections.length;
      sectionIdx++
    ) {
      const section = input.instructionSections[sectionIdx]!;

      // Insert section
      const [insertedSection] = await tx
        .insert(instructionSections)
        .values({
          recipeId: recipe.id,
          name: section.name,
          index: sectionIdx,
        })
        .returning();

      if (!insertedSection) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create instruction section",
        });
      }

      // Insert instructions for this section
      const insertedInstructions =
        section.instructions.length > 0
          ? await tx
              .insert(recipeInstructions)
              .values(
                section.instructions.map((instruction) => ({
                  sectionId: insertedSection.id,
                  index: instruction.index,
                  instruction: instruction.instruction,
                  imageUrl: instruction.imageUrl || null,
                })),
              )
              .returning({
                id: recipeInstructions.id,
                index: recipeInstructions.index,
                instruction: recipeInstructions.instruction,
                imageUrl: recipeInstructions.imageUrl,
              })
          : [];

      insertedInstructionSections.push({
        id: insertedSection.id,
        name: insertedSection.name,
        index: insertedSection.index,
        instructions: insertedInstructions,
      });
    }

    // Handle images - either direct URLs or uploaded keys
    let imageUrls: string[];

    if (hasUploadIds && imageWorker && imagePublicUrl) {
      // Move images from temp to permanent location
      const moves = input.imageUploadIds!.map((uploadId) => {
        // Extract extension from upload key (temp/{uuid}.{ext})
        const ext = uploadId.split(".").pop() || "jpg";
        const imageId = crypto.randomUUID();
        const permanentKey = `recipes/covers/${recipe.id}/${imageId}.${ext}`;
        return { from: uploadId, to: permanentKey };
      });

      const moveResult = await imageWorker.move(moves);

      if (!moveResult.success) {
        const failedMoves = moveResult.results.filter((r) => !r.success);
        const errorDetails = failedMoves
          .map((r) => `${r.from} -> ${r.to}: ${r.error}`)
          .join(", ");
        console.error("Failed to move uploaded images:", errorDetails);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to move uploaded images: ${errorDetails}`,
        });
      }

      // Generate public URLs from permanent keys
      imageUrls = moves.map((move) => `${imagePublicUrl}/${move.to}`);
    } else if (hasDirectImages) {
      // Use direct URLs as-is
      imageUrls = input.images!.map((img) => img.url);
    } else {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No valid images provided",
      });
    }

    // Insert images
    const images = await tx
      .insert(recipeImages)
      .values(
        imageUrls.map((url) => ({
          recipeId: recipe.id,
          url,
        })),
      )
      .returning({
        url: recipeImages.url,
      });

    return {
      ...recipe,
      ingredientSections: insertedIngredientSections,
      instructionSections: insertedInstructionSections,
      images,
    };
  });
}

// ─── Recipe Detail ─────────────────────────────────────────────────────────

/**
 * Get detailed information about a recipe including all related data
 */
export async function getRecipeDetail(
  db: DbClient,
  recipeId: number,
  userId: string,
): Promise<RecipeWithDetails> {
  // Alias user table for original owner
  const originalUser = alias(user, "original_user");

  // Single query with all aggregations and checks using Drizzle helpers
  const recipeData = await db
    .select({
      recipe: recipes,
      uploader: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      originalOwner: {
        id: originalUser.id,
        name: originalUser.name,
        image: originalUser.image,
      },
      // Scalar subquery: count of saves for this recipe
      saveCount: sql<number>`(
        SELECT CAST(COUNT(DISTINCT ${recipeCollections.id}) AS INTEGER)
        FROM ${recipeCollections}
        WHERE ${recipeCollections.recipeId} = ${recipes.id}
      )`,
      // Scalar subquery: total recipes by this owner
      ownerRecipeCount: sql<number>`(
        SELECT CAST(COUNT(*) AS INTEGER)
        FROM ${recipes} r
        WHERE r.owner_id = ${recipes.ownerId}
      )`,
      // EXISTS: check if recipe is in current user's shopping list
      isInShoppingList: sql<boolean>`EXISTS(
        SELECT 1 FROM ${shoppingListRecipes}
        INNER JOIN ${shoppingLists} ON ${shoppingListRecipes.shoppingListId} = ${shoppingLists.id}
        WHERE ${shoppingListRecipes.recipeId} = ${recipes.id}
        AND ${shoppingLists.userId} = ${userId}
      )`,
    })
    .from(recipes)
    .innerJoin(user, eq(recipes.ownerId, user.id))
    .leftJoin(originalUser, eq(recipes.originalOwnerId, originalUser.id))
    .where(eq(recipes.id, recipeId))
    .then((rows) => rows[0]);

  if (!recipeData) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Recipe not found",
    });
  }

  // Access control: URL-scraped recipes can only be viewed by their owner
  if (
    recipeData.recipe.sourceType === "url" &&
    recipeData.recipe.ownerId !== userId
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This recipe can only be viewed on the original source website.",
      cause: {
        sourceUrl: recipeData.recipe.sourceUrl,
        recipeName: recipeData.recipe.name,
      },
    });
  }

  // Get collection IDs for this recipe and current user
  const userRecipeCollections = await db
    .select({ collectionId: recipeCollections.collectionId })
    .from(recipeCollections)
    .innerJoin(collections, eq(recipeCollections.collectionId, collections.id))
    .where(
      and(
        eq(recipeCollections.recipeId, recipeId),
        eq(collections.userId, userId),
      ),
    );

  const collectionIds = userRecipeCollections.map((rc) => rc.collectionId);

  // Parallelize remaining queries - fetch sections with their items
  const [
    images,
    ingredientSectionsData,
    ingredientsData,
    instructionSectionsData,
    instructionsData,
  ] = await Promise.all([
    db
      .select({ id: recipeImages.id, url: recipeImages.url })
      .from(recipeImages)
      .where(eq(recipeImages.recipeId, recipeId)),

    db
      .select({
        id: ingredientSections.id,
        name: ingredientSections.name,
        index: ingredientSections.index,
      })
      .from(ingredientSections)
      .where(eq(ingredientSections.recipeId, recipeId))
      .orderBy(ingredientSections.index),

    db
      .select({
        id: recipeIngredients.id,
        sectionId: recipeIngredients.sectionId,
        index: recipeIngredients.index,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        name: recipeIngredients.name,
      })
      .from(recipeIngredients)
      .innerJoin(
        ingredientSections,
        eq(recipeIngredients.sectionId, ingredientSections.id),
      )
      .where(eq(ingredientSections.recipeId, recipeId))
      .orderBy(recipeIngredients.index),

    db
      .select({
        id: instructionSections.id,
        name: instructionSections.name,
        index: instructionSections.index,
      })
      .from(instructionSections)
      .where(eq(instructionSections.recipeId, recipeId))
      .orderBy(instructionSections.index),

    db
      .select({
        id: recipeInstructions.id,
        sectionId: recipeInstructions.sectionId,
        index: recipeInstructions.index,
        instruction: recipeInstructions.instruction,
        imageUrl: recipeInstructions.imageUrl,
      })
      .from(recipeInstructions)
      .innerJoin(
        instructionSections,
        eq(recipeInstructions.sectionId, instructionSections.id),
      )
      .where(eq(instructionSections.recipeId, recipeId))
      .orderBy(recipeInstructions.index),
  ]);

  // Group ingredients by section
  const ingredientsBySection = new Map<number, typeof ingredientsData>();
  for (const ing of ingredientsData) {
    const existing = ingredientsBySection.get(ing.sectionId) || [];
    existing.push(ing);
    ingredientsBySection.set(ing.sectionId, existing);
  }

  // Group instructions by section
  const instructionsBySection = new Map<number, typeof instructionsData>();
  for (const inst of instructionsData) {
    const existing = instructionsBySection.get(inst.sectionId) || [];
    existing.push(inst);
    instructionsBySection.set(inst.sectionId, existing);
  }

  // Build nested structure
  const ingredientSectionsNested: IngredientSectionWithItems[] =
    ingredientSectionsData.map((section) => ({
      id: section.id,
      name: section.name,
      index: section.index,
      ingredients: (ingredientsBySection.get(section.id) || []).map((ing) => ({
        id: ing.id,
        index: ing.index,
        quantity: ing.quantity,
        unit: ing.unit,
        name: ing.name,
      })),
    }));

  const instructionSectionsNested: InstructionSectionWithItems[] =
    instructionSectionsData.map((section) => ({
      id: section.id,
      name: section.name,
      index: section.index,
      instructions: (instructionsBySection.get(section.id) || []).map(
        (inst) => ({
          id: inst.id,
          index: inst.index,
          instruction: inst.instruction,
          imageUrl: inst.imageUrl,
        }),
      ),
    }));

  // originalOwner is null if the recipe wasn't imported from another user
  const originalOwner =
    recipeData.recipe.originalOwnerId && recipeData.originalOwner?.id
      ? recipeData.originalOwner
      : null;

  return {
    ...recipeData.recipe,
    owner: recipeData.uploader,
    images,
    ingredientSections: ingredientSectionsNested,
    instructionSections: instructionSectionsNested,
    userRecipesCount: recipeData.ownerRecipeCount,
    collectionIds,
    isInShoppingList: recipeData.isInShoppingList,
    saveCount: recipeData.saveCount,
    originalOwner,
  };
}

// ─── Recipe Import ──────────────────────────────────────────────────────────

/**
 * Import a recipe from another user, creating a copy in the current user's library
 */
export async function importRecipe(
  db: DbClient,
  userId: string,
  sourceRecipeId: number,
): Promise<{ id: number }> {
  const result = await db.transaction(async (tx) => {
    // Fetch source recipe
    const sourceRecipe = await tx
      .select()
      .from(recipes)
      .where(eq(recipes.id, sourceRecipeId))
      .then((rows) => rows[0]);

    if (!sourceRecipe) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Recipe not found",
      });
    }

    // Prevent importing own recipe
    if (sourceRecipe.ownerId === userId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot import your own recipe",
      });
    }

    // Check for duplicate imports
    const existingImport = await tx
      .select({ id: recipes.id })
      .from(recipes)
      .where(
        and(
          eq(recipes.ownerId, userId),
          eq(recipes.originalRecipeId, sourceRecipeId),
        ),
      )
      .then((rows) => rows[0]);

    if (existingImport) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You have already imported this recipe",
      });
    }

    // Create the new recipe
    const [newRecipe] = await tx
      .insert(recipes)
      .values({
        name: sourceRecipe.name,
        description: sourceRecipe.description,
        prepTime: sourceRecipe.prepTime,
        cookTime: sourceRecipe.cookTime,
        totalTime: sourceRecipe.totalTime,
        servings: sourceRecipe.servings,
        nutrition: sourceRecipe.nutrition,
        sourceUrl: null, // Clear URL since it's user-imported
        sourceType: "user",
        originalRecipeId: sourceRecipeId,
        originalOwnerId: sourceRecipe.ownerId,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: recipes.id });

    if (!newRecipe) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create recipe copy",
      });
    }

    // Fetch and copy images
    const sourceImages = await tx
      .select({ url: recipeImages.url })
      .from(recipeImages)
      .where(eq(recipeImages.recipeId, sourceRecipeId));

    if (sourceImages.length > 0) {
      await tx.insert(recipeImages).values(
        sourceImages.map((img) => ({
          recipeId: newRecipe.id,
          url: img.url,
        })),
      );
    }

    // Fetch source ingredient sections with their ingredients
    const sourceIngSections = await tx
      .select({
        id: ingredientSections.id,
        name: ingredientSections.name,
        index: ingredientSections.index,
      })
      .from(ingredientSections)
      .where(eq(ingredientSections.recipeId, sourceRecipeId))
      .orderBy(ingredientSections.index);

    // Copy ingredient sections and their items
    for (const section of sourceIngSections) {
      const [newSection] = await tx
        .insert(ingredientSections)
        .values({
          recipeId: newRecipe.id,
          name: section.name,
          index: section.index,
        })
        .returning({ id: ingredientSections.id });

      if (newSection) {
        const sourceIngs = await tx
          .select({
            index: recipeIngredients.index,
            quantity: recipeIngredients.quantity,
            unit: recipeIngredients.unit,
            name: recipeIngredients.name,
          })
          .from(recipeIngredients)
          .where(eq(recipeIngredients.sectionId, section.id))
          .orderBy(recipeIngredients.index);

        if (sourceIngs.length > 0) {
          await tx.insert(recipeIngredients).values(
            sourceIngs.map((ing) => ({
              sectionId: newSection.id,
              index: ing.index,
              quantity: ing.quantity,
              unit: ing.unit,
              name: ing.name,
            })),
          );
        }
      }
    }

    // Fetch source instruction sections with their instructions
    const sourceInstSections = await tx
      .select({
        id: instructionSections.id,
        name: instructionSections.name,
        index: instructionSections.index,
      })
      .from(instructionSections)
      .where(eq(instructionSections.recipeId, sourceRecipeId))
      .orderBy(instructionSections.index);

    // Copy instruction sections and their items
    for (const section of sourceInstSections) {
      const [newSection] = await tx
        .insert(instructionSections)
        .values({
          recipeId: newRecipe.id,
          name: section.name,
          index: section.index,
        })
        .returning({ id: instructionSections.id });

      if (newSection) {
        const sourceInsts = await tx
          .select({
            index: recipeInstructions.index,
            instruction: recipeInstructions.instruction,
            imageUrl: recipeInstructions.imageUrl,
          })
          .from(recipeInstructions)
          .where(eq(recipeInstructions.sectionId, section.id))
          .orderBy(recipeInstructions.index);

        if (sourceInsts.length > 0) {
          await tx.insert(recipeInstructions).values(
            sourceInsts.map((inst) => ({
              sectionId: newSection.id,
              index: inst.index,
              instruction: inst.instruction,
              imageUrl: inst.imageUrl,
            })),
          );
        }
      }
    }

    // Fetch and copy tags
    const sourceTags = await tx
      .select({ tagId: recipeTags.tagId })
      .from(recipeTags)
      .where(eq(recipeTags.recipeId, sourceRecipeId));

    if (sourceTags.length > 0) {
      await tx.insert(recipeTags).values(
        sourceTags.map((tag) => ({
          recipeId: newRecipe.id,
          tagId: tag.tagId,
        })),
      );
    }

    return newRecipe;
  });

  if (!result) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to import recipe",
    });
  }

  return result;
}
