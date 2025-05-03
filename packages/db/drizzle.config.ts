import { defineConfig } from "drizzle-kit";

if (
  !process.env.CLOUDFLARE_ACCOUNT_ID ||
  !process.env.CLOUDFLARE_DATABASE_ID ||
  !process.env.CLOUDFLARE_D1_TOKEN
) {
  throw new Error("Missing env variables");
}

export default defineConfig({
  out: "./src/db/drizzle",
  schema: "./src/db/schemas/index.ts",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID,
    token: process.env.CLOUDFLARE_D1_TOKEN,
  },
});
