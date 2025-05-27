import { trpcServer } from "@hono/trpc-server";
import { appRouter, createContext } from "@repo/trpc/server";
import { Hono } from "hono";

import { getAuth } from "./lib/auth";
import { Env } from "./types";

type Session = ReturnType<typeof getAuth>["$Infer"]["Session"]["session"];
type User = ReturnType<typeof getAuth>["$Infer"]["Session"]["user"];

const app = new Hono<{
  Bindings: Env;
  Variables: {
    user: User | null;
    session: Session | null;
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

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return getAuth(c.env).handler(c.req.raw);
});

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    endpoint: "/api/trpc",
    createContext: (opts, c) => {
      return createContext(opts, c.env);
    },
  })
);

export default app;
