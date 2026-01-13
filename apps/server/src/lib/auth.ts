import { expo } from "@better-auth/expo";
import { getDb } from "@repo/db";
import * as schema from "@repo/db/schemas";
import { getOrCreateDefaultCollections } from "@repo/db/services";
import type { TRPCEnv } from "@repo/trpc/server/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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
