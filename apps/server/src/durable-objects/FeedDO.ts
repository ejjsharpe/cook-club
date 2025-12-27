import type { FeedItem, GetFeedResponse } from "@repo/trpc/server/types/feed";

export type { FeedItem };

const MAX_FEED_ITEMS = 500;
const ITEMS_PREFIX = "item:";

export class FeedDO implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path === "/addFeedItem") {
      const item = await request.json() as FeedItem;
      await this.addFeedItem(item);
      return new Response("OK");
    }

    if (request.method === "POST" && path === "/addFeedItems") {
      const items = await request.json() as FeedItem[];
      await this.addFeedItems(items);
      return new Response("OK");
    }

    if (request.method === "GET" && path === "/getFeed") {
      const cursor = url.searchParams.get("cursor") ?? undefined;
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
      const result = await this.getFeed(cursor, limit);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "POST" && path === "/removeItemsFromUser") {
      const { userId } = await request.json() as { userId: string };
      await this.removeItemsFromUser(userId);
      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  }
  /**
   * Add a feed item to this user's feed.
   * Called when someone they follow does something.
   */
  async addFeedItem(item: FeedItem): Promise<void> {
    // Store item with timestamp-based key for ordering
    const key = `${ITEMS_PREFIX}${item.createdAt}-${item.id}`;
    await this.state.storage.put(key, item);

    // Prune old items if we have too many
    await this.maybePrune();
  }

  /**
   * Add multiple feed items at once (for backfill on follow).
   */
  async addFeedItems(items: FeedItem[]): Promise<void> {
    const entries: Record<string, FeedItem> = {};
    for (const item of items) {
      const key = `${ITEMS_PREFIX}${item.createdAt}-${item.id}`;
      entries[key] = item;
    }
    await this.state.storage.put(entries);
    await this.maybePrune();
  }

  /**
   * Get paginated feed items.
   * Items are returned in reverse chronological order (newest first).
   */
  async getFeed(cursor?: string, limit: number = 20): Promise<GetFeedResponse> {
    // Get all items with the prefix
    const allItems = await this.state.storage.list<FeedItem>({
      prefix: ITEMS_PREFIX,
      reverse: true, // Newest first
    });

    const items: FeedItem[] = [];
    let foundCursor = !cursor; // If no cursor, start from beginning
    let nextCursor: string | null = null;
    let count = 0;

    for (const [key, item] of allItems) {
      // Skip items until we find the cursor
      if (!foundCursor) {
        if (key === cursor) {
          foundCursor = true;
        }
        continue;
      }

      // Collect items up to the limit
      if (count < limit) {
        items.push(item);
        count++;
      } else {
        // We have one more item, so there's a next page
        nextCursor = key;
        break;
      }
    }

    return { items, nextCursor };
  }

  /**
   * Remove all items from a specific user (e.g., when unfollowed).
   */
  async removeItemsFromUser(userId: string): Promise<void> {
    const allItems = await this.state.storage.list<FeedItem>({
      prefix: ITEMS_PREFIX,
    });

    const keysToDelete: string[] = [];
    for (const [key, item] of allItems) {
      if (item.actorId === userId) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length > 0) {
      await this.state.storage.delete(keysToDelete);
    }
  }

  /**
   * Prune old items if we exceed the maximum.
   */
  private async maybePrune(): Promise<void> {
    const allItems = await this.state.storage.list<FeedItem>({
      prefix: ITEMS_PREFIX,
    });

    if (allItems.size <= MAX_FEED_ITEMS) {
      return;
    }

    // Get keys sorted by timestamp (oldest first)
    const keys = Array.from(allItems.keys()).sort();
    const keysToDelete = keys.slice(0, keys.length - MAX_FEED_ITEMS);

    if (keysToDelete.length > 0) {
      await this.state.storage.delete(keysToDelete);
    }
  }
}
