import { expo } from "@better-auth/expo";
import { getDb } from "@repo/db";
import * as schema from "@repo/db/schemas";
import { getOrCreateDefaultCollections } from "@repo/db/services";
import type { TRPCEnv } from "@repo/trpc/server/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";

const FROM_EMAIL = "Cook Club <noreply@cookclub.app>";

async function sendEmail(
  env: TRPCEnv,
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

export function getAuth(env: TRPCEnv) {
  const db = getDb(env);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Create default collections for new users
            await getOrCreateDefaultCollections(db, user.id);
          },
        },
      },
    },
    plugins: [expo({ disableOriginOverride: true })],
    trustedOrigins: ["cookclub://"],
    advanced: { disableOriginCheck: true },
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
      },
      facebook: {
        clientId: env.FB_CLIENT_ID,
        clientSecret: env.FB_CLIENT_SECRET,
      },
      // apple: {
      //   clientId: "",
      //   clientSecret: "",
      //   appBundleIdentifier: "",
      // },
    },
    account: {
      accountLinking: {
        enabled: true,
      },
    },
  });
}
