import { ServiceError } from "@repo/db/services";
import { TRPCError } from "@trpc/server";

/**
 * Convert ServiceError to TRPCError for transport.
 * Maps service-layer errors to tRPC-compatible errors with appropriate codes.
 */
export function mapServiceError(err: unknown): TRPCError {
  if (err instanceof ServiceError) {
    return new TRPCError({
      code: err.code === "INTERNAL_ERROR" ? "INTERNAL_SERVER_ERROR" : err.code,
      message: err.message,
      cause: err.cause,
    });
  }
  if (err instanceof TRPCError) {
    return err;
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
}
