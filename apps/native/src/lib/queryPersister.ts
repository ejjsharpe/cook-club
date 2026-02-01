import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

import { storage } from "./mmkv";

const mmkvStorage = {
  getItem: (key: string) => {
    const value = storage.getString(key);
    return value === undefined ? null : value;
  },
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};

export const queryPersister = createAsyncStoragePersister({
  storage: mmkvStorage,
  key: "cook-club-query-cache",
  throttleTime: 1000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: "v1", // Increment when breaking cache schema changes
};
