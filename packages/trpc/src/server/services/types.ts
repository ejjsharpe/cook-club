import type { Context } from "../context";

// Database client types (following shopping-router pattern)
export type DbClient = Context["db"];
export type TransactionClient = Parameters<
  Parameters<DbClient["transaction"]>[0]
>[0];
