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

  it("extracts explicit TikTok ingredient and direction sections", () => {
    const caption =
      "Cool, creamy, and ready in 15 — this cucumber avocado blender soup will be your new go-to summer dish. 🥒🥑 Ingredients: Soup 2 English cucumbers, peeled and chopped 2 avocados, peeled and pitted ¼ bunch fresh parsley ¼ bunch fresh mint Juice of 1 lime 1 cup Greek yogurt Kosher salt and freshly ground black pepper Garnishes 1 baguette, halved horizontally 3 tablespoons soft unsalted butter 1⅓ cups shredded Asiago cheese ½ cup Greek yogurt Juice of 2 limes Directions: 1. Make the Soup: In a blender, puree the cucumbers, avocado, parsley, mint, lime juice and Greek yogurt until smooth. Season with salt and pepper. 2. Make the Garnishes: Preheat the oven to 425°F. Place the baguette, cut sides up, on a parchment-lined baking sheet. Butter the baguette and top with the Asiago cheese. Bake until the cheese is fully melted and golden brown, 10 to 12 minutes. 3. Meanwhile, in a small bowl, whisk together the Greek yogurt and lime juice. 4. Serve the soup topped with the lime yogurt and with the warm, cheesy baguette on the side. #summerrecipes #cucumber #avocado #blendersoup #blender #summer #soup";

    const recipe = extractSocialCaptionRecipe(
      caption,
      "https://www.tiktok.com/@recipes/video/7500976227814100231",
      ["https://example.com/cucumber-soup.jpg"],
    );

    expect(recipe).not.toBeNull();
    expect(recipe?.name).toBe("Cucumber Avocado Blender Soup");
    expect(recipe?.prepTime).toBe(15);
    expect(recipe?.totalTime).toBe(15);
    expect(recipe?.images).toEqual(["https://example.com/cucumber-soup.jpg"]);

    expect(recipe?.ingredientSections).toHaveLength(2);
    expect(recipe?.ingredientSections[0]?.name).toBe("Soup");
    expect(recipe?.ingredientSections[0]?.ingredients).toEqual([
      expect.objectContaining({
        quantity: 2,
        unit: null,
        name: "English cucumbers, peeled and chopped",
      }),
      expect.objectContaining({
        quantity: 2,
        unit: null,
        name: "avocados, peeled and pitted",
      }),
      expect.objectContaining({
        quantity: 0.25,
        unit: "bunch",
        name: "fresh parsley",
      }),
      expect.objectContaining({
        quantity: 0.25,
        unit: "bunch",
        name: "fresh mint",
      }),
      expect.objectContaining({
        quantity: null,
        unit: null,
        name: "Juice of 1 lime",
      }),
      expect.objectContaining({
        quantity: 1,
        unit: "cup",
        name: "Greek yogurt",
      }),
      expect.objectContaining({
        quantity: null,
        unit: null,
        name: "Kosher salt and freshly ground black pepper",
      }),
    ]);

    expect(recipe?.ingredientSections[1]?.name).toBe("Garnishes");
    expect(recipe?.ingredientSections[1]?.ingredients).toEqual([
      expect.objectContaining({
        quantity: 1,
        unit: null,
        name: "baguette, halved horizontally",
      }),
      expect.objectContaining({
        quantity: 3,
        unit: "tablespoon",
        name: "soft unsalted butter",
      }),
      expect.objectContaining({
        quantity: 1.3333333333333333,
        unit: "cup",
        name: "shredded Asiago cheese",
      }),
      expect.objectContaining({
        quantity: 0.5,
        unit: "cup",
        name: "Greek yogurt",
      }),
      expect.objectContaining({
        quantity: null,
        unit: null,
        name: "Juice of 2 limes",
      }),
    ]);

    expect(recipe?.instructionSections[0]?.instructions).toHaveLength(4);
    expect(
      recipe?.instructionSections[0]?.instructions[1]?.instruction,
    ).toContain("Preheat the oven to 425°F");
    expect(
      recipe?.instructionSections[0]?.instructions[1]?.instruction,
    ).toContain("10 to 12 minutes");
  });

  it("extracts asterisk bullet ingredient captions", () => {
    const caption =
      "Incorporate some beautiful spring colors this Easter with these festive deviled eggs🐣 Ingredients: * 6 hard boiled egg yolks * 2 tbs. mayo * 1 tsp. mustard * salt, pepper, paprika to taste * red, yellow, blue, & green food dye #easter #deviledeggs #spring #festive #appetizer #inspo #recipe #fyp";

    const recipe = extractSocialCaptionRecipe(
      caption,
      "https://www.tiktok.com/@recipes/video/7483508735067933960",
      ["https://example.com/deviled-eggs.jpg"],
    );

    expect(recipe).not.toBeNull();
    expect(recipe?.ingredientSections[0]?.ingredients).toEqual([
      expect.objectContaining({
        quantity: 6,
        unit: null,
        name: "hard boiled egg yolks",
      }),
      expect.objectContaining({
        quantity: 2,
        unit: "tablespoon",
        name: "mayo",
      }),
      expect.objectContaining({
        quantity: 1,
        unit: "teaspoon",
        name: "mustard",
      }),
      expect.objectContaining({
        quantity: null,
        unit: null,
        name: "salt, pepper, paprika to taste",
      }),
      expect.objectContaining({
        quantity: null,
        unit: null,
        name: "red, yellow, blue, & green food dye",
      }),
    ]);
    expect(recipe?.instructionSections[0]?.instructions[0]?.instruction).toBe(
      "Follow the method shown in the source video using the listed ingredients.",
    );
  });
});
