import { describe, expect, it } from "vitest";

import {
  extractMarkdownRecipeCard,
  extractVisibleRecipeCard,
} from "../../../src/utils/visible-recipe-card";

describe("extractVisibleRecipeCard", () => {
  it("extracts The Kitchn-style visible recipe cards", () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Italian Love Cake</h1>
            <p>Made with boxed chocolate cake mix.</p>
            <h2>Italian Love Cake Recipe</h2>
            <p>Made with boxed chocolate cake mix, instant chocolate pudding, and Cool Whip.</p>
            <p>Prep time 25 minutes</p>
            <p>Cook time 1 hour 10 minutes</p>
            <p>Serves 16 to 20</p>
            <h3>Ingredients</h3>
            <h4>For the cake:</h4>
            <ul>
              <li>Cooking spray</li>
              <li>1 (15.25-ounce) box chocolate cake mix</li>
              <li>2 pounds whole-milk ricotta cheese</li>
            </ul>
            <h4>For the topping:</h4>
            <ul>
              <li>1 (8-ounce) container Cool Whip, thawed</li>
              <li>2 cups cold whole milk</li>
            </ul>
            <h3>Instructions</h3>
            <h4>Make the cake:</h4>
            <ol>
              <li>Heat the oven to 350°F.</li>
              <li>Prepare the cake mix.</li>
            </ol>
            <h4>Make the topping:</h4>
            <ol>
              <li>Whisk the pudding mix and milk together.</li>
            </ol>
            <h3>Recipe Notes</h3>
            <p>Storage details.</p>
          </article>
        </body>
      </html>
    `;

    const recipe = extractVisibleRecipeCard(
      html,
      "https://www.thekitchn.com/italian-love-cake-recipe-23709352",
    );

    expect(recipe).not.toBeNull();
    expect(recipe?.name).toBe("Italian Love Cake");
    expect(recipe?.prepTime).toBe(25);
    expect(recipe?.cookTime).toBe(70);
    expect(recipe?.servings).toBe(18);
    expect(recipe?.ingredientSections).toHaveLength(2);
    expect(recipe?.ingredientSections[0]?.name).toBe("For the cake");
    expect(recipe?.ingredientSections[0]?.ingredients[1]?.name).toBe(
      "(15.25-ounce) chocolate cake mix",
    );
    expect(recipe?.instructionSections).toHaveLength(2);
    expect(recipe?.instructionSections[1]?.name).toBe("Make the topping");
    expect(recipe?.instructionSections[1]?.instructions[0]?.instruction).toBe(
      "Whisk the pudding mix and milk together.",
    );
  });
});

describe("extractMarkdownRecipeCard", () => {
  it("extracts The Kitchn reader markdown", () => {
    const markdown = `
Title: My "Italian Love Cake" Is So Melt-in-Your-Mouth Delicious

Markdown Content:
Made with boxed chocolate cake mix, instant chocolate pudding, and Cool Whip, this easy cake is perfect for any occasion.

![Image 1: Kayla Hoang](blob:http://localhost/author)

![Image 2: a slice of Italian love cake on a plate with a bite taken out](https://cdn.apartmenttherapy.info/image/upload/f_auto,q_auto:eco,c_fit,w_730,h_548/k%2FPhoto%2FRecipes%2F2025-02-italian-love-cake%2Fitalian-love-cake-386)

[Serves 16 to 20 Prep 25 minutes Cook 1 hour 10 minutes](https://www.thekitchn.com/italian-love-cake-recipe-23709352#post-recipe-717370004)

### Ingredients

#### For the cake:

*   Cooking spray

*   1 (15.25-ounce) box 
chocolate cake mix

*   2 pounds 
whole-milk ricotta cheese

#### For the topping:

*   1  (8-ounce) container 
Cool Whip, thawed

*   2 cups 
cold whole milk

#### Make the cake:

1.   Heat the oven to 350°F.

2.   Prepare the cake mix.

#### Make the topping:

1.   Whisk the pudding mix and milk together.

### Recipe Notes
Storage details.
    `;

    const recipe = extractMarkdownRecipeCard(
      markdown,
      "https://www.thekitchn.com/italian-love-cake-recipe-23709352",
    );

    expect(recipe).not.toBeNull();
    expect(recipe?.name).toBe("Italian Love Cake");
    expect(recipe?.prepTime).toBe(25);
    expect(recipe?.cookTime).toBe(70);
    expect(recipe?.servings).toBe(18);
    expect(recipe?.description).toBe(
      "Made with boxed chocolate cake mix, instant chocolate pudding, and Cool Whip, this easy cake is perfect for any occasion.",
    );
    expect(recipe?.ingredientSections[0]?.ingredients[1]?.name).toBe(
      "(15.25-ounce) chocolate cake mix",
    );
    expect(recipe?.ingredientSections[0]?.ingredients[1]?.quantity).toBe(1);
    expect(recipe?.ingredientSections[0]?.ingredients[1]?.unit).toBe("box");
    expect(recipe?.ingredientSections[0]?.ingredients[2]?.quantity).toBe(2);
    expect(recipe?.ingredientSections[0]?.ingredients[2]?.unit).toBe("pound");
    expect(recipe?.ingredientSections[0]?.ingredients[2]?.name).toBe(
      "whole-milk ricotta cheese",
    );
    expect(recipe?.instructionSections[0]?.instructions[0]?.instruction).toBe(
      "Heat the oven to 350°F.",
    );
    expect(recipe?.images).toEqual([
      "https://cdn.apartmenttherapy.info/image/upload/f_auto,q_auto:eco,c_fit,w_730,h_548/k%2FPhoto%2FRecipes%2F2025-02-italian-love-cake%2Fitalian-love-cake-386",
    ]);
  });

  it("handles reader markdown with a plain instructions heading", () => {
    const markdown = `
Title: Blueberry Dump Cake Recipe

Markdown Content:
You only need four ingredients for this summer dessert.

![Image 8: bowl of blueberry dump cake with ice cream in the center](https://cdn.apartmenttherapy.info/image/upload/f_auto,q_auto:eco,c_fill,g_center,w_730,h_913/k%2FPhoto%2FRecipes%2F2024-blueberry-dump-cake%2Fblueberry-dump-cake-1069-1)

Prep time 10 minutes

Cook time 1 hour to 1 hour 5 minutes

Serves 6 to 8

### Ingredients

*   2 (about 21-ounce) cans 
blueberry pie filling

*   1 (15.25-ounce) box 
yellow, white, or lemon cake mix

### Instructions

1.   Arrange a rack in the middle of the oven and heat the oven to 350°F.
2.   Layer the ingredients in the baking dish.
3.   Bake until golden brown.

### Recipe Notes
Storage details.
    `;

    const recipe = extractMarkdownRecipeCard(
      markdown,
      "https://www.thekitchn.com/blueberry-dump-cake-recipe-23543877",
    );

    expect(recipe).not.toBeNull();
    expect(recipe?.name).toBe("Blueberry Dump Cake");
    expect(recipe?.prepTime).toBe(10);
    expect(recipe?.cookTime).toBe(60);
    expect(recipe?.servings).toBe(7);
    expect(recipe?.description).toBe(
      "You only need four ingredients for this summer dessert.",
    );
    expect(recipe?.ingredientSections[0]?.ingredients).toHaveLength(2);
    expect(recipe?.ingredientSections[0]?.ingredients[0]?.quantity).toBe(2);
    expect(recipe?.ingredientSections[0]?.ingredients[0]?.unit).toBe("can");
    expect(recipe?.instructionSections[0]?.instructions).toHaveLength(3);
    expect(recipe?.images).toEqual([
      "https://cdn.apartmenttherapy.info/image/upload/f_auto,q_auto:eco,c_fill,g_center,w_730,h_913/k%2FPhoto%2FRecipes%2F2024-blueberry-dump-cake%2Fblueberry-dump-cake-1069-1",
    ]);
  });
});
