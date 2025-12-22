/**
 * Test script for AI parsing
 *
 * Usage:
 * 1. In one terminal: cd apps/recipe-parser && wrangler dev --remote
 * 2. In another terminal: bun run scripts/test-ai.ts
 */

const BASE_URL = "http://192.168.0.87:8787";

// ============================================
// TEST URL - Replace with your recipe URL
// ============================================
const TEST_RECIPE_URL =
  "https://barbecuebible.com/recipe/jamaican-jerk-chicken/";

// Test text input (for AI-only parsing)
const TEST_TEXT = `
Grandma's Famous Apple Pie

A traditional family recipe passed down through generations.

Ingredients:
- 6 cups thinly sliced apples
- 3/4 cup white sugar
- 2 tablespoons all-purpose flour
- 1 teaspoon ground cinnamon
- 1/4 teaspoon ground nutmeg
- 1 tablespoon butter

Instructions:
1. Preheat oven to 425 degrees F (220 degrees C).
2. Mix sugar, flour, cinnamon, and nutmeg together in a bowl.
3. Toss apples in the sugar mixture until evenly coated.
4. Pour apple mixture into the pie crust and dot with butter.
5. Cover with top crust, seal edges, and cut slits in top.
6. Bake for 45 to 50 minutes until crust is golden brown.

Serves 8 people.
`;

async function testUrl() {
  console.log("\n🔗 Testing URL parsing...");
  console.log(`   URL: ${TEST_RECIPE_URL}\n`);

  const response = await fetch(`${BASE_URL}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "url",
      data: TEST_RECIPE_URL,
    }),
  });

  const result = await response.json();
  console.log("Result:", JSON.stringify(result, null, 2));
  return result;
}

async function testText() {
  console.log("\n📝 Testing text parsing (AI-only)...\n");

  const response = await fetch(`${BASE_URL}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "text",
      data: TEST_TEXT,
    }),
  });

  const result = await response.json();
  console.log("Result:", JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log("🧪 Recipe Parser AI Test\n");
  console.log("Make sure wrangler dev --remote is running!\n");
  console.log("=".repeat(50));

  try {
    await testUrl();

    console.log("\n" + "=".repeat(50));

    await testText();

    console.log("\n" + "=".repeat(50));
    console.log("\n✅ Tests complete!\n");
  } catch (error) {
    console.error("\n❌ Error:", error);
    console.log("\nMake sure wrangler dev --remote is running on port 8787");
  }
}

main();
