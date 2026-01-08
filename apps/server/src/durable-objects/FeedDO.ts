const MAX_FEED_ITEMS = 500;
const ITEMS_PREFIX = "item:";

interface FeedEntry {
  activityEventId: number;
  createdAt: number;
}

interface GetFeedIdsResponse {
  activityIds: number[];
  nextCursor: string | null;
}

export class FeedDO implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /addActivityId - add single activity ID
    if (request.method === "POST" && path === "/addActivityId") {
      const entry = (await request.json()) as FeedEntry;
      await this.addActivityId(entry);
      return new Response("OK");
    }

    // POST /addActivityIds - bulk add (for backfill on follow)
    if (request.method === "POST" && path === "/addActivityIds") {
      const entries = (await request.json()) as FeedEntry[];
      await this.addActivityIds(entries);
      return new Response("OK");
    }

    // GET /getFeedIds - get paginated activity IDs
    if (request.method === "GET" && path === "/getFeedIds") {
      const cursor = url.searchParams.get("cursor") ?? undefined;
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
      const result = await this.getFeedIds(cursor, limit);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /removeActivityIds - remove specific activity IDs
    if (request.method === "POST" && path === "/removeActivityIds") {
      const { activityIds } = (await request.json()) as {
        activityIds: number[];
      };
      await this.removeActivityIds(activityIds);
      return new Response("OK");
    }

    // POST /clear - clear all items (for migration/dev)
    if (request.method === "POST" && path === "/clear") {
      await this.clear();
      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * Add a single activity ID to this user's feed.
   */
  async addActivityId(entry: FeedEntry): Promise<void> {
    const key = `${ITEMS_PREFIX}${entry.createdAt}-${entry.activityEventId}`;
    await this.state.storage.put(key, entry.activityEventId);
    await this.maybePrune();
  }

  /**
   * Add multiple activity IDs at once (for backfill on follow).
   */
  async addActivityIds(entries: FeedEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const puts: Record<string, number> = {};
    for (const entry of entries) {
      const key = `${ITEMS_PREFIX}${entry.createdAt}-${entry.activityEventId}`;
      puts[key] = entry.activityEventId;
    }
    await this.state.storage.put(puts);
    await this.maybePrune();
  }

  /**
   * Get paginated activity IDs.
   * IDs are returned in reverse chronological order (newest first).
   */
  async getFeedIds(
    cursor?: string,
    limit: number = 20
  ): Promise<GetFeedIdsResponse> {
    const allItems = await this.state.storage.list<number>({
      prefix: ITEMS_PREFIX,
      reverse: true, // Newest first
    });

    const activityIds: number[] = [];
    let foundCursor = !cursor;
    let nextCursor: string | null = null;
    let count = 0;

    for (const [key, activityId] of allItems) {
      if (!foundCursor) {
        if (key === cursor) {
          foundCursor = true;
        }
        continue;
      }

      if (count < limit) {
        activityIds.push(activityId);
        count++;
      } else {
        nextCursor = key;
        break;
      }
    }

    return { activityIds, nextCursor };
  }

  /**
   * Remove specific activity IDs (e.g., when user unfollows someone).
   */
  async removeActivityIds(activityIds: number[]): Promise<void> {
    if (activityIds.length === 0) return;

    const activityIdSet = new Set(activityIds);
    const allItems = await this.state.storage.list<number>({
      prefix: ITEMS_PREFIX,
    });

    const keysToDelete: string[] = [];
    for (const [key, activityId] of allItems) {
      if (activityIdSet.has(activityId)) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length > 0) {
      await this.state.storage.delete(keysToDelete);
    }
  }

  /**
   * Clear all items from the feed (for migration/dev).
   */
  async clear(): Promise<void> {
    const allItems = await this.state.storage.list<number>({
      prefix: ITEMS_PREFIX,
    });
    const keys = Array.from(allItems.keys());
    if (keys.length > 0) {
      await this.state.storage.delete(keys);
    }
  }

  /**
   * Prune old items if we exceed the maximum.
   */
  private async maybePrune(): Promise<void> {
    const allItems = await this.state.storage.list<number>({
      prefix: ITEMS_PREFIX,
    });

    if (allItems.size <= MAX_FEED_ITEMS) {
      return;
    }

    const keys = Array.from(allItems.keys()).sort();
    const keysToDelete = keys.slice(0, keys.length - MAX_FEED_ITEMS);

    if (keysToDelete.length > 0) {
      await this.state.storage.delete(keysToDelete);
    }
  }
}
