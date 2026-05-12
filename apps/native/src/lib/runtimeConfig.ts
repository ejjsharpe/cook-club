import Constants from "expo-constants";

const PRODUCTION_API_BASE_URL = "https://api.cookclub.app";
const LOCAL_SERVER_PORT = "8787";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getDevHost(): string {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0] || "localhost";
  return `http://${localhost}:${LOCAL_SERVER_PORT}`;
}

export function getAuthBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_AUTH_BASE_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_API_BASE_URL;
  }

  return getDevHost();
}

export function getApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured;
  }

  return `${getAuthBaseUrl()}/trpc`;
}
