import { trpcServer } from "@hono/trpc-server";
import { getAuth, type AuthSession, type AuthUser } from "@repo/auth";
import { appRouter, createContext } from "@repo/trpc/server";
import { Hono } from "hono";

import { FeedDO } from "./durable-objects/FeedDO";
import { Env } from "./types";

export { FeedDO };

const app = new Hono<{
  Bindings: Env;
  Variables: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
}>();

app.use("*", async (c, next) => {
  const session = await getAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const res = await getAuth(c.env).handler(c.req.raw);

  return res;
});

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    endpoint: "/api/trpc",
    createContext: (opts, c) => {
      return createContext(opts, c.env);
    },
  }),
);

export default app;
