/**
 * Error codes that map to common HTTP status codes and tRPC error codes.
 * When these errors are thrown from services, routers should catch them
 * and convert to the appropriate transport-level error (e.g., TRPCError).
 */
export type ServiceErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "INTERNAL_ERROR";

/**
 * Generic service error that can be thrown from business logic.
 * This allows services to be transport-agnostic while still providing
 * meaningful error information to callers.
 */
export class ServiceError extends Error {
  public readonly code: ServiceErrorCode;
  public readonly cause?: unknown;

  constructor(
    code: ServiceErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.cause = cause;
  }
}
