import { getAuth } from "@repo/auth";
import { getDb } from "@repo/db";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import type { TRPCEnv } from "./env";

export async function createContext(
  opts: FetchCreateContextFnOptions,
  env: TRPCEnv,
  executionCtx?: { waitUntil(promise: Promise<unknown>): void },
) {
  const { req, resHeaders } = opts;
  const db = getDb(env);
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: req.headers });
  const user = session?.user ?? null;
  const waitUntil = (promise: Promise<unknown>) => {
    executionCtx?.waitUntil(promise);
  };

  return { req, resHeaders, env, db, user, waitUntil };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
