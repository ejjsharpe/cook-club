import { expo } from "@better-auth/expo";
import { getDb } from "@repo/db";
import * as schema from "@repo/db/schemas";
import { getOrCreateDefaultCollections } from "@repo/db/services";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";

const FROM_EMAIL = "Cook Club <noreply@cookclub.app>";
const AUTH_BASE_PATH = "/auth";
const SOCIAL_PROVIDERS = ["google", "facebook", "apple"] as const;
type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export interface AuthEnv {
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FB_CLIENT_ID: string;
  FB_CLIENT_SECRET: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  APPLE_BUNDLE_IDENTIFIER?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  TRUSTED_ORIGINS?: string;
}

async function sendEmail(
  env: AuthEnv,
  options: { to: string; subject: string; html: string },
) {
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    ...options,
  });
  if (error) {
    console.error("Resend error:", error);
    throw new Error(error.message);
  }
}

function getTrustedOrigins(env: AuthEnv): string[] {
  const configured =
    env.TRUSTED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return Array.from(
    new Set([
      "cookclub://",
      "https://cookclub.app",
      "https://www.cookclub.app",
      "https://api.cookclub.app",
      env.BETTER_AUTH_URL,
      ...configured,
    ]),
  );
}

function getAuthBaseUrl(env: AuthEnv): string {
  return `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}${AUTH_BASE_PATH}`;
}

function getCallbackUrl(env: AuthEnv, provider: SocialProvider): string {
  return `${getAuthBaseUrl(env)}/callback/${provider}`;
}

export function getAuth(env: AuthEnv) {
  const db = getDb(env);
  const appleProvider =
    env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_CLIENT_SECRET,
            redirectURI: getCallbackUrl(env, "apple"),
            ...(env.APPLE_BUNDLE_IDENTIFIER && {
              appBundleIdentifier: env.APPLE_BUNDLE_IDENTIFIER,
            }),
          },
        }
      : {};

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await getOrCreateDefaultCollections(db, user.id);
          },
        },
      },
    },
    plugins: [expo()],
    trustedOrigins: getTrustedOrigins(env),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        return sendEmail(env, {
          to: user.email,
          subject: "Verify your email - Cook Club",
          html: `<p>Hi ${user.name},</p><p>Welcome to Cook Club! Please verify your email by clicking the link below:</p><p><a href="${url}">Verify Email</a></p><p>If you didn't create an account, you can ignore this email.</p>`,
        });
      },
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailVerification: async ({ user, newEmail, url }) => {
          return sendEmail(env, {
            to: newEmail,
            subject: "Verify your new email - Cook Club",
            html: `<p>Hi ${user.name},</p><p>You requested to change your email address. Please verify your new email by clicking the link below:</p><p><a href="${url}">Verify Email</a></p><p>If you didn't request this change, you can ignore this email.</p>`,
          });
        },
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectURI: getCallbackUrl(env, "google"),
      },
      facebook: {
        clientId: env.FB_CLIENT_ID,
        clientSecret: env.FB_CLIENT_SECRET,
        redirectURI: getCallbackUrl(env, "facebook"),
      },
      ...appleProvider,
    },
    account: {
      accountLinking: {
        enabled: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof getAuth>;
export type AuthSession = Auth["$Infer"]["Session"]["session"];
export type AuthUser = Auth["$Infer"]["Session"]["user"];
