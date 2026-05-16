import { describe, it, expect, vi, beforeEach } from "vitest";

import { RecipeAI } from "../../src/index";

// Valid AI response for mocking
const validAiResponse = JSON.stringify({
  name: "Test Recipe",
  description: "A delicious test recipe",
  prepTime: "PT15M",
  cookTime: "PT30M",
  totalTime: "PT45M",
  servings: 4,
  ingredientSections: [
    {
      name: null,
      ingredients: [
        { index: 0, quantity: 2, unit: "cup", name: "flour" },
        { index: 1, quantity: 1, unit: "tsp", name: "salt" },
      ],
    },
  ],
  instructionSections: [
    {
      name: null,
      instructions: [
        { index: 0, instruction: "Mix ingredients" },
        { index: 1, instruction: "Bake at 350F" },
      ],
    },
  ],
  suggestedTags: [{ type: "cuisine", name: "American" }],
});

// Sample HTML page
const sampleHtml = `
<html>
  <body>
    <article>
      <h1>Recipe Title</h1>
      <p>This is a recipe page.</p>
      <h2>Ingredients</h2>
      <ul>
        <li>2 cups flour</li>
        <li>1 tsp salt</li>
      </ul>
      <h2>Instructions</h2>
      <ol>
        <li>Mix everything</li>
        <li>Bake it</li>
      </ol>
    </article>
  </body>
</html>
`;

const aiOnlyHtml = `
<html>
  <body>
    <article>
      ${"This page has a long recipe story with enough content for AI extraction. ".repeat(10)}
    </article>
  </body>
</html>
`;

// Create mock environment
function createMockEnv() {
  const kvStore = new Map<string, string>();

  return {
    AI: {
      run: vi.fn().mockResolvedValue({ response: validAiResponse }),
    },
    RECIPE_CACHE: {
      get: vi.fn((key: string, type?: string) => {
        const value = kvStore.get(key);
        if (!value) return Promise.resolve(null);
        if (type === "json") return Promise.resolve(JSON.parse(value));
        return Promise.resolve(value);
      }),
      put: vi.fn((key: string, value: string) => {
        kvStore.set(key, value);
        return Promise.resolve();
      }),
    },
    _kvStore: kvStore,
  };
}

// Create parser instance with mock env
function createParser(env: ReturnType<typeof createMockEnv>) {
  const parser = new (RecipeAI as any)();
  parser.env = env;
  return parser;
}

describe("RecipeAI.parse()", () => {
  let mockEnv: ReturnType<typeof createMockEnv>;
  let parser: RecipeAI;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockEnv = createMockEnv();
    parser = createParser(mockEnv);

    // Default: mock fetch to return sample HTML
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode(sampleHtml).buffer),
      text: () => Promise.resolve(sampleHtml),
    });
  });

  describe("URL parsing flow", () => {
    it("returns cached result on cache hit", async () => {
      const cachedRecipe = {
        name: "Cached Recipe",
        ingredientSections: [
          {
            name: null,
            ingredients: [
              { index: 0, name: "cached" },
              { index: 1, name: "extra cached ingredient" },
            ],
          },
        ],
        instructionSections: [
          { name: null, instructions: [{ index: 0, instruction: "cached" }] },
        ],
      };

      mockEnv.RECIPE_CACHE.get = vi.fn().mockResolvedValue(cachedRecipe);

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.metadata.cached).toBe(true);
        expect(result.data.name).toBe("Cached Recipe");
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("parses visible recipe cards without AI", async () => {
      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Recipe Title");
        expect(result.metadata.parseMethod).toBe("structured_data");
        expect(result.metadata.confidence).toBe("medium");
        expect(mockEnv.AI.run).not.toHaveBeenCalled();
      }
    });

    it("falls back to AI when deterministic extractors cannot produce a recipe", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(aiOnlyHtml).buffer),
        text: () => Promise.resolve(aiOnlyHtml),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test Recipe");
        expect(result.metadata.parseMethod).toBe("ai_only");
        expect(mockEnv.AI.run).toHaveBeenCalled();
      }
    });

    it("returns usable structured data without AI when present", async () => {
      const structuredHtml = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Recipe",
                "name": "Structured Cake",
                "description": "A structured recipe.",
                "recipeYield": "Serves 8",
                "recipeIngredient": ["1 cup flour", "2 eggs"],
                "recipeInstructions": [
                  { "@type": "HowToStep", "text": "Mix the batter." },
                  { "@type": "HowToStep", "text": "Bake the cake." }
                ]
              }
            </script>
          </head>
          <body><article>${"Intro ".repeat(4000)}</article></body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(structuredHtml).buffer),
        text: () => Promise.resolve(structuredHtml),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/structured-cake",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Structured Cake");
        expect(result.metadata.parseMethod).toBe("structured_data");
      }
      expect(mockEnv.AI.run).not.toHaveBeenCalled();
    });

    it("uses AMP and print alternates before AI", async () => {
      const mainHtml = `
        <html>
          <head>
            <link rel="amphtml" href="https://example.com/amp/alternate-cake">
          </head>
          <body><article>${"Intro only. ".repeat(40)}</article></body>
        </html>
      `;
      const ampHtml = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Recipe",
                "name": "AMP Cake",
                "image": "/amp-cake.jpg",
                "recipeIngredient": ["1 cup flour", "2 eggs"],
                "recipeInstructions": [
                  { "@type": "HowToStep", "text": "Mix the batter." },
                  { "@type": "HowToStep", "text": "Bake until done." }
                ]
              }
            </script>
          </head>
        </html>
      `;

      global.fetch = vi.fn((requestUrl: string | URL) => {
        const body = String(requestUrl).includes("/amp/alternate-cake")
          ? ampHtml
          : mainHtml;

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/html" }),
          arrayBuffer: () =>
            Promise.resolve(new TextEncoder().encode(body).buffer),
          text: () => Promise.resolve(body),
        });
      }) as any;

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/alternate-cake",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("AMP Cake");
        expect(result.data.sourceUrl).toBe(
          "https://example.com/alternate-cake",
        );
        expect(result.data.images).toEqual([
          "https://example.com/amp-cake.jpg",
        ]);
        expect(result.metadata.parseMethod).toBe("structured_data");
      }
      expect(mockEnv.AI.run).not.toHaveBeenCalled();
    });

    it("uses WordPress REST content before AI", async () => {
      const mainHtml = `
        <html>
          <head><link rel="https://api.w.org/" href="https://example.com/wp-json/"></head>
          <body>
            <article class="wp-block-post-content">
              ${"A WordPress post intro without a recipe card. ".repeat(10)}
              <img src="/wp-content/uploads/story.jpg">
            </article>
          </body>
        </html>
      `;
      const restPost = [
        {
          title: { rendered: "WP Rest Pie" },
          excerpt: { rendered: "<p>A reliable pie.</p>" },
          content: {
            rendered: `
              <h2>Ingredients</h2>
              <ul>
                <li>2 cups apples</li>
                <li>1 cup flour</li>
              </ul>
              <h2>Instructions</h2>
              <ol>
                <li>Fill the pie.</li>
                <li>Bake until golden.</li>
              </ol>
            `,
          },
        },
      ];

      global.fetch = vi.fn((requestUrl: string | URL) => {
        if (String(requestUrl).includes("/wp-json/wp/v2/posts")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: () => Promise.resolve(restPost),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/html" }),
          arrayBuffer: () =>
            Promise.resolve(new TextEncoder().encode(mainHtml).buffer),
          text: () => Promise.resolve(mainHtml),
        });
      }) as any;

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/wp-rest-pie",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("WP Rest Pie");
        expect(result.metadata.parseMethod).toBe("structured_data");
      }
      expect(mockEnv.AI.run).not.toHaveBeenCalled();
    });

    it("rejects deterministic TikTok fallbacks that only contain a placeholder method", async () => {
      const tiktokCaption =
        "fudgy browniess🤤 recipe by Handle the Heat: 5 tbsp butter 1 1/4 cups sugar 2 eggs plus 1 egg yolk 1 tsp vanilla 1/3 cup vegetable oil 3/4 cup cocoa powder 1/2 cup flour 1/8 tsp baking soda 1 tbsp cornstarch 1/4 tsp salt 3/4 cup chocolate chips #brownies #fudgybrownies #brownierecipe";

      mockEnv.AI.run = vi.fn().mockResolvedValue({
        response: JSON.stringify({
          name: "Fudgy Brownies",
          description: null,
          prepTime: null,
          cookTime: null,
          totalTime: null,
          servings: null,
          ingredientSections: [
            {
              name: null,
              ingredients: [
                { index: 0, quantity: 5, unit: "tbsp", name: "butter" },
              ],
            },
          ],
          instructionSections: [],
          suggestedTags: [],
        }),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve({
            title: tiktokCaption,
            thumbnail_url: "https://example.com/tiktok.jpg",
          }),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://www.tiktok.com/@thelittlecakela/video/7208369840007007531",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
      expect(mockEnv.AI.run).toHaveBeenCalled();
    });

    it("uses TikTok audio transcript enrichment when a video has no caption", async () => {
      const enrichedAiRecipe = {
        name: "Spoken Tomato Pasta",
        description: null,
        prepTime: null,
        cookTime: 15,
        totalTime: null,
        servings: 2,
        ingredientSections: [
          {
            name: null,
            ingredients: [
              { index: 0, quantity: 200, unit: "g", name: "spaghetti" },
              { index: 1, quantity: 1, unit: "cup", name: "tomato sauce" },
            ],
          },
        ],
        instructionSections: [
          {
            name: null,
            instructions: [
              { index: 0, instruction: "Boil the spaghetti." },
              { index: 1, instruction: "Toss with tomato sauce." },
            ],
          },
        ],
      };

      mockEnv.AI.run = vi.fn((model: string) => {
        if (model === "@cf/openai/whisper") {
          return Promise.resolve({
            text: "Boil spaghetti, warm tomato sauce, then toss everything together.",
          });
        }

        return Promise.resolve({ response: JSON.stringify(enrichedAiRecipe) });
      });

      global.fetch = vi.fn((requestUrl: string | URL) => {
        const url = String(requestUrl);
        if (url.startsWith("https://www.tiktok.com/oembed")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: () =>
              Promise.resolve({
                thumbnail_url: "https://example.com/tiktok.jpg",
                video_url: "https://cdn.example.com/video.mp4",
              }),
          });
        }

        if (url === "https://cdn.example.com/video.mp4") {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-length": "4" }),
            arrayBuffer: () =>
              Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          headers: new Headers({ "content-type": "text/html" }),
          text: () => Promise.resolve(""),
        });
      }) as any;

      const result = await parser.parse({
        type: "url",
        data: "https://www.tiktok.com/@cook/video/123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Spoken Tomato Pasta");
        expect(result.metadata.parseMethod).toBe("ai_enhanced");
      }
      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        "@cf/openai/whisper",
        expect.objectContaining({ audio: [1, 2, 3, 4] }),
      );
    });

    it("falls back to deterministic Instagram caption parsing when AI output is incomplete", async () => {
      const instagramCaption =
        "Easy tomato pasta Ingredients: 200 g spaghetti 1 cup tomato sauce Directions: 1. Boil the spaghetti. 2. Toss with tomato sauce and serve.";

      mockEnv.AI.run = vi.fn().mockResolvedValue({
        response: JSON.stringify({
          name: "Easy Tomato Pasta",
          description: null,
          prepTime: null,
          cookTime: null,
          totalTime: null,
          servings: null,
          ingredientSections: [
            {
              name: null,
              ingredients: [
                { index: 0, quantity: 200, unit: "g", name: "spaghetti" },
              ],
            },
          ],
          instructionSections: [],
          suggestedTags: [],
        }),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve({
            title: instagramCaption,
            thumbnail_url: "https://example.com/instagram.jpg",
          }),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://www.instagram.com/reel/ABC123/",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Easy Tomato Pasta");
        expect(result.data.instructionSections[0]?.instructions).toHaveLength(
          2,
        );
        expect(result.metadata.parseMethod).toBe("structured_data");
      }
    });

    it("routes non-Instagram/TikTok social links through generic social parsing", async () => {
      const youtubeHtml = `
        <html>
          <head>
            <meta property="og:title" content="Tomato pasta short">
            <meta property="og:description" content="Recipe: 200 g spaghetti, 1 cup tomato sauce. Boil pasta and toss with sauce.">
            <meta property="og:image" content="https://example.com/youtube.jpg">
          </head>
          <body></body>
        </html>
      `;

      mockEnv.AI.run = vi.fn().mockResolvedValue({
        response: JSON.stringify({
          name: "Tomato Pasta",
          description: null,
          prepTime: null,
          cookTime: 15,
          totalTime: null,
          servings: 2,
          ingredientSections: [
            {
              name: null,
              ingredients: [
                { index: 0, quantity: 200, unit: "g", name: "spaghetti" },
                { index: 1, quantity: 1, unit: "cup", name: "tomato sauce" },
              ],
            },
          ],
          instructionSections: [
            {
              name: null,
              instructions: [
                { index: 0, instruction: "Boil the pasta." },
                { index: 1, instruction: "Toss with tomato sauce." },
              ],
            },
          ],
        }),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(youtubeHtml).buffer),
        text: () => Promise.resolve(youtubeHtml),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://www.youtube.com/watch?v=abc123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Tomato Pasta");
        expect(result.data.images).toEqual(["https://example.com/youtube.jpg"]);
        expect(result.metadata.parseMethod).toBe("ai_only");
      }
    });

    it("reuploads YouTube social images with the youtube destination prefix", async () => {
      const youtubeHtml = `
        <html>
          <head>
            <meta property="og:title" content="Tomato pasta short">
            <meta property="og:description" content="Recipe: 200 g spaghetti, 1 cup tomato sauce. Boil pasta and toss with sauce.">
            <meta property="og:image" content="https://example.com/youtube.jpg">
          </head>
          <body></body>
        </html>
      `;
      const uploadFromUrl = vi.fn(
        async (_sourceUrl: string, destinationKey: string) => ({
          success: true,
          publicUrl: `https://images.example.com/${destinationKey}`,
          key: destinationKey,
        }),
      );

      (mockEnv as any).IMAGE_SERVICE = { uploadFromUrl };
      mockEnv.AI.run = vi.fn().mockResolvedValue({
        response: JSON.stringify({
          name: "Tomato Pasta",
          description: null,
          prepTime: null,
          cookTime: 15,
          totalTime: null,
          servings: 2,
          ingredientSections: [
            {
              name: null,
              ingredients: [
                { index: 0, quantity: 200, unit: "g", name: "spaghetti" },
                { index: 1, quantity: 1, unit: "cup", name: "tomato sauce" },
              ],
            },
          ],
          instructionSections: [
            {
              name: null,
              instructions: [
                { index: 0, instruction: "Boil the pasta." },
                { index: 1, instruction: "Toss with tomato sauce." },
              ],
            },
          ],
        }),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(youtubeHtml).buffer),
        text: () => Promise.resolve(youtubeHtml),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://www.youtube.com/watch?v=abc123",
      });

      expect(result.success).toBe(true);
      expect(uploadFromUrl).toHaveBeenCalledTimes(1);
      expect(uploadFromUrl).toHaveBeenCalledWith(
        "https://example.com/youtube.jpg",
        expect.stringMatching(/^social\/youtube\/[a-zA-Z0-9-]+\.jpg$/),
      );
      if (result.success) {
        expect(result.data.images).toEqual([
          expect.stringMatching(
            /^https:\/\/images\.example\.com\/social\/youtube\/[a-zA-Z0-9-]+\.jpg$/,
          ),
        ]);
      }
    });

    it("rejects social links during structured-only basic import without fetching", async () => {
      const result = await parser.parse({
        type: "url",
        data: "https://www.youtube.com/watch?v=abc123",
        structuredOnly: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNSUPPORTED_URL");
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("evicts unusable cached recipes and retries live parsing", async () => {
      const cachedRecipe = {
        name: "Stale Recipe",
        ingredientSections: [
          { name: null, ingredients: [{ index: 0, name: "stale" }] },
        ],
        instructionSections: [],
      };

      mockEnv.RECIPE_CACHE.get = vi.fn().mockResolvedValue(cachedRecipe);
      (mockEnv.RECIPE_CACHE as any).delete = vi
        .fn()
        .mockResolvedValue(undefined);

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/stale-cache",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Recipe Title");
        expect(result.metadata.cached).toBe(false);
      }
      expect((mockEnv.RECIPE_CACHE as any).delete).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
    });

    it("uses TikTok audio transcript enrichment before caption fallback", async () => {
      const tiktokCaption =
        "fudgy browniess recipe by Handle the Heat: 5 tbsp butter 1 1/4 cups sugar 2 eggs plus 1 egg yolk #brownies";
      const invalidAiRecipe = {
        name: "Fudgy Brownies",
        description: null,
        prepTime: null,
        cookTime: null,
        totalTime: null,
        servings: null,
        ingredientSections: [
          {
            name: null,
            ingredients: [
              { index: 0, quantity: 5, unit: "tbsp", name: "butter" },
              { index: 1, quantity: 1.25, unit: "cup", name: "sugar" },
            ],
          },
        ],
        instructionSections: [],
        suggestedTags: [],
      };
      const enrichedAiRecipe = {
        ...invalidAiRecipe,
        instructionSections: [
          {
            name: null,
            instructions: [
              { index: 0, instruction: "Melt the butter." },
              { index: 1, instruction: "Whisk in the sugar and eggs." },
              { index: 2, instruction: "Bake until fudgy." },
            ],
          },
        ],
      };

      let textModelCalls = 0;
      mockEnv.AI.run = vi.fn((model: string) => {
        if (model === "@cf/openai/whisper") {
          return Promise.resolve({
            text: "Melt the butter, whisk in the sugar and eggs, then bake until fudgy.",
          });
        }

        textModelCalls += 1;
        return Promise.resolve({
          response: JSON.stringify(
            textModelCalls === 1 ? invalidAiRecipe : enrichedAiRecipe,
          ),
        });
      });

      global.fetch = vi.fn((requestUrl: string | URL) => {
        if (String(requestUrl).includes("cdn.example.com/video.mp4")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-length": "4" }),
            arrayBuffer: () =>
              Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () =>
            Promise.resolve({
              title: tiktokCaption,
              thumbnail_url: "https://example.com/tiktok.jpg",
              video_url: "https://cdn.example.com/video.mp4",
            }),
        });
      }) as any;

      const result = await parser.parse({
        type: "url",
        data: "https://www.tiktok.com/@thelittlecakela/video/7208369840007007531",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Fudgy Brownies");
        expect(result.data.instructionSections[0]?.instructions).toHaveLength(
          3,
        );
        expect(
          result.data.instructionSections[0]?.instructions[0]?.instruction,
        ).toBe("Melt the butter.");
        expect(result.metadata.parseMethod).toBe("ai_enhanced");
      }
      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        "@cf/openai/whisper",
        expect.objectContaining({ audio: [1, 2, 3, 4] }),
      );
    });

    it("uses TikTok subtitle transcripts before Whisper or OCR", async () => {
      const tiktokCaption =
        "fudgy browniess recipe by Handle the Heat: 5 tbsp butter 1 1/4 cups sugar 2 eggs plus 1 egg yolk #brownies";
      const hydration = {
        __DEFAULT_SCOPE__: {
          "webapp.reflow.video.detail": {
            itemInfo: {
              itemStruct: {
                desc: tiktokCaption,
                video: {
                  cover: "https://example.com/tiktok.jpg",
                  subtitleInfos: [
                    {
                      Url: "https://subtitle.example.com/brownies.vtt",
                      Format: "webvtt",
                      Source: "ASR",
                    },
                  ],
                },
              },
            },
          },
        },
      };
      const invalidAiRecipe = {
        name: "Fudgy Brownies",
        description: null,
        prepTime: null,
        cookTime: null,
        totalTime: null,
        servings: null,
        ingredientSections: [
          {
            name: null,
            ingredients: [
              { index: 0, quantity: 5, unit: "tbsp", name: "butter" },
              { index: 1, quantity: 1.25, unit: "cup", name: "sugar" },
            ],
          },
        ],
        instructionSections: [],
        suggestedTags: [],
      };
      const enrichedAiRecipe = {
        ...invalidAiRecipe,
        instructionSections: [
          {
            name: null,
            instructions: [
              {
                index: 0,
                instruction: "Whisk melted butter and sugar together.",
              },
              {
                index: 1,
                instruction: "Bake the brownies for 40 minutes.",
              },
            ],
          },
        ],
      };

      let textModelCalls = 0;
      mockEnv.AI.run = vi.fn((model: string) => {
        if (model === "@cf/openai/whisper") {
          return Promise.resolve({ text: "This should not be used." });
        }

        textModelCalls += 1;
        return Promise.resolve({
          response: JSON.stringify(
            textModelCalls === 1 ? invalidAiRecipe : enrichedAiRecipe,
          ),
        });
      });

      global.fetch = vi.fn((requestUrl: string | URL) => {
        const url = String(requestUrl);
        if (url.startsWith("https://www.tiktok.com/oembed")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: () =>
              Promise.resolve({
                title: tiktokCaption,
                thumbnail_url: "https://example.com/tiktok.jpg",
              }),
          });
        }

        if (
          url ===
          "https://www.tiktok.com/@thelittlecakela/video/7208369840007007531"
        ) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () =>
              Promise.resolve(`
                <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
                  ${JSON.stringify(hydration)}
                </script>
              `),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(`
WEBVTT

00:00:00.000 --> 00:00:01.000
Whisk melted butter and sugar together.

00:00:01.001 --> 00:00:02.000
Bake the brownies for 40 minutes.
            `),
        });
      }) as any;

      const result = await parser.parse({
        type: "url",
        data: "https://www.tiktok.com/@thelittlecakela/video/7208369840007007531",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instructionSections[0]?.instructions).toHaveLength(
          2,
        );
        expect(result.metadata.parseMethod).toBe("ai_enhanced");
      }
      expect(mockEnv.AI.run).not.toHaveBeenCalledWith(
        "@cf/openai/whisper",
        expect.anything(),
      );
    });

    it("caches successful results", async () => {
      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      expect(mockEnv.RECIPE_CACHE.put).toHaveBeenCalled();
    });

    it("returns error on fetch failure", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers({ "content-type": "text/html" }),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/404",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FETCH_FAILED");
      }
    });

    it("uses reader fallback when regular fetch is blocked", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      const readerMarkdown = `
Markdown Content:
This reader fallback cake is reliable and easy to make.

Serves 4

### Ingredients

*   2 cups flour
*   1 cup sugar

### Instructions

1.   Mix the ingredients.
2.   Bake until golden.
      `;

      global.fetch = vi.fn((requestUrl: string | URL) => {
        if (String(requestUrl).startsWith("https://r.jina.ai/")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "text/plain" }),
            text: () => Promise.resolve(readerMarkdown),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          headers: new Headers({ "content-type": "text/html" }),
        });
      }) as any;

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/reader-fallback-cake-recipe-123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Reader Fallback Cake");
        expect(result.metadata.parseMethod).toBe("structured_data");
        expect(mockEnv.AI.run).not.toHaveBeenCalled();
      }
    });

    it("returns error when page has no content", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(
            new TextEncoder().encode("<html><body></body></html>").buffer,
          ),
        text: () => Promise.resolve("<html><body></body></html>"),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/empty",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NO_CONTENT");
      }
    });
  });

  describe("text parsing flow", () => {
    it("parses recipe from text using AI", async () => {
      const result = await parser.parse({
        type: "text",
        data: "Here is my recipe: Chocolate Cake. Ingredients: 2 cups flour, 1 cup sugar. Instructions: Mix and bake.",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test Recipe");
        expect(result.metadata.source).toBe("text");
        expect(mockEnv.AI.run).toHaveBeenCalled();
      }
    });

    it("returns error for text too short", async () => {
      const result = await parser.parse({
        type: "text",
        data: "Too short",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT");
      }
    });

    it("returns error for text too long", async () => {
      const longText = "A".repeat(15000);
      const result = await parser.parse({
        type: "text",
        data: longText,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INPUT_TOO_LONG");
      }
    });
  });

  describe("image parsing flow", () => {
    it("parses recipe from image using AI", async () => {
      const base64Image = btoa("fake image data that is long enough");

      const result = await parser.parse({
        type: "image",
        data: base64Image,
        mimeType: "image/jpeg",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test Recipe");
        expect(result.metadata.source).toBe("image");
      }
    });

    it("returns error for invalid mime type", async () => {
      const result = await parser.parse({
        type: "image",
        data: btoa("image"),
        mimeType: "image/gif" as any,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_MIME_TYPE");
      }
    });

    it("returns error for invalid base64", async () => {
      const result = await parser.parse({
        type: "image",
        data: "not-valid-base64!!!",
        mimeType: "image/jpeg",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_BASE64");
      }
    });

    it("accepts PNG images", async () => {
      const result = await parser.parse({
        type: "image",
        data: btoa("fake png data"),
        mimeType: "image/png",
      });

      expect(result.success).toBe(true);
    });

    it("accepts WebP images", async () => {
      const result = await parser.parse({
        type: "image",
        data: btoa("fake webp data"),
        mimeType: "image/webp",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns error for invalid input type", async () => {
      const result = await parser.parse({
        type: "invalid" as any,
        data: "test",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT_TYPE");
      }
    });

    it("catches and returns AI errors gracefully", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(aiOnlyHtml).buffer),
        text: () => Promise.resolve(aiOnlyHtml),
      });
      mockEnv.AI.run = vi.fn().mockRejectedValue(new Error("AI service down"));

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("AI_PARSE_FAILED");
      }
    });
  });

  describe("metadata accuracy", () => {
    it("reports medium confidence for AI-parsed URLs", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(aiOnlyHtml).buffer),
        text: () => Promise.resolve(aiOnlyHtml),
      });

      const result = await parser.parse({
        type: "url",
        data: "https://example.com/recipe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.metadata.confidence).toBe("medium");
        expect(result.metadata.parseMethod).toBe("ai_only");
      }
    });

    it("reports correct source for each input type", async () => {
      const urlResult = await parser.parse({
        type: "url",
        data: "https://example.com",
      });
      expect(urlResult.success).toBe(true);
      if (urlResult.success) {
        expect(urlResult.metadata.source).toBe("url");
      }

      const textResult = await parser.parse({
        type: "text",
        data: "A recipe with enough content to be parsed properly by the system",
      });
      expect(textResult.success).toBe(true);
      if (textResult.success) {
        expect(textResult.metadata.source).toBe("text");
      }

      const imageResult = await parser.parse({
        type: "image",
        data: btoa("image data"),
        mimeType: "image/jpeg",
      });
      expect(imageResult.success).toBe(true);
      if (imageResult.success) {
        expect(imageResult.metadata.source).toBe("image");
      }
    });
  });
});

describe("default HTTP handler", () => {
  it("returns error response for direct HTTP access", async () => {
    const { default: handler } = await import("../../src/index");
    const mockRequest = new Request("https://example.com/");
    const mockEnv = { AI: {}, RECIPE_CACHE: {} } as any;
    const response = await handler.fetch(mockRequest, mockEnv);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("RPC");
  });
});
