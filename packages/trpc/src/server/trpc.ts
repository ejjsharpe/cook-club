import { initTRPC, TRPCError } from "@trpc/server";
import { scope } from "arktype";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(async function isAuthed(opts) {
  const { ctx } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next({ ...opts, ctx: { ...ctx, user: ctx.user } });
});

const s = scope({
  pagination: {
    "page?": "number > 0",
    "limit?": "number <= 100 & number > 0",
  },
});

const PaginationParamsParser = s.type("pagination");

export const paginatedProcedure = authedProcedure.input(PaginationParamsParser);
