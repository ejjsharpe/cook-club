import {
  DEFAULT_PRO_ACCESS_LEVEL_ID,
  consumeSmartImportUsage,
  getSubscriptionStatus,
  upsertSubscriptionEntitlement,
} from "@repo/db/services";
import { TRPCError } from "@trpc/server";

import type { Context } from "../context";

type AuthedContext = Context & { user: NonNullable<Context["user"]> };

interface AdaptyProfileResponse {
  data?: {
    profile_id?: string;
    customer_user_id?: string;
    access_levels?: AdaptyAccessLevel[] | Record<string, AdaptyAccessLevel>;
  };
}

interface AdaptyAccessLevel {
  access_level_id?: string;
  id?: string;
  is_active?: boolean;
  isActive?: boolean;
  will_renew?: boolean;
  willRenew?: boolean;
  renewal_cancelled_at?: string | null;
  expires_at?: string | null;
  expiresAt?: string | null;
}

export function getProAccessLevelId(ctx: Pick<Context, "env">) {
  return ctx.env.ADAPTY_PRO_ACCESS_LEVEL_ID ?? DEFAULT_PRO_ACCESS_LEVEL_ID;
}

export async function getCurrentSubscriptionStatus(ctx: AuthedContext) {
  return getSubscriptionStatus(ctx.db, ctx.user.id);
}

export async function requirePro(ctx: AuthedContext) {
  const status = await getSubscriptionStatus(ctx.db, ctx.user.id);

  if (!status.isPro) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This feature requires Cook Club Pro.",
    });
  }

  return status;
}

function smartImportLimitError() {
  return new TRPCError({
    code: "FORBIDDEN",
    message:
      "You've used your 5 free Smart Imports this month. Upgrade to Cook Club Pro for unlimited Smart Imports.",
  });
}

export async function assertSmartImportAllowance(ctx: AuthedContext) {
  const status = await getSubscriptionStatus(ctx.db, ctx.user.id);

  if (!status.isPro && (status.smartImports.remaining ?? 0) <= 0) {
    throw smartImportLimitError();
  }

  return status;
}

export async function consumeSmartImportAllowance(ctx: AuthedContext) {
  await assertSmartImportAllowance(ctx);

  const status = await consumeSmartImportUsage(ctx.db, ctx.user.id);

  if (!status.isPro && !status.consumedSmartImport) {
    throw smartImportLimitError();
  }

  return status;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAccessLevelActive(accessLevel: AdaptyAccessLevel | undefined) {
  if (!accessLevel) return false;
  const explicitActive = accessLevel.is_active ?? accessLevel.isActive;
  if (explicitActive !== undefined) return explicitActive;

  const expiresAt = parseDate(accessLevel.expires_at ?? accessLevel.expiresAt);
  return !expiresAt || expiresAt > new Date();
}

export async function refreshAdaptyEntitlement(ctx: AuthedContext) {
  const secretKey = ctx.env.ADAPTY_SECRET_API_KEY;
  const accessLevelId = getProAccessLevelId(ctx);

  if (!secretKey) {
    return getSubscriptionStatus(ctx.db, ctx.user.id);
  }

  const response = await fetch(
    "https://api.adapty.io/api/v2/server-side-api/profile/",
    {
      headers: {
        Authorization: `Api-Key ${secretKey}`,
        "adapty-customer-user-id": ctx.user.id,
      },
    },
  );

  if (response.status === 404) {
    return getSubscriptionStatus(ctx.db, ctx.user.id);
  }

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Could not refresh subscription status.",
    });
  }

  const payload = (await response.json()) as AdaptyProfileResponse;
  const profile = payload.data;
  const accessLevels = Array.isArray(profile?.access_levels)
    ? profile.access_levels
    : Object.entries(profile?.access_levels ?? {}).map(([id, level]) => ({
        id,
        ...level,
      }));
  const accessLevel = accessLevels.find(
    (level) => (level.access_level_id ?? level.id) === accessLevelId,
  );

  await upsertSubscriptionEntitlement(ctx.db, {
    userId: ctx.user.id,
    adaptyProfileId: profile?.profile_id ?? null,
    adaptyCustomerUserId: profile?.customer_user_id ?? ctx.user.id,
    accessLevelId,
    isActive: isAccessLevelActive(accessLevel),
    willRenew:
      accessLevel?.will_renew ??
      accessLevel?.willRenew ??
      (accessLevel?.renewal_cancelled_at ? false : null),
    expiresAt: parseDate(accessLevel?.expires_at ?? accessLevel?.expiresAt),
    lastEventAt: new Date(),
  });

  return getSubscriptionStatus(ctx.db, ctx.user.id);
}
