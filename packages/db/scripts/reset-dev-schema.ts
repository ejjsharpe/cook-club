import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL environment variable");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to reset schema with NODE_ENV=production");
}

const sql = neon(databaseUrl);

console.log("Resetting dev database schema...");

await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
await sql`DROP SCHEMA IF EXISTS public CASCADE`;
await sql`CREATE SCHEMA public`;
await sql`GRANT ALL ON SCHEMA public TO public`;

console.log("Dev database schema reset");
