import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { filterSelectedRecipeIngredients } from "./shopping-router";

const ingredients = [
  { id: 1, quantity: "2", unit: "cup", name: "flour" },
  { id: 2, quantity: "1", unit: null, name: "egg" },
  { id: 3, quantity: null, unit: null, name: "salt" },
];

describe("filterSelectedRecipeIngredients", () => {
  it("returns every recipe ingredient when no selection is provided", () => {
    expect(filterSelectedRecipeIngredients(ingredients)).toEqual(ingredients);
  });

  it("returns only selected recipe ingredients", () => {
    expect(filterSelectedRecipeIngredients(ingredients, [3, 1])).toEqual([
      ingredients[0],
      ingredients[2],
    ]);
  });

  it("rejects empty ingredient selections", () => {
    expect(() => filterSelectedRecipeIngredients(ingredients, [])).toThrow(
      TRPCError,
    );
  });

  it("rejects ingredients that do not belong to the recipe", () => {
    expect(() =>
      filterSelectedRecipeIngredients(ingredients, [1, 999]),
    ).toThrow(TRPCError);
  });
});
