import { describe, it, expect, beforeEach, vi } from "vitest";

import { FeedDO } from "./FeedDO";

const BASE_TIME = 1_700_000_000_000;

interface FeedEntry {
  activityEventId: number;
  createdAt: number;
}

function createMockStorage() {
  const storage = new Map<string, unknown>();

  return {
    get: vi.fn(async (key: string) => storage.get(key)),
    put: vi.fn(
      async (keyOrEntries: string | Record<string, unknown>, value?: unknown) => {
        if (typeof keyOrEntries === "string") {
          storage.set(keyOrEntries, value);
          return;
        }

        for (const [key, entryValue] of Object.entries(keyOrEntries)) {
          storage.set(key, entryValue);
        }
      },
    ),
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
      entries.sort((a, b) => a[0].localeCompare(b[0]));
      if (options?.reverse) {
        entries.reverse();
      }
      return new Map(entries);
    }),
    _storage: storage,
  };
}

function createMockState() {
  const mockStorage = createMockStorage();
  return {
    storage: mockStorage,
    _storage: mockStorage._storage,
  };
}

function createFeedEntry(
  activityEventId: number,
  createdAt = BASE_TIME + activityEventId,
): FeedEntry {
  return { activityEventId, createdAt };
}

async function readFeedIds(response: Response) {
  return (await response.json()) as {
    activityIds: number[];
    nextCursor: string | null;
  };
}

describe("FeedDO", () => {
  let feedDO: FeedDO;
  let mockState: ReturnType<typeof createMockState>;

  beforeEach(() => {
    mockState = createMockState();
    feedDO = new FeedDO(mockState as unknown as DurableObjectState);
  });

  describe("fetch routing", () => {
    it("routes POST /addActivityId correctly", async () => {
      const response = await feedDO.fetch(
        new Request("http://do/addActivityId", {
          method: "POST",
          body: JSON.stringify(createFeedEntry(123)),
          headers: { "Content-Type": "application/json" },
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("OK");
      expect(mockState._storage.size).toBe(1);
    });

    it("routes POST /addActivityIds correctly", async () => {
      const response = await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify([createFeedEntry(1), createFeedEntry(2)]),
          headers: { "Content-Type": "application/json" },
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("OK");
      expect(mockState._storage.size).toBe(2);
    });

    it("routes GET /getFeedIds correctly", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityId", {
          method: "POST",
          body: JSON.stringify(createFeedEntry(123)),
        }),
      );

      const response = await feedDO.fetch(new Request("http://do/getFeedIds"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(await readFeedIds(response)).toEqual({
        activityIds: [123],
        nextCursor: null,
      });
    });

    it("routes POST /removeActivityIds correctly", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityId", {
          method: "POST",
          body: JSON.stringify(createFeedEntry(123)),
        }),
      );
      expect(mockState._storage.size).toBe(1);

      const response = await feedDO.fetch(
        new Request("http://do/removeActivityIds", {
          method: "POST",
          body: JSON.stringify({ activityIds: [123] }),
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("OK");
      expect(mockState._storage.size).toBe(0);
    });

    it("routes POST /clear correctly", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify([createFeedEntry(1), createFeedEntry(2)]),
        }),
      );

      const response = await feedDO.fetch(
        new Request("http://do/clear", { method: "POST" }),
      );

      expect(response.status).toBe(200);
      expect(mockState._storage.size).toBe(0);
    });

    it("returns 404 for unknown routes", async () => {
      const response = await feedDO.fetch(new Request("http://do/unknownRoute"));

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    });
  });

  describe("addActivityId", () => {
    it("stores activity ID with timestamp-based key", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityId", {
          method: "POST",
          body: JSON.stringify(createFeedEntry(123, BASE_TIME)),
        }),
      );

      expect(Array.from(mockState._storage.keys())).toEqual([
        `item:${BASE_TIME}-123`,
      ]);
      expect(mockState._storage.get(`item:${BASE_TIME}-123`)).toBe(123);
    });
  });

  describe("addActivityIds", () => {
    it("batch stores multiple activity IDs", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify([
            createFeedEntry(1, BASE_TIME + 1),
            createFeedEntry(2, BASE_TIME + 2),
            createFeedEntry(3, BASE_TIME + 3),
          ]),
        }),
      );

      expect(mockState._storage.size).toBe(3);
      expect(mockState._storage.has(`item:${BASE_TIME + 1}-1`)).toBe(true);
      expect(mockState._storage.has(`item:${BASE_TIME + 2}-2`)).toBe(true);
      expect(mockState._storage.has(`item:${BASE_TIME + 3}-3`)).toBe(true);
    });

    it("handles empty arrays", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify([]),
        }),
      );

      expect(mockState._storage.size).toBe(0);
    });
  });

  describe("getFeedIds", () => {
    it("returns activity IDs in reverse chronological order", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify([
            createFeedEntry(10, BASE_TIME + 1),
            createFeedEntry(30, BASE_TIME + 3),
            createFeedEntry(20, BASE_TIME + 2),
          ]),
        }),
      );

      const result = await readFeedIds(
        await feedDO.fetch(new Request("http://do/getFeedIds?limit=10")),
      );

      expect(result.activityIds).toEqual([30, 20, 10]);
    });

    it("respects the limit parameter", async () => {
      const entries = Array.from({ length: 10 }, (_, index) =>
        createFeedEntry(index, BASE_TIME + index),
      );
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify(entries),
        }),
      );

      const result = await readFeedIds(
        await feedDO.fetch(new Request("http://do/getFeedIds?limit=3")),
      );

      expect(result.activityIds).toEqual([9, 8, 7]);
    });

    it("returns the last included key as nextCursor when more items exist", async () => {
      const entries = Array.from({ length: 5 }, (_, index) =>
        createFeedEntry(index, BASE_TIME + index),
      );
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify(entries),
        }),
      );

      const result = await readFeedIds(
        await feedDO.fetch(new Request("http://do/getFeedIds?limit=3")),
      );

      expect(result.activityIds).toEqual([4, 3, 2]);
      expect(result.nextCursor).toBe(`item:${BASE_TIME + 2}-2`);
    });

    it("returns null nextCursor when no more items exist", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify([createFeedEntry(1), createFeedEntry(2)]),
        }),
      );

      const result = await readFeedIds(
        await feedDO.fetch(new Request("http://do/getFeedIds?limit=10")),
      );

      expect(result).toEqual({ activityIds: [2, 1], nextCursor: null });
    });

    it("paginates without skipping the first item after the cursor", async () => {
      const entries = Array.from({ length: 6 }, (_, index) =>
        createFeedEntry(index, BASE_TIME + index),
      );
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify(entries),
        }),
      );

      const firstPage = await readFeedIds(
        await feedDO.fetch(new Request("http://do/getFeedIds?limit=3")),
      );
      const secondPage = await readFeedIds(
        await feedDO.fetch(
          new Request(
            `http://do/getFeedIds?limit=3&cursor=${encodeURIComponent(
              firstPage.nextCursor!,
            )}`,
          ),
        ),
      );

      expect(firstPage.activityIds).toEqual([5, 4, 3]);
      expect(secondPage.activityIds).toEqual([2, 1, 0]);
      expect(secondPage.nextCursor).toBeNull();
    });
  });

  describe("removeActivityIds", () => {
    it("removes requested activity IDs", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify([
            createFeedEntry(1),
            createFeedEntry(2),
            createFeedEntry(3),
          ]),
        }),
      );

      await feedDO.fetch(
        new Request("http://do/removeActivityIds", {
          method: "POST",
          body: JSON.stringify({ activityIds: [1, 3] }),
        }),
      );

      expect(mockState._storage.size).toBe(1);
      const result = await readFeedIds(
        await feedDO.fetch(new Request("http://do/getFeedIds")),
      );
      expect(result.activityIds).toEqual([2]);
    });

    it("leaves unrelated activity IDs intact", async () => {
      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify([createFeedEntry(1), createFeedEntry(2)]),
        }),
      );

      await feedDO.fetch(
        new Request("http://do/removeActivityIds", {
          method: "POST",
          body: JSON.stringify({ activityIds: [999] }),
        }),
      );

      expect(mockState._storage.size).toBe(2);
    });
  });

  describe("maybePrune", () => {
    it("removes oldest items when exceeding MAX_FEED_ITEMS", async () => {
      const entries = Array.from({ length: 502 }, (_, index) =>
        createFeedEntry(index, BASE_TIME + index),
      );

      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify(entries),
        }),
      );

      expect(mockState._storage.size).toBe(500);
      expect(mockState._storage.has(`item:${BASE_TIME}-0`)).toBe(false);
      expect(mockState._storage.has(`item:${BASE_TIME + 1}-1`)).toBe(false);
      expect(mockState._storage.has(`item:${BASE_TIME + 501}-501`)).toBe(true);
    });

    it("does nothing when under the item limit", async () => {
      const entries = Array.from({ length: 50 }, (_, index) =>
        createFeedEntry(index, BASE_TIME + index),
      );

      await feedDO.fetch(
        new Request("http://do/addActivityIds", {
          method: "POST",
          body: JSON.stringify(entries),
        }),
      );

      expect(mockState._storage.size).toBe(50);
    });
  });
});
