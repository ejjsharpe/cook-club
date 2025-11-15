import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schemas";

interface Env {
  DATABASE_URL: string;
}

export let db: NeonHttpDatabase<typeof schema>;

export function getDb(env: Env) {
  if (!db) {
    const sql = neon(env.DATABASE_URL);
    db = drizzle(sql, { schema });
  }
  return db;
}
