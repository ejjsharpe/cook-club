import { storage } from "./mmkv";

export type PendingShareIntentType = "url" | "text" | "image";

export interface PendingShareIntent {
  type: PendingShareIntentType;
  content: string; // URL, text content, or base64 image data
  mimeType?: string; // For images
  timestamp: number;
}

const PENDING_SHARE_INTENT_KEY = "pending_share_intent";

export function getPendingShareIntent(): PendingShareIntent | null {
  const stored = storage.getString(PENDING_SHARE_INTENT_KEY);
  if (!stored) return null;

  try {
    const intent = JSON.parse(stored) as PendingShareIntent;
    // Expire intents older than 24 hours
    if (Date.now() - intent.timestamp > 24 * 60 * 60 * 1000) {
      clearPendingShareIntent();
      return null;
    }
    return intent;
  } catch {
    clearPendingShareIntent();
    return null;
  }
}

export function setPendingShareIntent(
  intent: Omit<PendingShareIntent, "timestamp">,
): void {
  const intentWithTimestamp: PendingShareIntent = {
    ...intent,
    timestamp: Date.now(),
  };
  storage.set(PENDING_SHARE_INTENT_KEY, JSON.stringify(intentWithTimestamp));
}

export function clearPendingShareIntent(): void {
  storage.delete(PENDING_SHARE_INTENT_KEY);
}
