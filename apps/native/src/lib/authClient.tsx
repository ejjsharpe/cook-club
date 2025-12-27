import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";

import { storage } from "./mmkv";

const getBaseUrl = () => {
  if (process.env.NODE_ENV === "production") {
    return "https://your-production-url.com"; // TODO: update for production
  }
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];
  return `http://${localhost}:8787`;
};

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
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
