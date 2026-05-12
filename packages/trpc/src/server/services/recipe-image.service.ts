import type { ImageService } from "@repo/contracts/images";
import { TRPCError } from "@trpc/server";

interface RecipeImageInput {
  images?: { url: string }[];
  imageUploadIds?: string[];
}

interface PrepareRecipeImagesDeps {
  imageService: ImageService;
  imagePublicUrl: string;
  ownerId: string;
}

export interface PreparedRecipeImages {
  images: { url: string }[];
  movedKeys: string[];
}

export async function prepareRecipeImages(
  input: RecipeImageInput,
  deps: PrepareRecipeImagesDeps,
): Promise<PreparedRecipeImages> {
  const hasUploadIds = input.imageUploadIds && input.imageUploadIds.length > 0;

  if (!hasUploadIds) {
    return { images: input.images ?? [], movedKeys: [] };
  }

  const assetGroupId = crypto.randomUUID();
  const moves = input.imageUploadIds!.map((uploadId) => {
    const ext = uploadId.split(".").pop()?.toLowerCase() || "jpg";
    const imageId = crypto.randomUUID();
    return {
      from: uploadId,
      to: `recipes/covers/${assetGroupId}/${imageId}.${ext}`,
    };
  });

  const moveResult = await deps.imageService.move(moves, deps.ownerId);
  const successfulMovedKeys = moveResult.results
    .filter((result) => result.success)
    .map((result) => result.to);

  if (!moveResult.success) {
    await cleanupMovedRecipeImages(deps.imageService, successfulMovedKeys);

    const failedMoves = moveResult.results.filter((result) => !result.success);
    const message = failedMoves
      .map((result) => `${result.from} -> ${result.to}: ${result.error}`)
      .join(", ");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to move uploaded images: ${message}`,
    });
  }

  const publicUrl = deps.imagePublicUrl.replace(/\/$/, "");
  const movedImages = moves.map((move) => ({ url: `${publicUrl}/${move.to}` }));

  return {
    images: [...(input.images ?? []), ...movedImages],
    movedKeys: moves.map((move) => move.to),
  };
}

export async function cleanupMovedRecipeImages(
  imageService: ImageService,
  movedKeys: string[],
) {
  if (movedKeys.length === 0) return;

  try {
    await imageService.delete(movedKeys);
  } catch (err) {
    console.error("Failed to clean up moved recipe images:", err);
  }
}
