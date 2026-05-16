import { describe, expect, it } from "vitest";

import { extractSocialCaptionRecipe } from "../../../src/utils/social-caption-recipe";

describe("extractSocialCaptionRecipe", () => {
  it("extracts compact TikTok ingredient captions", () => {
    const caption =
      "fudgy browniess🤤 recipe by Handle the Heat: 5 tbsp butter 1 1/4 cups sugar 2 eggs plus 1 egg yolk 1 tsp vanilla 1/3 cup vegetable oil 3/4 cup cocoa powder 1/2 cup flour 1/8 tsp baking soda 1 tbsp cornstarch 1/4 tsp salt 3/4 cup chocolate chips #brownies #fudgybrownies #brownierecipe";

    const recipe = extractSocialCaptionRecipe(
      caption,
      "https://www.tiktok.com/@thelittlecakela/video/7208369840007007531",
      ["https://example.com/thumb.jpg"],
    );

    expect(recipe).not.toBeNull();
    expect(recipe?.name).toBe("Fudgy Brownies");
    expect(recipe?.description).toBe("Recipe by Handle the Heat.");
    expect(recipe?.images).toEqual(["https://example.com/thumb.jpg"]);
    expect(recipe?.ingredientSections[0]?.ingredients).toHaveLength(11);
    expect(recipe?.ingredientSections[0]?.ingredients[1]).toMatchObject({
      quantity: 1.25,
      unit: "cup",
      name: "sugar",
    });
    expect(recipe?.ingredientSections[0]?.ingredients[2]).toMatchObject({
      quantity: 2,
      unit: null,
      name: "eggs plus 1 egg yolk",
    });
    expect(recipe?.instructionSections[0]?.instructions[0]?.instruction).toBe(
      "Follow the method shown in the source video using the listed ingredients.",
    );
  });
});
