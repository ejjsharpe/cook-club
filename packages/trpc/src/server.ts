import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { getAuth } from "../../../apps/server/src/lib/auth";
import type { Env } from "../../../apps/server/src/types";
import { getDb } from "../../db";

export async function createContext(
  opts: FetchCreateContextFnOptions,
  env: Env,
) {
  const { req, resHeaders } = opts;
  const db = getDb(env);
  const auth = getAuth(env);
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  const user = session ? session.user : null;

  return { req, resHeaders, env, db, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(async function isAuthed(opts) {
  const { ctx } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next(opts);
});

export const appRouter = router({
  getUser: publicProcedure.query(({ ctx }) => ctx.user),
});

export type AppRouter = typeof appRouter;
