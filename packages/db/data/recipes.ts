export interface RecipeData {
  name: string;
  description: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  servings: number;
  cuisines: string[];
  categories: string[];
  ingredients: string[];
  instructions: string[];
  imageUrl: string;
  sourceUrl?: string;
}

export const recipes: RecipeData[] = [
  // ITALIAN CUISINE
  {
    name: "Classic Margherita Pizza",
    description: "Traditional Italian pizza with fresh mozzarella, basil, and tomato sauce on a crispy crust.",
    prepTime: "20 minutes",
    cookTime: "15 minutes",
    totalTime: "35 minutes",
    servings: 4,
    cuisines: ["Italian"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "2 1/4 cups all-purpose flour",
      "1 packet instant yeast",
      "1 tsp sugar",
      "3/4 cup warm water",
      "2 tbsp olive oil",
      "1 cup tomato sauce",
      "8 oz fresh mozzarella",
      "Fresh basil leaves",
      "Salt to taste"
    ],
    instructions: [
      "Mix flour, yeast, sugar, and salt in a bowl",
      "Add warm water and olive oil, knead for 10 minutes",
      "Let dough rise for 1 hour until doubled",
      "Roll out dough and spread tomato sauce",
      "Add sliced mozzarella and bake at 475°F for 12-15 minutes",
      "Top with fresh basil before serving"
    ],
    imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002",
    sourceUrl: "https://www.example.com/margherita-pizza"
  },
  {
    name: "Creamy Carbonara",
    description: "Rich and creamy pasta with pancetta, eggs, and Parmesan cheese.",
    prepTime: "10 minutes",
    cookTime: "15 minutes",
    totalTime: "25 minutes",
    servings: 4,
    cuisines: ["Italian"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "1 lb spaghetti",
      "6 oz pancetta, diced",
      "4 large eggs",
      "1 cup grated Parmesan cheese",
      "Black pepper to taste",
      "Salt for pasta water"
    ],
    instructions: [
      "Cook spaghetti in salted boiling water until al dente",
      "Fry pancetta until crispy",
      "Whisk eggs and Parmesan together",
      "Drain pasta, reserving 1 cup pasta water",
      "Toss hot pasta with pancetta and egg mixture",
      "Add pasta water to create creamy sauce",
      "Season with black pepper and serve immediately"
    ],
    imageUrl: "https://images.unsplash.com/photo-1612874742237-6526221588e3"
  },
  {
    name: "Tiramisu",
    description: "Classic Italian dessert with layers of coffee-soaked ladyfingers and mascarpone cream.",
    prepTime: "30 minutes",
    cookTime: "0 minutes",
    totalTime: "4 hours 30 minutes",
    servings: 8,
    cuisines: ["Italian"],
    categories: ["Dessert"],
    ingredients: [
      "6 egg yolks",
      "3/4 cup sugar",
      "1 1/3 cups mascarpone cheese",
      "2 cups heavy cream",
      "2 cups strong espresso, cooled",
      "3 tbsp coffee liqueur",
      "24 ladyfinger cookies",
      "Cocoa powder for dusting"
    ],
    instructions: [
      "Whisk egg yolks and sugar until thick and pale",
      "Fold in mascarpone cheese",
      "Whip heavy cream and fold into mascarpone mixture",
      "Mix espresso and coffee liqueur",
      "Dip ladyfingers in espresso and layer in dish",
      "Spread half the mascarpone mixture over ladyfingers",
      "Repeat layers and dust with cocoa powder",
      "Refrigerate for at least 4 hours before serving"
    ],
    imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9"
  },

  // MEXICAN CUISINE
  {
    name: "Chicken Tacos al Pastor",
    description: "Marinated chicken with pineapple, served in warm tortillas with fresh toppings.",
    prepTime: "20 minutes",
    cookTime: "15 minutes",
    totalTime: "35 minutes",
    servings: 6,
    cuisines: ["Mexican"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "2 lbs chicken thighs, diced",
      "3 dried guajillo chiles",
      "1/2 cup pineapple juice",
      "3 cloves garlic",
      "1 tsp cumin",
      "1 tsp oregano",
      "1/2 cup diced pineapple",
      "12 corn tortillas",
      "Cilantro and onion for topping"
    ],
    instructions: [
      "Rehydrate chiles in hot water for 15 minutes",
      "Blend chiles, pineapple juice, garlic, and spices",
      "Marinate chicken for at least 1 hour",
      "Cook chicken over high heat until charred",
      "Warm tortillas on a griddle",
      "Assemble tacos with chicken, pineapple, cilantro, and onion"
    ],
    imageUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47"
  },
  {
    name: "Fresh Guacamole",
    description: "Creamy avocado dip with lime, cilantro, and jalapeño.",
    prepTime: "10 minutes",
    cookTime: "0 minutes",
    totalTime: "10 minutes",
    servings: 4,
    cuisines: ["Mexican"],
    categories: ["Appetizer", "Snack"],
    ingredients: [
      "3 ripe avocados",
      "1 lime, juiced",
      "1/2 red onion, finely diced",
      "1 jalapeño, minced",
      "1/4 cup cilantro, chopped",
      "1 tomato, diced",
      "Salt to taste"
    ],
    instructions: [
      "Halve avocados and remove pits",
      "Scoop flesh into a bowl and mash",
      "Add lime juice immediately to prevent browning",
      "Fold in onion, jalapeño, cilantro, and tomato",
      "Season with salt and serve with tortilla chips"
    ],
    imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2fb076"
  },

  // CHINESE CUISINE
  {
    name: "Kung Pao Chicken",
    description: "Spicy stir-fried chicken with peanuts and vegetables in a savory sauce.",
    prepTime: "15 minutes",
    cookTime: "10 minutes",
    totalTime: "25 minutes",
    servings: 4,
    cuisines: ["Chinese"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "1 lb chicken breast, cubed",
      "1/2 cup roasted peanuts",
      "3 dried red chiles",
      "2 tbsp soy sauce",
      "1 tbsp rice vinegar",
      "1 tbsp hoisin sauce",
      "2 tsp cornstarch",
      "1 bell pepper, diced",
      "3 green onions, sliced",
      "3 cloves garlic, minced",
      "1 tsp Sichuan peppercorns"
    ],
    instructions: [
      "Marinate chicken with soy sauce and cornstarch for 15 minutes",
      "Heat wok over high heat with oil",
      "Stir-fry chicken until golden, remove and set aside",
      "Add chiles, peppercorns, and garlic to wok",
      "Add bell pepper and stir-fry for 2 minutes",
      "Return chicken to wok with sauce mixture",
      "Toss in peanuts and green onions",
      "Serve hot over rice"
    ],
    imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246"
  },
  {
    name: "Pork Dumplings",
    description: "Juicy pork and vegetable dumplings with a tender wrapper.",
    prepTime: "45 minutes",
    cookTime: "10 minutes",
    totalTime: "55 minutes",
    servings: 6,
    cuisines: ["Chinese"],
    categories: ["Appetizer", "Dinner"],
    ingredients: [
      "1 lb ground pork",
      "2 cups napa cabbage, finely chopped",
      "2 green onions, minced",
      "2 tbsp soy sauce",
      "1 tbsp sesame oil",
      "1 tbsp ginger, minced",
      "40 dumpling wrappers",
      "Soy sauce and vinegar for dipping"
    ],
    instructions: [
      "Mix pork, cabbage, green onions, soy sauce, sesame oil, and ginger",
      "Place a spoonful of filling in center of each wrapper",
      "Wet edges with water and fold into pleats",
      "Steam dumplings for 8-10 minutes until cooked through",
      "Alternatively, pan-fry for crispy bottoms",
      "Serve with dipping sauce"
    ],
    imageUrl: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c"
  },

  // JAPANESE CUISINE
  {
    name: "Chicken Teriyaki Bowl",
    description: "Glazed chicken with vegetables over steamed rice.",
    prepTime: "15 minutes",
    cookTime: "15 minutes",
    totalTime: "30 minutes",
    servings: 4,
    cuisines: ["Japanese"],
    categories: ["Lunch", "Dinner", "Main Course"],
    ingredients: [
      "1.5 lbs chicken thighs",
      "1/4 cup soy sauce",
      "1/4 cup mirin",
      "2 tbsp sugar",
      "1 tbsp sake",
      "2 cups cooked rice",
      "1 cup broccoli florets",
      "Sesame seeds for garnish"
    ],
    instructions: [
      "Mix soy sauce, mirin, sugar, and sake for teriyaki sauce",
      "Pan-fry chicken until golden on both sides",
      "Pour sauce over chicken and simmer until glazed",
      "Steam broccoli until tender-crisp",
      "Slice chicken and serve over rice with broccoli",
      "Drizzle with remaining sauce and garnish with sesame seeds"
    ],
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
  },
  {
    name: "Miso Soup",
    description: "Traditional Japanese soup with tofu, seaweed, and miso paste.",
    prepTime: "5 minutes",
    cookTime: "10 minutes",
    totalTime: "15 minutes",
    servings: 4,
    cuisines: ["Japanese"],
    categories: ["Soup", "Appetizer"],
    ingredients: [
      "4 cups dashi stock",
      "3 tbsp miso paste",
      "1/2 block silken tofu, cubed",
      "2 tbsp wakame seaweed",
      "2 green onions, sliced"
    ],
    instructions: [
      "Heat dashi stock in a pot until simmering",
      "Rehydrate wakame in warm water",
      "Add tofu cubes to the stock",
      "Remove from heat and dissolve miso paste in the stock",
      "Add wakame and green onions",
      "Serve immediately (do not boil after adding miso)"
    ],
    imageUrl: "https://images.unsplash.com/photo-1588566565463-180a5f3d3a5e"
  },

  // THAI CUISINE
  {
    name: "Pad Thai",
    description: "Classic Thai stir-fried noodles with shrimp, peanuts, and tamarind sauce.",
    prepTime: "20 minutes",
    cookTime: "10 minutes",
    totalTime: "30 minutes",
    servings: 4,
    cuisines: ["Thai"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "8 oz rice noodles",
      "1 lb shrimp, peeled",
      "3 tbsp tamarind paste",
      "3 tbsp fish sauce",
      "2 tbsp sugar",
      "2 eggs",
      "1 cup bean sprouts",
      "1/4 cup roasted peanuts",
      "3 green onions",
      "Lime wedges for serving"
    ],
    instructions: [
      "Soak rice noodles in warm water for 30 minutes",
      "Mix tamarind paste, fish sauce, and sugar for sauce",
      "Heat wok and scramble eggs, set aside",
      "Stir-fry shrimp until pink",
      "Add drained noodles and sauce, toss well",
      "Add bean sprouts, peanuts, and green onions",
      "Serve with lime wedges"
    ],
    imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e"
  },
  {
    name: "Green Curry",
    description: "Fragrant Thai curry with chicken, vegetables, and coconut milk.",
    prepTime: "15 minutes",
    cookTime: "25 minutes",
    totalTime: "40 minutes",
    servings: 4,
    cuisines: ["Thai"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "2 tbsp green curry paste",
      "1 can coconut milk",
      "1 lb chicken breast, sliced",
      "1 cup bamboo shoots",
      "1 cup Thai eggplant",
      "2 tbsp fish sauce",
      "1 tbsp palm sugar",
      "Thai basil leaves",
      "2 kaffir lime leaves"
    ],
    instructions: [
      "Heat curry paste in a pot until fragrant",
      "Add half the coconut milk and stir",
      "Add chicken and cook until no longer pink",
      "Pour in remaining coconut milk",
      "Add vegetables, fish sauce, and palm sugar",
      "Simmer for 15 minutes",
      "Tear in lime leaves and basil before serving",
      "Serve with jasmine rice"
    ],
    imageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd"
  },

  // INDIAN CUISINE
  {
    name: "Butter Chicken",
    description: "Creamy tomato-based curry with tender chicken in a rich sauce.",
    prepTime: "20 minutes",
    cookTime: "30 minutes",
    totalTime: "50 minutes",
    servings: 6,
    cuisines: ["Indian"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "2 lbs chicken thighs, cubed",
      "1 cup yogurt",
      "2 tbsp garam masala",
      "1 can crushed tomatoes",
      "1 cup heavy cream",
      "4 tbsp butter",
      "1 onion, diced",
      "4 cloves garlic, minced",
      "2 inch ginger, minced",
      "1 tbsp kasuri methi"
    ],
    instructions: [
      "Marinate chicken in yogurt and half the garam masala for 1 hour",
      "Sauté onion, garlic, and ginger in butter",
      "Add remaining garam masala and cook until fragrant",
      "Add crushed tomatoes and simmer for 15 minutes",
      "Blend sauce until smooth",
      "Add marinated chicken and cook through",
      "Stir in cream and kasuri methi",
      "Serve with naan or rice"
    ],
    imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2fb076"
  },
  {
    name: "Vegetable Samosas",
    description: "Crispy pastry filled with spiced potatoes and peas.",
    prepTime: "30 minutes",
    cookTime: "20 minutes",
    totalTime: "50 minutes",
    servings: 8,
    cuisines: ["Indian"],
    categories: ["Appetizer", "Snack"],
    ingredients: [
      "2 cups all-purpose flour",
      "4 large potatoes, boiled and mashed",
      "1 cup peas",
      "2 tsp cumin seeds",
      "1 tsp garam masala",
      "1 tsp turmeric",
      "2 green chiles, minced",
      "Oil for frying"
    ],
    instructions: [
      "Make dough with flour, oil, and water, rest for 30 minutes",
      "Sauté cumin seeds until fragrant",
      "Mix with mashed potatoes, peas, and spices",
      "Roll dough into circles and cut in half",
      "Form cones and fill with potato mixture",
      "Seal edges with water",
      "Deep fry until golden brown",
      "Serve with mint chutney"
    ],
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950"
  },

  // AMERICAN CUISINE
  {
    name: "Classic Cheeseburger",
    description: "Juicy beef patty with melted cheese, lettuce, tomato, and special sauce.",
    prepTime: "15 minutes",
    cookTime: "10 minutes",
    totalTime: "25 minutes",
    servings: 4,
    cuisines: ["American"],
    categories: ["Lunch", "Dinner", "Main Course"],
    ingredients: [
      "1.5 lbs ground beef (80/20)",
      "4 burger buns",
      "4 slices cheddar cheese",
      "Lettuce leaves",
      "1 tomato, sliced",
      "1 onion, sliced",
      "Pickles",
      "Ketchup, mustard, mayo",
      "Salt and pepper"
    ],
    instructions: [
      "Form beef into 4 equal patties, season with salt and pepper",
      "Heat grill or skillet over high heat",
      "Cook patties for 4 minutes per side for medium",
      "Add cheese in last minute of cooking",
      "Toast buns on grill",
      "Assemble burgers with toppings and condiments",
      "Serve with fries"
    ],
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd"
  },
  {
    name: "Pancakes",
    description: "Fluffy buttermilk pancakes perfect for breakfast.",
    prepTime: "10 minutes",
    cookTime: "15 minutes",
    totalTime: "25 minutes",
    servings: 4,
    cuisines: ["American"],
    categories: ["Breakfast"],
    ingredients: [
      "2 cups all-purpose flour",
      "2 tbsp sugar",
      "2 tsp baking powder",
      "1 tsp baking soda",
      "1/2 tsp salt",
      "2 cups buttermilk",
      "2 eggs",
      "1/4 cup melted butter",
      "Maple syrup for serving"
    ],
    instructions: [
      "Mix dry ingredients in a large bowl",
      "Whisk together buttermilk, eggs, and melted butter",
      "Pour wet ingredients into dry, mix until just combined",
      "Heat griddle over medium heat and grease lightly",
      "Pour 1/4 cup batter per pancake",
      "Flip when bubbles form on surface",
      "Cook until golden on both sides",
      "Serve with butter and maple syrup"
    ],
    imageUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445"
  },

  // FRENCH CUISINE
  {
    name: "Coq au Vin",
    description: "Classic French chicken braised in red wine with mushrooms and pearl onions.",
    prepTime: "20 minutes",
    cookTime: "1 hour 30 minutes",
    totalTime: "1 hour 50 minutes",
    servings: 6,
    cuisines: ["French"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "6 chicken thighs and drumsticks",
      "1 bottle red wine",
      "4 oz bacon, diced",
      "8 oz mushrooms",
      "12 pearl onions",
      "3 carrots, sliced",
      "4 cloves garlic",
      "2 tbsp tomato paste",
      "2 cups chicken stock",
      "Thyme and bay leaf"
    ],
    instructions: [
      "Brown bacon in Dutch oven, remove and set aside",
      "Season and brown chicken pieces in bacon fat",
      "Remove chicken and sauté vegetables",
      "Add tomato paste and garlic, cook for 1 minute",
      "Deglaze with red wine and add stock",
      "Return chicken and bacon to pot with herbs",
      "Simmer covered for 1.5 hours until tender",
      "Serve with crusty bread or mashed potatoes"
    ],
    imageUrl: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6"
  },
  {
    name: "Crème Brûlée",
    description: "Rich vanilla custard with a caramelized sugar topping.",
    prepTime: "15 minutes",
    cookTime: "45 minutes",
    totalTime: "4 hours",
    servings: 6,
    cuisines: ["French"],
    categories: ["Dessert"],
    ingredients: [
      "2 cups heavy cream",
      "1 vanilla bean",
      "5 egg yolks",
      "1/2 cup sugar, plus extra for topping",
      "Pinch of salt"
    ],
    instructions: [
      "Heat cream with vanilla bean until simmering",
      "Whisk egg yolks with sugar until pale",
      "Slowly pour hot cream into eggs while whisking",
      "Strain mixture and divide among ramekins",
      "Bake in water bath at 325°F for 40 minutes",
      "Chill for at least 3 hours",
      "Sprinkle sugar on top and caramelize with torch",
      "Let sugar harden for 1 minute before serving"
    ],
    imageUrl: "https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc"
  },

  // MEDITERRANEAN CUISINE
  {
    name: "Greek Salad",
    description: "Fresh vegetables with feta cheese, olives, and lemon vinaigrette.",
    prepTime: "15 minutes",
    cookTime: "0 minutes",
    totalTime: "15 minutes",
    servings: 4,
    cuisines: ["Mediterranean", "Greek"],
    categories: ["Salad", "Lunch"],
    ingredients: [
      "4 tomatoes, cut into wedges",
      "1 cucumber, sliced",
      "1 red onion, thinly sliced",
      "1 green bell pepper, sliced",
      "1 cup kalamata olives",
      "8 oz feta cheese, cubed",
      "1/4 cup olive oil",
      "2 tbsp lemon juice",
      "1 tsp oregano",
      "Salt and pepper"
    ],
    instructions: [
      "Combine tomatoes, cucumber, onion, and bell pepper in a bowl",
      "Add olives and feta cheese",
      "Whisk together olive oil, lemon juice, oregano, salt, and pepper",
      "Drizzle dressing over salad",
      "Toss gently and serve immediately"
    ],
    imageUrl: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe"
  },
  {
    name: "Falafel",
    description: "Crispy chickpea fritters with herbs and spices.",
    prepTime: "20 minutes",
    cookTime: "15 minutes",
    totalTime: "12 hours 35 minutes",
    servings: 6,
    cuisines: ["Mediterranean", "Middle Eastern"],
    categories: ["Appetizer", "Lunch"],
    ingredients: [
      "2 cups dried chickpeas, soaked overnight",
      "1 onion, chopped",
      "4 cloves garlic",
      "1 cup parsley",
      "1/2 cup cilantro",
      "2 tsp cumin",
      "2 tsp coriander",
      "1 tsp baking powder",
      "Salt and pepper",
      "Oil for frying"
    ],
    instructions: [
      "Drain soaked chickpeas (do not cook them)",
      "Pulse chickpeas, onion, garlic, and herbs in food processor",
      "Add spices, baking powder, salt, and pepper",
      "Refrigerate mixture for 1 hour",
      "Form into small patties or balls",
      "Deep fry at 350°F until golden brown",
      "Serve in pita with tahini sauce and vegetables"
    ],
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950"
  },

  // KOREAN CUISINE
  {
    name: "Bibimbap",
    description: "Korean rice bowl with vegetables, egg, and gochujang sauce.",
    prepTime: "30 minutes",
    cookTime: "20 minutes",
    totalTime: "50 minutes",
    servings: 4,
    cuisines: ["Korean"],
    categories: ["Lunch", "Dinner", "Main Course"],
    ingredients: [
      "4 cups cooked rice",
      "1 lb beef, thinly sliced",
      "2 cups spinach",
      "1 cup bean sprouts",
      "1 carrot, julienned",
      "1 zucchini, julienned",
      "4 eggs",
      "Gochujang sauce",
      "Sesame oil",
      "Soy sauce"
    ],
    instructions: [
      "Marinate beef in soy sauce and sesame oil",
      "Blanch spinach and bean sprouts separately",
      "Sauté carrot and zucchini until tender",
      "Cook beef until browned",
      "Fry eggs sunny-side up",
      "Arrange rice in bowls with vegetables and beef on top",
      "Top with fried egg and gochujang",
      "Mix everything together before eating"
    ],
    imageUrl: "https://images.unsplash.com/photo-1553163147-622ab57be1c7"
  },
  {
    name: "Korean Fried Chicken",
    description: "Extra crispy chicken wings with sweet and spicy glaze.",
    prepTime: "20 minutes",
    cookTime: "25 minutes",
    totalTime: "45 minutes",
    servings: 4,
    cuisines: ["Korean"],
    categories: ["Dinner", "Appetizer"],
    ingredients: [
      "2 lbs chicken wings",
      "1 cup potato starch",
      "1/2 cup gochujang",
      "1/4 cup honey",
      "3 tbsp soy sauce",
      "2 tbsp rice vinegar",
      "4 cloves garlic, minced",
      "1 tbsp ginger, minced",
      "Sesame seeds for garnish"
    ],
    instructions: [
      "Coat chicken wings in potato starch",
      "Double fry wings: first at 325°F for 10 minutes, rest, then 375°F for 5 minutes",
      "Mix gochujang, honey, soy sauce, vinegar, garlic, and ginger",
      "Heat sauce in a pan until thickened",
      "Toss crispy wings in sauce",
      "Garnish with sesame seeds and serve"
    ],
    imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec"
  },

  // VIETNAMESE CUISINE
  {
    name: "Pho Bo",
    description: "Vietnamese beef noodle soup with aromatic broth and fresh herbs.",
    prepTime: "30 minutes",
    cookTime: "3 hours",
    totalTime: "3 hours 30 minutes",
    servings: 6,
    cuisines: ["Vietnamese"],
    categories: ["Soup", "Lunch", "Dinner"],
    ingredients: [
      "2 lbs beef bones",
      "1 lb beef sirloin, thinly sliced",
      "1 onion, halved and charred",
      "3 inch ginger, charred",
      "Star anise, cinnamon stick, coriander seeds",
      "1 lb rice noodles",
      "Fish sauce",
      "Bean sprouts, Thai basil, lime, jalapeños for serving"
    ],
    instructions: [
      "Blanch bones to remove impurities",
      "Simmer bones with charred onion and ginger for 3 hours",
      "Toast spices and add to broth",
      "Season broth with fish sauce",
      "Cook rice noodles according to package",
      "Arrange noodles and raw beef in bowls",
      "Ladle hot broth over to cook beef",
      "Serve with fresh herbs and condiments"
    ],
    imageUrl: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43"
  },
  {
    name: "Banh Mi",
    description: "Vietnamese sandwich with pickled vegetables and savory fillings.",
    prepTime: "30 minutes",
    cookTime: "15 minutes",
    totalTime: "45 minutes",
    servings: 4,
    cuisines: ["Vietnamese"],
    categories: ["Lunch", "Dinner"],
    ingredients: [
      "4 Vietnamese baguettes",
      "1 lb pork shoulder, sliced",
      "1 carrot, julienned and pickled",
      "1 daikon, julienned and pickled",
      "Cucumber slices",
      "Cilantro",
      "Jalapeño slices",
      "Mayonnaise",
      "Pâté (optional)",
      "Soy sauce and fish sauce for marinade"
    ],
    instructions: [
      "Marinate pork in soy sauce and fish sauce",
      "Quick pickle carrots and daikon in vinegar and sugar",
      "Grill or pan-fry pork until cooked through",
      "Toast baguettes until crispy outside",
      "Spread mayo and pâté on bread",
      "Layer pork, pickled vegetables, cucumber, cilantro, and jalapeños",
      "Serve immediately"
    ],
    imageUrl: "https://images.unsplash.com/photo-1591814468924-caf88d1232e1"
  },

  // SPANISH CUISINE
  {
    name: "Paella",
    description: "Traditional Spanish rice dish with seafood, chicken, and saffron.",
    prepTime: "20 minutes",
    cookTime: "40 minutes",
    totalTime: "1 hour",
    servings: 6,
    cuisines: ["Spanish", "Mediterranean"],
    categories: ["Dinner", "Main Course"],
    ingredients: [
      "2 cups bomba rice",
      "1 lb chicken thighs, cut into pieces",
      "1/2 lb shrimp",
      "1/2 lb mussels",
      "1/2 lb calamari rings",
      "1 onion, diced",
      "4 tomatoes, grated",
      "4 cups chicken stock",
      "Pinch of saffron",
      "1 cup peas",
      "Lemon wedges for serving"
    ],
    instructions: [
      "Brown chicken in paella pan with olive oil",
      "Remove chicken and sauté onion until soft",
      "Add grated tomatoes and cook until thick",
      "Stir in rice and saffron",
      "Add hot stock and return chicken to pan",
      "Simmer without stirring for 20 minutes",
      "Add seafood and peas in last 10 minutes",
      "Let rest for 5 minutes and serve with lemon"
    ],
    imageUrl: "https://images.unsplash.com/photo-1534080564583-6be75777b70a"
  },
  {
    name: "Churros with Chocolate",
    description: "Crispy fried dough pastry with thick hot chocolate for dipping.",
    prepTime: "15 minutes",
    cookTime: "20 minutes",
    totalTime: "35 minutes",
    servings: 6,
    cuisines: ["Spanish"],
    categories: ["Dessert", "Snack"],
    ingredients: [
      "1 cup water",
      "2 tbsp sugar",
      "1/2 tsp salt",
      "2 tbsp vegetable oil",
      "1 cup all-purpose flour",
      "Oil for frying",
      "Cinnamon sugar for coating",
      "8 oz dark chocolate",
      "1/2 cup heavy cream for chocolate sauce"
    ],
    instructions: [
      "Bring water, sugar, salt, and oil to a boil",
      "Remove from heat and stir in flour until smooth",
      "Transfer dough to piping bag with star tip",
      "Heat oil to 375°F",
      "Pipe dough into oil in 4-inch strips",
      "Fry until golden brown, about 2 minutes per side",
      "Roll in cinnamon sugar while hot",
      "Heat cream and pour over chocolate to make sauce",
      "Serve churros with chocolate for dipping"
    ],
    imageUrl: "https://images.unsplash.com/photo-1611686802018-e3c1886d73f5"
  }
];
