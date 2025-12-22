import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import { storage } from "./mmkv";

export const authClient = createAuthClient({
  baseURL: "http://192.168.0.87:8787",
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
