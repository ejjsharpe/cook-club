import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schemas";

interface Env {
  DB: D1Database;
}

export let db: DrizzleD1Database<typeof schema>;

export function getDb(env: Env) {
  if (!db) {
    db = drizzle(env.DB);
  }
  return db;
}
