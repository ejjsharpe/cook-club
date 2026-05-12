import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import { storage } from "./mmkv";
import { getAuthBaseUrl } from "./runtimeConfig";

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  basePath: "/auth",
  plugins: [
    expoClient({
      scheme: "cookclub",
      storagePrefix: "cookclub",
      storage: {
        getItem: (key) => storage.getString(key) ?? null,
        setItem: (key, val) => storage.set(key, val),
      },
    }),
  ],
});
