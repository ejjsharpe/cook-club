import { type } from "arktype";

import { authedProcedure, router } from "../trpc";

const RequestUploadUrlValidator = type({
  contentType: "'image/jpeg' | 'image/png' | 'image/webp'",
});

export const uploadRouter = router({
  /**
   * Request a presigned URL for uploading an image.
   * Returns a temporary key that can be used to upload directly to R2.
   */
  requestUploadUrl: authedProcedure
    .input(RequestUploadUrlValidator)
    .mutation(async ({ ctx, input }) => {
      return await ctx.env.IMAGE_WORKER.presign(input.contentType);
    }),
});
