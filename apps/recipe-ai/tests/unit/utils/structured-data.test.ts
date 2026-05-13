import { describe, expect, it } from "vitest";

import { extractStructuredRecipe } from "../../../src/utils/structured-data";

describe("extractStructuredRecipe", () => {
  it("decodes HTML entities from structured recipe text", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Nana&#039;s Fish &amp; Chips",
              "description": "Crispy&nbsp;chips &rsquo;n caf&eacute; sauce",
              "image": "https://example.com/image.jpg?name=fish&amp;size=large",
              "recipeYield": "Serves&nbsp;4",
              "recipeCuisine": "British &amp; Irish",
              "recipeCategory": "Main&nbsp;course",
              "recipeIngredient": [
                "2&nbsp;cups potatoes",
                "1 tbsp chef&#039;s sauce"
              ],
              "recipeInstructions": [
                {
                  "@type": "HowToSection",
                  "name": "Chef&#039;s prep",
                  "itemListElement": [
                    {
                      "@type": "HowToStep",
                      "text": "Mix &amp; fry until it&#039;s crisp."
                    }
                  ]
                }
              ]
            }
          </script>
        </head>
      </html>
    `;

    const recipe = extractStructuredRecipe(html, "https://example.com/recipe");

    expect(recipe).not.toBeNull();
    expect(recipe?.name).toBe("Nana's Fish & Chips");
    expect(recipe?.description).toBe("Crispy chips 'n caf\u00e9 sauce");
    expect(recipe?.servings).toBe(4);
    expect(recipe?.images).toEqual([
      "https://example.com/image.jpg?name=fish&size=large",
    ]);
    expect(recipe?.ingredientSections[0]?.ingredients[0]?.name).toBe(
      "potatoes",
    );
    expect(recipe?.ingredientSections[0]?.ingredients[1]?.name).toBe(
      "chef's sauce",
    );
    expect(recipe?.instructionSections[0]?.name).toBe("Chef's prep");
    expect(recipe?.instructionSections[0]?.instructions[0]?.instruction).toBe(
      "Mix & fry until it's crisp.",
    );
    expect(recipe?.suggestedTags).toEqual([
      { type: "cuisine", name: "British & Irish" },
      { type: "meal_type", name: "Main course" },
    ]);
  });
});
