import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    name: "integration",
    include: ["tests/integration/**/*.test.ts"],
    poolOptions: {
      workers: {
        main: "./src/index.ts",
        miniflare: {
          compatibilityDate: "2025-02-20",
          compatibilityFlags: ["nodejs_compat"],
          // Add KV namespace for testing (in-memory)
          kvNamespaces: ["RECIPE_CACHE"],
        },
      },
    },
  },
});
