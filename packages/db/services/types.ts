import type { DbType } from "../index";

/**
 * Database client type for service functions.
 * This is the main Drizzle database instance.
 */
export type DbClient = DbType;

/**
 * Transaction client type for use within db.transaction() callbacks.
 * Extracts the transaction parameter type from Drizzle's transaction method.
 */
export type TransactionClient = Parameters<
  Parameters<DbType["transaction"]>[0]
>[0];
