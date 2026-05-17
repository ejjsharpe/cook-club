import { trpcServer } from "@hono/trpc-server";
import { getAuth } from "@repo/auth";
import { getDb } from "@repo/db";
import {
  DEFAULT_PRO_ACCESS_LEVEL_ID,
  processAdaptyWebhookEvent,
  recordAdaptyWebhookEvent,
} from "@repo/db/services";
import {
  appRouter,
  createContext,
  processPushNotificationReceipts,
} from "@repo/trpc/server";
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function dateValue(value: unknown): Date | null {
  const text = stringValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickString(
  payload: Record<string, unknown>,
  eventProperties: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const direct = stringValue(payload[key]);
    if (direct) return direct;
    const nested = stringValue(eventProperties[key]);
    if (nested) return nested;
  }
  return null;
}

function pickBoolean(
  payload: Record<string, unknown>,
  eventProperties: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const direct = booleanValue(payload[key]);
    if (direct !== null) return direct;
    const nested = booleanValue(eventProperties[key]);
    if (nested !== null) return nested;
  }
  return null;
}

function pickDate(
  payload: Record<string, unknown>,
  eventProperties: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const direct = dateValue(payload[key]);
    if (direct) return direct;
    const nested = dateValue(eventProperties[key]);
    if (nested) return nested;
  }
  return null;
}

app.post("/api/adapty/webhook", async (c) => {
  const expectedAuthorization = c.env.ADAPTY_WEBHOOK_AUTHORIZATION;
  if (!expectedAuthorization) {
    console.error("Adapty webhook rejected: authorization secret is not set");
    return c.json({ error: "Webhook not configured" }, 503);
  }

  if (c.req.header("authorization") !== expectedAuthorization) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const text = await c.req.text();
  if (!text.trim()) {
    return c.json({ ok: true });
  }

  let payload: Record<string, unknown>;
  try {
    payload = asRecord(JSON.parse(text));
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const eventProperties = asRecord(payload.event_properties);
  const profile = asRecord(payload.profile);
  const accessLevel = asRecord(payload.access_level);
  const proAccessLevelId =
    c.env.ADAPTY_PRO_ACCESS_LEVEL_ID ?? DEFAULT_PRO_ACCESS_LEVEL_ID;

  const customerUserId =
    pickString(payload, eventProperties, [
      "customer_user_id",
      "customerUserId",
    ]) ?? stringValue(profile.customer_user_id);
  const eventType = pickString(payload, eventProperties, [
    "event_type",
    "eventType",
  ]);
  const profileId =
    pickString(payload, eventProperties, ["profile_id", "profileId"]) ??
    stringValue(profile.profile_id);
  const accessLevelId =
    pickString(payload, eventProperties, [
      "access_level_id",
      "accessLevelId",
      "access_level_identifier",
    ]) ?? stringValue(accessLevel.id);

  const fallbackEventId = [
    profileId,
    customerUserId,
    eventType,
    payload.event_datetime,
  ]
    .filter(Boolean)
    .join(":");
  const pickedEventId = pickString(payload, eventProperties, [
    "event_id",
    "eventId",
    "id",
  ]);
  const eventId = pickedEventId ?? (fallbackEventId || crypto.randomUUID());
  const event = {
    eventId,
    eventType,
    profileId,
    customerUserId,
    payload,
  };

  if (!customerUserId) {
    await recordAdaptyWebhookEvent(getDb(c.env), event);
    return c.json({ ok: true, ignored: true });
  }

  if (accessLevelId && accessLevelId !== proAccessLevelId) {
    await recordAdaptyWebhookEvent(getDb(c.env), event);
    return c.json({ ok: true, ignored: true });
  }

  const expiresAt = pickDate(payload, eventProperties, [
    "expires_at",
    "expiresAt",
    "subscription_expires_at",
  ]);
  const explicitActive = pickBoolean(payload, eventProperties, [
    "is_active",
    "isActive",
  ]);
  const isInactiveEvent = eventType
    ? /expired|refund|revoked|billing_issue|billing issue/i.test(eventType)
    : false;
  const isActive =
    explicitActive ??
    (!isInactiveEvent && (!expiresAt || expiresAt > new Date()));
  const willRenew =
    pickBoolean(payload, eventProperties, ["will_renew", "willRenew"]) ??
    (eventType && /cancel/i.test(eventType) ? false : null);

  const isFirstDelivery = await processAdaptyWebhookEvent(getDb(c.env), {
    event,
    entitlement: {
      userId: customerUserId,
      adaptyCustomerUserId: customerUserId,
      adaptyProfileId: profileId,
      accessLevelId: accessLevelId ?? proAccessLevelId,
      isActive,
      willRenew,
      expiresAt,
      lastEventAt: pickDate(payload, eventProperties, [
        "event_datetime",
        "eventDateTime",
        "event_created_at",
      ]),
    },
  });

  return c.json({ ok: true, ignored: !isFirstDelivery });
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    endpoint: "/trpc",
    createContext: (opts, c) => {
      return createContext(opts, c.env, c.executionCtx);
    },
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

const scheduled: ExportedHandlerScheduledHandler<Env> = async (
  _event,
  env,
  _ctx,
) => {
  const result = await processPushNotificationReceipts(getDb(env), env);
  console.log(
    JSON.stringify({
      task: "push-notification-receipts",
      checked: result.checked,
      disabledTokens: result.disabledTokens,
    }),
  );
};

export default {
  fetch: app.fetch,
  scheduled,
};
