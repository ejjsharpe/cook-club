import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "cloudflare:workers": path.resolve(
        __dirname,
        "tests/__mocks__/cloudflare-workers.ts",
      ),
    },
  },
});
