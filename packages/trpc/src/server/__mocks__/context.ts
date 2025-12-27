import { createMockDb, type MockQueryBuilder } from "./db";
import { createMockEnv } from "./env";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface MockContext {
  db: MockQueryBuilder;
  env: ReturnType<typeof createMockEnv>;
  user: MockUser;
  req: Request;
  resHeaders: Headers;
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "test-user-id",
    name: "Test User",
    email: "test@example.com",
    image: null,
    ...overrides,
  };
}

export function createMockContext(
  overrides: Partial<MockContext> = {},
): MockContext {
  return {
    db: createMockDb(),
    env: createMockEnv(),
    user: createMockUser(),
    req: new Request("http://localhost"),
    resHeaders: new Headers(),
    ...overrides,
  };
}
