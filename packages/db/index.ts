import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "./schemas";

interface Env {
  DATABASE_URL: string;
}

export type DbType = NeonDatabase<typeof schema>;

export function getDb(env: Env): DbType {
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  const db = drizzle(pool, { schema });

  return db;
}
