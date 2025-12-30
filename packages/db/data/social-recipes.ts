import type { RecipeData } from "./recipes";

export interface SocialRecipeData extends RecipeData {
  ownerId: string;
}

// Recipes specifically for user_013 (Chloe Harper) and user_014 (Daniel Park)
// Each has 2 Instagram recipes and 2 TikTok recipes
export const socialRecipes: SocialRecipeData[] = [
  // ─── Chloe Harper's Instagram Recipes ───────────────────────────────────────
  {
    ownerId: "user_013",
    name: "Viral Baked Feta Pasta",
    description: "The famous TikTok-turned-Instagram pasta with roasted cherry tomatoes and creamy feta cheese.",
    prepTime: 10,
    cookTime: 35,
    totalTime: 45,
    servings: 4,
    cuisines: ["Mediterranean", "Greek"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "2 pints cherry tomatoes",
      "8 oz block feta cheese",
      "1/4 cup olive oil",
      "4 cloves garlic, minced",
      "1/2 tsp red pepper flakes",
      "1 lb pasta (penne or rigatoni)",
      "Fresh basil leaves",
      "Salt and pepper to taste"
    ],
    instructions: [
      "Preheat oven to 400°F",
      "Place cherry tomatoes in a baking dish, drizzle with olive oil",
      "Nestle feta block in the center of tomatoes",
      "Sprinkle garlic and red pepper flakes over everything",
      "Bake for 35 minutes until tomatoes burst and feta is golden",
      "Meanwhile, cook pasta according to package directions",
      "Mash feta and tomatoes together, mix in hot pasta",
      "Top with fresh basil and serve"
    ],
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9",
    sourceUrl: "https://www.instagram.com/p/CxYz123456/"
  },
  {
    ownerId: "user_013",
    name: "Cloud Bread",
    description: "Light and fluffy low-carb bread that looks like a cloud. Perfect for sandwiches!",
    prepTime: 10,
    cookTime: 25,
    totalTime: 35,
    servings: 4,
    cuisines: ["American"],
    categories: ["Breakfast", "Snack"],
    ingredients: [
      "3 large eggs, separated",
      "3 tbsp cream cheese, softened",
      "1/4 tsp cream of tartar",
      "1 tbsp honey (optional)",
      "Pinch of salt"
    ],
    instructions: [
      "Preheat oven to 300°F and line baking sheet with parchment",
      "Beat egg whites with cream of tartar until stiff peaks form",
      "In separate bowl, mix egg yolks with cream cheese until smooth",
      "Gently fold egg yolk mixture into whites",
      "Spoon onto baking sheet in cloud shapes",
      "Bake for 25 minutes until golden",
      "Let cool completely before serving"
    ],
    imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff",
    sourceUrl: "https://www.instagram.com/p/CwAb789012/"
  },

  // ─── Chloe Harper's TikTok Recipes ──────────────────────────────────────────
  {
    ownerId: "user_013",
    name: "Crispy Smashed Potatoes",
    description: "Ultra crispy smashed potatoes with garlic butter and herbs. A TikTok sensation!",
    prepTime: 15,
    cookTime: 45,
    totalTime: 60,
    servings: 4,
    cuisines: ["American"],
    categories: ["Side Dish", "Dinner"],
    ingredients: [
      "2 lbs baby potatoes",
      "4 tbsp butter, melted",
      "4 cloves garlic, minced",
      "2 tbsp olive oil",
      "Fresh rosemary and thyme",
      "1/2 cup grated Parmesan",
      "Salt and pepper",
      "Sour cream for serving"
    ],
    instructions: [
      "Boil potatoes until fork-tender, about 20 minutes",
      "Preheat oven to 425°F",
      "Place potatoes on baking sheet and smash with a fork",
      "Mix melted butter with garlic and herbs",
      "Brush potatoes generously with garlic butter",
      "Bake for 25 minutes until crispy",
      "Sprinkle with Parmesan in last 5 minutes",
      "Serve hot with sour cream"
    ],
    imageUrl: "https://images.unsplash.com/photo-1596560548464-f010549b84d7",
    sourceUrl: "https://www.tiktok.com/@chloeharper/video/7123456789012345678"
  },
  {
    ownerId: "user_013",
    name: "Birria Tacos",
    description: "Tender braised beef tacos dipped in consommé. The ultimate comfort food from TikTok.",
    prepTime: 30,
    cookTime: 180,
    totalTime: 210,
    servings: 8,
    cuisines: ["Mexican"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "3 lbs beef chuck roast",
      "4 dried guajillo chiles",
      "2 dried ancho chiles",
      "1 can fire-roasted tomatoes",
      "1 onion, quartered",
      "6 cloves garlic",
      "2 tsp cumin",
      "2 tsp oregano",
      "4 cups beef broth",
      "Corn tortillas",
      "Shredded cheese for dipping",
      "Cilantro and onion for topping"
    ],
    instructions: [
      "Toast dried chiles in a dry pan until fragrant",
      "Soak chiles in hot water for 20 minutes",
      "Blend chiles with tomatoes, onion, garlic, and spices",
      "Season beef and sear on all sides",
      "Pour chile sauce and broth over beef",
      "Braise covered at 325°F for 3 hours",
      "Shred beef and strain the consommé",
      "Dip tortillas in fat from consommé and fill with beef",
      "Griddle until crispy and serve with consommé for dipping"
    ],
    imageUrl: "https://images.unsplash.com/photo-1613514785940-daed07799d9b",
    sourceUrl: "https://www.tiktok.com/@chloeharper/video/7234567890123456789"
  },

  // ─── Daniel Park's Instagram Recipes ────────────────────────────────────────
  {
    ownerId: "user_014",
    name: "Japanese Fluffy Pancakes",
    description: "Ultra-thick, jiggly soufflé pancakes that are light as air. A Japanese café classic!",
    prepTime: 20,
    cookTime: 20,
    totalTime: 40,
    servings: 2,
    cuisines: ["Japanese"],
    categories: ["Breakfast", "Dessert"],
    ingredients: [
      "2 egg yolks",
      "3 tbsp milk",
      "1 tsp vanilla extract",
      "1/4 cup cake flour",
      "1/2 tsp baking powder",
      "3 egg whites",
      "2 tbsp sugar",
      "1/4 tsp cream of tartar",
      "Butter for cooking",
      "Maple syrup and whipped cream for serving"
    ],
    instructions: [
      "Mix egg yolks, milk, and vanilla",
      "Sift in flour and baking powder, mix until smooth",
      "Beat egg whites with cream of tartar until foamy",
      "Gradually add sugar and beat to stiff peaks",
      "Gently fold whites into yolk mixture in thirds",
      "Heat pan on lowest setting with butter",
      "Use ring molds, fill halfway and cook covered 10 minutes",
      "Flip carefully and cook 5 more minutes",
      "Serve stacked with butter, syrup, and cream"
    ],
    imageUrl: "https://images.unsplash.com/photo-1575853121743-60c24f0a7502",
    sourceUrl: "https://www.instagram.com/p/CyZa456789/"
  },
  {
    ownerId: "user_014",
    name: "Salmon Poke Bowl",
    description: "Fresh Hawaiian-style poke bowl with marinated salmon, rice, and vibrant toppings.",
    prepTime: 25,
    cookTime: 20,
    totalTime: 45,
    servings: 2,
    cuisines: ["Japanese"],
    categories: ["Lunch", "Dinner", "Main Course"],
    ingredients: [
      "1 lb sushi-grade salmon, cubed",
      "3 tbsp soy sauce",
      "1 tbsp sesame oil",
      "1 tsp rice vinegar",
      "2 cups sushi rice, cooked",
      "1 avocado, sliced",
      "1 cucumber, sliced",
      "1/2 cup edamame",
      "2 green onions, sliced",
      "Sesame seeds",
      "Sriracha mayo",
      "Pickled ginger"
    ],
    instructions: [
      "Marinate salmon cubes in soy sauce, sesame oil, and vinegar",
      "Let marinate for 15 minutes in refrigerator",
      "Cook sushi rice and season with rice vinegar",
      "Divide rice between bowls",
      "Arrange salmon, avocado, cucumber, and edamame on top",
      "Garnish with green onions and sesame seeds",
      "Drizzle with sriracha mayo",
      "Serve with pickled ginger on the side"
    ],
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
    sourceUrl: "https://www.instagram.com/p/CzBc567890/"
  },

  // ─── Daniel Park's TikTok Recipes ───────────────────────────────────────────
  {
    ownerId: "user_014",
    name: "Korean Corn Cheese",
    description: "Sweet corn mixed with gooey melted cheese - the ultimate Korean side dish from TikTok!",
    prepTime: 5,
    cookTime: 10,
    totalTime: 15,
    servings: 4,
    cuisines: ["Korean"],
    categories: ["Side Dish", "Appetizer", "Snack"],
    ingredients: [
      "2 cups sweet corn kernels",
      "1/4 cup mayonnaise",
      "2 tbsp sugar",
      "1 cup shredded mozzarella cheese",
      "2 tbsp butter",
      "1 green onion, sliced",
      "Pinch of salt"
    ],
    instructions: [
      "Melt butter in a skillet over medium heat",
      "Add corn and cook for 3 minutes",
      "Stir in mayonnaise and sugar, mix well",
      "Top with shredded mozzarella cheese",
      "Cover and cook until cheese melts",
      "Garnish with sliced green onions",
      "Serve hot straight from the skillet"
    ],
    imageUrl: "https://images.unsplash.com/photo-1551024506-0bccd828d307",
    sourceUrl: "https://www.tiktok.com/@danielpark/video/7345678901234567890"
  },
  {
    ownerId: "user_014",
    name: "Dalgona Coffee",
    description: "Whipped coffee that took TikTok by storm. Creamy, frothy, and absolutely delicious!",
    prepTime: 5,
    cookTime: 0,
    totalTime: 5,
    servings: 1,
    cuisines: ["Korean"],
    categories: ["Beverage", "Snack"],
    ingredients: [
      "2 tbsp instant coffee",
      "2 tbsp sugar",
      "2 tbsp hot water",
      "1 cup milk (any kind)",
      "Ice cubes"
    ],
    instructions: [
      "Combine instant coffee, sugar, and hot water in a bowl",
      "Whisk vigorously for 3-5 minutes until thick and fluffy",
      "Mixture should form stiff peaks",
      "Fill a glass with ice and milk",
      "Spoon whipped coffee on top",
      "Mix before drinking or enjoy layered",
      "Adjust sweetness to taste"
    ],
    imageUrl: "https://images.unsplash.com/photo-1592318951566-70f6f0ac3c87",
    sourceUrl: "https://www.tiktok.com/@danielpark/video/7456789012345678901"
  }
];
