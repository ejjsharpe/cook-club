import { vi } from "vitest";

export function createMockDurableObjectStub() {
  return {
    fetch: vi.fn().mockResolvedValue(new Response("OK")),
  };
}

export function createMockDurableObjectNamespace() {
  const stub = createMockDurableObjectStub();
  return {
    idFromName: vi.fn().mockReturnValue({ toString: () => "mock-do-id" }),
    get: vi.fn().mockReturnValue(stub),
    _stub: stub, // Expose for test assertions
  };
}

export function createMockEnv() {
  return {
    USER_FEED: createMockDurableObjectNamespace(),
    DATABASE_URL: "mock://database",
    GOOGLE_CLIENT_ID: "mock-google-id",
    GOOGLE_CLIENT_SECRET: "mock-google-secret",
    BETTER_AUTH_SECRET: "mock-auth-secret",
    BETTER_AUTH_URL: "http://localhost:8787",
    FB_CLIENT_ID: "mock-fb-id",
    FB_CLIENT_SECRET: "mock-fb-secret",
    RECIPE_PARSER: {
      parse: vi.fn(),
      chat: vi.fn(),
    },
  };
}
