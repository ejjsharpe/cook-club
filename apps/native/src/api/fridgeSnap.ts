import type { Outputs } from "@repo/trpc/client";
import { useTRPC } from "@repo/trpc/client";
import { useMutation } from "@tanstack/react-query";

// API Response Types
export type IdentifyIngredientsResult =
  Outputs["recipe"]["identifyIngredientsFromImage"];
export type RecipeSuggestionsResult = Outputs["recipe"]["getRecipeSuggestions"];
export type RecipeSuggestion = RecipeSuggestionsResult["suggestions"][number];
export type GeneratedRecipeResult =
  Outputs["recipe"]["generateRecipeFromSuggestion"];

// Identify ingredients from fridge image
export const useIdentifyIngredients = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.recipe.identifyIngredientsFromImage.mutationOptions({
      retry: false,
    }),
  );
};

// Get recipe suggestions from ingredients
export const useGetRecipeSuggestions = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.recipe.getRecipeSuggestions.mutationOptions({
      retry: false,
    }),
  );
};

// Generate full recipe from a suggestion
export const useGenerateRecipeFromSuggestion = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.recipe.generateRecipeFromSuggestion.mutationOptions({
      retry: false,
    }),
  );
};
