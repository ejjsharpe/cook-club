import { getDb } from "@repo/db";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { getAuth } from "../../../../apps/server/src/lib/auth";
import type { Env } from "../../../../apps/server/src/types";

export async function createContext(
  opts: FetchCreateContextFnOptions,
  env: Env,
) {
  const { req, resHeaders } = opts;
  const db = getDb(env);
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: req.headers });
  const user = session?.user ?? null;

  return { req, resHeaders, env, db, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
