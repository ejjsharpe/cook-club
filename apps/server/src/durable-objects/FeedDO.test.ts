import { describe, it, expect, beforeEach, vi } from "vitest";
import { FeedDO } from "./FeedDO";
import type { FeedItem } from "@repo/trpc/server/types/feed";

// Create a mock storage that simulates DurableObjectStorage
function createMockStorage() {
  const storage = new Map<string, unknown>();

  return {
    get: vi.fn(async (key: string) => storage.get(key)),
    put: vi.fn(async (keyOrEntries: string | Record<string, unknown>, value?: unknown) => {
      if (typeof keyOrEntries === "string") {
        storage.set(keyOrEntries, value);
      } else {
        for (const [k, v] of Object.entries(keyOrEntries)) {
          storage.set(k, v);
        }
      }
    }),
    delete: vi.fn(async (keys: string | string[]) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      for (const key of keysArray) {
        storage.delete(key);
      }
      return keysArray.length > 0;
    }),
    list: vi.fn(async <T>(options?: { prefix?: string; reverse?: boolean }) => {
      const entries: [string, T][] = [];
      for (const [key, value] of storage.entries()) {
        if (!options?.prefix || key.startsWith(options.prefix)) {
          entries.push([key, value as T]);
        }
      }
      // Sort by key
      entries.sort((a, b) => a[0].localeCompare(b[0]));
      if (options?.reverse) {
        entries.reverse();
      }
      return new Map(entries);
    }),
    _storage: storage, // Expose for test inspection
  };
}

function createMockState() {
  const mockStorage = createMockStorage();
  return {
    storage: mockStorage,
    _storage: mockStorage._storage,
  };
}

function createFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  const base = {
    id: "1",
    type: "recipe_import" as const,
    actor: {
      id: "user-1",
      name: "Test User",
      image: null,
    },
    recipe: {
      id: 1,
      name: "Test Recipe",
      image: null,
      sourceType: "manual" as const,
    },
    createdAt: Date.now(),
  };
  return { ...base, ...overrides } as FeedItem;
}

describe("FeedDO", () => {
  let feedDO: FeedDO;
  let mockState: ReturnType<typeof createMockState>;

  beforeEach(() => {
    mockState = createMockState();
    feedDO = new FeedDO(mockState as unknown as DurableObjectState);
  });

  describe("fetch routing", () => {
    it("routes POST /addFeedItem correctly", async () => {
      const item = createFeedItem();
      const request = new Request("http://do/addFeedItem", {
        method: "POST",
        body: JSON.stringify(item),
        headers: { "Content-Type": "application/json" },
      });

      const response = await feedDO.fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("OK");
      expect(mockState._storage.size).toBe(1);
    });

    it("routes POST /addFeedItems correctly", async () => {
      const items = [
        createFeedItem({ id: "1", createdAt: 1000 }),
        createFeedItem({ id: "2", createdAt: 2000 }),
      ];
      const request = new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
        headers: { "Content-Type": "application/json" },
      });

      const response = await feedDO.fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("OK");
      expect(mockState._storage.size).toBe(2);
    });

    it("routes GET /getFeed correctly", async () => {
      // Add some items first
      const item = createFeedItem();
      await feedDO.fetch(new Request("http://do/addFeedItem", {
        method: "POST",
        body: JSON.stringify(item),
      }));

      const request = new Request("http://do/getFeed?limit=20");

      const response = await feedDO.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const result = await response.json() as { items: FeedItem[] };
      expect(result.items).toHaveLength(1);
    });

    it("routes POST /removeItemsFromUser correctly", async () => {
      // Add an item first
      const item = createFeedItem({ actor: { id: "user-to-remove", name: "Test", image: null } });
      await feedDO.fetch(new Request("http://do/addFeedItem", {
        method: "POST",
        body: JSON.stringify(item),
      }));
      expect(mockState._storage.size).toBe(1);

      const request = new Request("http://do/removeItemsFromUser", {
        method: "POST",
        body: JSON.stringify({ userId: "user-to-remove" }),
      });

      const response = await feedDO.fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("OK");
      expect(mockState._storage.size).toBe(0);
    });

    it("returns 404 for unknown routes", async () => {
      const request = new Request("http://do/unknownRoute");

      const response = await feedDO.fetch(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    });
  });

  describe("addFeedItem", () => {
    it("stores item with timestamp-based key", async () => {
      const item = createFeedItem({ id: "123", createdAt: 1705312800000 });

      await feedDO.fetch(new Request("http://do/addFeedItem", {
        method: "POST",
        body: JSON.stringify(item),
      }));

      const keys = Array.from(mockState._storage.keys());
      expect(keys).toHaveLength(1);
      expect(keys[0]).toBe("item:1705312800000-123");
    });
  });

  describe("addFeedItems", () => {
    it("batch stores multiple items", async () => {
      const items = [
        createFeedItem({ id: "1", createdAt: 1000 }),
        createFeedItem({ id: "2", createdAt: 2000 }),
        createFeedItem({ id: "3", createdAt: 3000 }),
      ];

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      expect(mockState._storage.size).toBe(3);
      expect(mockState._storage.has("item:1000-1")).toBe(true);
      expect(mockState._storage.has("item:2000-2")).toBe(true);
      expect(mockState._storage.has("item:3000-3")).toBe(true);
    });

    it("handles empty array", async () => {
      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify([]),
      }));

      expect(mockState._storage.size).toBe(0);
    });
  });

  describe("getFeed", () => {
    it("returns items in reverse chronological order", async () => {
      const items = [
        createFeedItem({ id: "1", createdAt: 1000, recipe: { id: 1, name: "First", image: null, sourceType: "manual" } }),
        createFeedItem({ id: "2", createdAt: 3000, recipe: { id: 2, name: "Third", image: null, sourceType: "manual" } }),
        createFeedItem({ id: "3", createdAt: 2000, recipe: { id: 3, name: "Second", image: null, sourceType: "manual" } }),
      ];

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      const response = await feedDO.fetch(new Request("http://do/getFeed?limit=10"));
      const result = await response.json() as { items: FeedItem[]; nextCursor: string | null };

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.recipe.name).toBe("Third");
      expect(result.items[1]!.recipe.name).toBe("Second");
      expect(result.items[2]!.recipe.name).toBe("First");
    });

    it("respects limit parameter", async () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createFeedItem({ id: String(i), createdAt: i * 1000 })
      );

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      const response = await feedDO.fetch(new Request("http://do/getFeed?limit=3"));
      const result = await response.json() as { items: FeedItem[]; nextCursor: string | null };

      expect(result.items).toHaveLength(3);
    });

    it("returns nextCursor when more items exist", async () => {
      const items = Array.from({ length: 5 }, (_, i) =>
        createFeedItem({ id: String(i), createdAt: i * 1000 })
      );

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      const response = await feedDO.fetch(new Request("http://do/getFeed?limit=3"));
      const result = await response.json() as { items: FeedItem[]; nextCursor: string | null };

      expect(result.nextCursor).not.toBeNull();
      expect(result.nextCursor).toBe("item:1000-1"); // 4th item (0-indexed: id=1, createdAt=1000)
    });

    it("returns null nextCursor when no more items", async () => {
      const items = [
        createFeedItem({ id: "1", createdAt: 1000 }),
        createFeedItem({ id: "2", createdAt: 2000 }),
      ];

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      const response = await feedDO.fetch(new Request("http://do/getFeed?limit=10"));
      const result = await response.json() as { items: FeedItem[]; nextCursor: string | null };

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it("handles cursor-based pagination", async () => {
      const items = Array.from({ length: 6 }, (_, i) =>
        createFeedItem({ id: String(i), createdAt: i * 1000 })
      );

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      // First page
      const response1 = await feedDO.fetch(new Request("http://do/getFeed?limit=3"));
      const result1 = await response1.json() as { items: FeedItem[]; nextCursor: string | null };

      expect(result1.items).toHaveLength(3);
      expect(result1.items[0]!.id).toBe("5"); // Newest first (createdAt: 5000)
      expect(result1.items[1]!.id).toBe("4");
      expect(result1.items[2]!.id).toBe("3");
      expect(result1.nextCursor).not.toBeNull();

      // Second page using cursor - should get remaining 3 items
      const response2 = await feedDO.fetch(
        new Request(`http://do/getFeed?limit=3&cursor=${encodeURIComponent(result1.nextCursor!)}`)
      );
      const result2 = await response2.json() as { items: FeedItem[]; nextCursor: string | null };

      // Second page gets items after the cursor position
      expect(result2.items.length).toBeGreaterThan(0);
      // Verify we're getting the remaining items (not overlapping with first page)
      const firstPageIds = result1.items.map(i => i.id);
      const secondPageIds = result2.items.map(i => i.id);
      expect(firstPageIds.some(id => secondPageIds.includes(id))).toBe(false);
    });
  });

  describe("removeItemsFromUser", () => {
    it("removes all items from specified user", async () => {
      const items = [
        createFeedItem({ id: "1", actor: { id: "user-a", name: "User A", image: null }, createdAt: 1000 }),
        createFeedItem({ id: "2", actor: { id: "user-b", name: "User B", image: null }, createdAt: 2000 }),
        createFeedItem({ id: "3", actor: { id: "user-a", name: "User A", image: null }, createdAt: 3000 }),
      ];

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));
      expect(mockState._storage.size).toBe(3);

      await feedDO.fetch(new Request("http://do/removeItemsFromUser", {
        method: "POST",
        body: JSON.stringify({ userId: "user-a" }),
      }));

      expect(mockState._storage.size).toBe(1);

      const response = await feedDO.fetch(new Request("http://do/getFeed"));
      const result = await response.json() as { items: FeedItem[] };

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.actor.id).toBe("user-b");
    });

    it("leaves other users items intact", async () => {
      const items = [
        createFeedItem({ id: "1", actor: { id: "user-a", name: "User A", image: null }, createdAt: 1000 }),
        createFeedItem({ id: "2", actor: { id: "user-b", name: "User B", image: null }, createdAt: 2000 }),
      ];

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      await feedDO.fetch(new Request("http://do/removeItemsFromUser", {
        method: "POST",
        body: JSON.stringify({ userId: "user-c" }), // User with no items
      }));

      expect(mockState._storage.size).toBe(2); // All items remain
    });
  });

  describe("maybePrune", () => {
    it("removes oldest items when exceeding MAX_FEED_ITEMS", async () => {
      // MAX_FEED_ITEMS is 500 - we'll add 502 items
      const items = Array.from({ length: 502 }, (_, i) =>
        createFeedItem({ id: String(i), createdAt: i })
      );

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      // Should have pruned down to 500
      expect(mockState._storage.size).toBe(500);

      // The oldest items (id: 0, 1) should be deleted
      expect(mockState._storage.has("item:0-0")).toBe(false);
      expect(mockState._storage.has("item:1-1")).toBe(false);

      // Newer items should remain
      expect(mockState._storage.has("item:501-501")).toBe(true);
    });

    it("does nothing when under limit", async () => {
      const items = Array.from({ length: 50 }, (_, i) =>
        createFeedItem({ id: String(i), createdAt: i * 1000 })
      );

      await feedDO.fetch(new Request("http://do/addFeedItems", {
        method: "POST",
        body: JSON.stringify(items),
      }));

      expect(mockState._storage.size).toBe(50);
    });
  });
});
