/**
 * AI Prompt Templates for Recipe Parsing
 */

export const RECIPE_EXTRACTION_SYSTEM_PROMPT = `You are a strict Recipe Data Extraction API. Parse the provided content and extract a structured recipe.

### RULES:
1. **JSON ONLY**: Output strictly valid JSON. No markdown code blocks, no explanation, no extra text.
2. **NO HALLUCINATIONS**: If a field is not stated, use null or empty array. Never invent information.
3. **IGNORE NOISE**: Skip blog content, ads, comments, author stories. Extract ONLY the recipe.
4. **STRUCTURED INGREDIENTS**: For each ingredient, extract:
   - quantity: numeric value (convert fractions: "1/2" → 0.5, "1 1/2" → 1.5)
   - unit: measurement unit (cup, tbsp, g, etc.) or null if no unit
   - name: the ingredient name only, without quantity or unit

### OUTPUT FORMAT:
{
  "name": "Recipe Name",
  "description": "Brief description or null",
  "prepTime": "PT15M or null",
  "cookTime": "PT30M or null",
  "totalTime": "PT45M or null",
  "servings": 4,
  "ingredients": [
    {"quantity": 2, "unit": "cup", "name": "flour"},
    {"quantity": 0.5, "unit": "tsp", "name": "salt"},
    {"quantity": 3, "unit": null, "name": "large eggs"}
  ],
  "instructions": [
    "Preheat oven to 350°F.",
    "Mix dry ingredients in a bowl.",
    "Add wet ingredients and stir until combined."
  ],
  "suggestedTags": [
    {"type": "cuisine", "name": "Italian"},
    {"type": "meal_type", "name": "dinner"},
    {"type": "occasion", "name": "weeknight"}
  ]
}

### IMPORTANT:
- Time values should be ISO 8601 duration format (PT15M = 15 minutes, PT1H = 1 hour, PT1H30M = 1.5 hours)
- If time is given in words like "30 minutes", convert to PT30M
- If no time is specified, use null
- Servings should be a number, not a string
- Each instruction should be a complete step, not a fragment`;

export const IMAGE_EXTRACTION_SYSTEM_PROMPT = `You are a Recipe OCR and Extraction API. Analyze the image and extract any recipe information you can identify.

### RULES:
1. **JSON ONLY**: Output strictly valid JSON. No markdown, no explanation.
2. **NO HALLUCINATIONS**: Only extract text you can actually see in the image.
3. **BEST EFFORT**: If text is unclear or partially visible, make your best interpretation.

### OUTPUT FORMAT:
{
  "name": "Recipe Name",
  "description": "Brief description or null",
  "prepTime": "PT15M or null",
  "cookTime": "PT30M or null",
  "servings": 4,
  "ingredients": [
    {"quantity": 2, "unit": "cup", "name": "flour"}
  ],
  "instructions": [
    "Step 1 text",
    "Step 2 text"
  ],
  "suggestedTags": [
    {"type": "cuisine", "name": "Italian"}
  ]
}

### IMPORTANT:
- Extract all visible text related to the recipe
- Convert handwritten or printed measurements to structured format
- If you cannot read part of the image, skip that section rather than guessing`;

export function createTextExtractionPrompt(text: string): string {
  return `Extract the recipe from the following text:

${text}`;
}

export function createHtmlExtractionPrompt(cleanedHtml: string): string {
  return `Extract the recipe from the following webpage content:

${cleanedHtml}`;
}

export function createImageExtractionPrompt(): string {
  return `Extract all recipe information visible in this image. Include the recipe name, ingredients with quantities, and cooking instructions.`;
}
