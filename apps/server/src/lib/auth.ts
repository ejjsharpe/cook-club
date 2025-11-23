import { expo } from "@better-auth/expo";
import { getDb } from "@repo/db";
import * as schema from "@repo/db/schemas";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { Env } from "../types";

function createAuth(env: Env) {
  return betterAuth({
    database: drizzleAdapter(getDb(env), {
      provider: "pg",
      schema,
    }),
    plugins: [expo({ disableOriginOverride: true })],
    trustedOrigins: ["cookclub://"],
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

export let auth: ReturnType<typeof createAuth>;

export function getAuth(env: Env) {
  if (!auth) {
    auth = createAuth(env);
  }

  return auth;
}
