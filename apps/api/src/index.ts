import { trpcServer } from "@hono/trpc-server";
import { getAuth } from "@repo/auth";
import { appRouter, createContext } from "@repo/trpc/server";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { FeedDO } from "./durable-objects/FeedDO";
import { Env } from "./types";

export { FeedDO };

const app = new Hono<{ Bindings: Env }>();

function createMutableRequest(request: Request): Request {
  return new Request(request, {
    headers: new Headers(request.headers),
  });
}

app.use("*", async (c, next) => {
  const requestId = c.req.header("cf-ray") || crypto.randomUUID();
  const start = Date.now();
  c.header("x-request-id", requestId);

  await next();

  const url = new URL(c.req.url);
  console.log(
    JSON.stringify({
      requestId,
      method: c.req.method,
      path: url.pathname,
      status: c.res.status,
      durationMs: Date.now() - start,
    }),
  );
});

const enforceApiRateLimit: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  if (!c.env.API_RATE_LIMITER) {
    return next();
  }

  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    "unknown";
  const outcome = await c.env.API_RATE_LIMITER.limit({ key: `ip:${ip}` });

  if (!outcome.success) {
    return c.json({ error: "Too many requests" }, 429);
  }

  return next();
};

app.use("/api/*", enforceApiRateLimit);
app.use("/auth/*", enforceApiRateLimit);
app.use("/trpc/*", enforceApiRateLimit);

app.on(["POST", "GET"], "/auth/*", async (c) => {
  const res = await getAuth(c.env).handler(createMutableRequest(c.req.raw));

  return res;
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    endpoint: "/trpc",
    createContext: (opts, c) => {
      return createContext(opts, c.env);
    },
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
