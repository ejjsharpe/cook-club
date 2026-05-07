import { describe, expect, it, vi } from "vitest";

import {
  cleanupMovedRecipeImages,
  prepareRecipeImages,
} from "./recipe-image.service";

const createImageWorker = () => ({
  presign: vi.fn(),
  verify: vi.fn(),
  move: vi.fn(),
  delete: vi.fn(),
  uploadFromUrl: vi.fn(),
});

describe("recipe image service", () => {
  it("uses direct image URLs without moving objects", async () => {
    const imageWorker = createImageWorker();

    const result = await prepareRecipeImages(
      { images: [{ url: "https://example.com/image.jpg" }] },
      { imageWorker, imagePublicUrl: "https://images.example.com" },
    );

    expect(result).toEqual({
      images: [{ url: "https://example.com/image.jpg" }],
      movedKeys: [],
    });
    expect(imageWorker.move).not.toHaveBeenCalled();
  });

  it("moves upload IDs and returns permanent public URLs", async () => {
    const imageWorker = createImageWorker();
    imageWorker.move.mockResolvedValue({
      success: true,
      results: [
        {
          from: "temp/abc.jpg",
          to: "recipes/covers/group/img.jpg",
          success: true,
        },
      ],
    });

    const result = await prepareRecipeImages(
      { imageUploadIds: ["temp/abc.jpg"] },
      { imageWorker, imagePublicUrl: "https://images.example.com/" },
    );

    expect(imageWorker.move).toHaveBeenCalledWith([
      {
        from: "temp/abc.jpg",
        to: expect.stringMatching(/^recipes\/covers\/.+\/.+\.jpg$/),
      },
    ]);
    expect(result.images[0]?.url).toMatch(
      /^https:\/\/images\.example\.com\/recipes\/covers\/.+\/.+\.jpg$/,
    );
    expect(result.movedKeys[0]).toMatch(/^recipes\/covers\/.+\/.+\.jpg$/);
  });

  it("preserves direct image URLs when moving uploaded images", async () => {
    const imageWorker = createImageWorker();
    imageWorker.move.mockResolvedValue({
      success: true,
      results: [
        {
          from: "temp/abc.webp",
          to: "recipes/covers/group/img.webp",
          success: true,
        },
      ],
    });

    const result = await prepareRecipeImages(
      {
        images: [{ url: "https://example.com/existing.jpg" }],
        imageUploadIds: ["temp/abc.webp"],
      },
      { imageWorker, imagePublicUrl: "https://images.example.com" },
    );

    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({
      url: "https://example.com/existing.jpg",
    });
    expect(result.images[1]?.url).toMatch(
      /^https:\/\/images\.example\.com\/recipes\/covers\/.+\/.+\.webp$/,
    );
  });

  it("throws when an image move fails", async () => {
    const imageWorker = createImageWorker();
    imageWorker.move.mockResolvedValue({
      success: false,
      results: [
        {
          from: "temp/abc.jpg",
          to: "recipes/covers/group/img.jpg",
          success: false,
          error: "Source not found",
        },
      ],
    });

    await expect(
      prepareRecipeImages(
        { imageUploadIds: ["temp/abc.jpg"] },
        { imageWorker, imagePublicUrl: "https://images.example.com" },
      ),
    ).rejects.toThrow("Failed to move uploaded images");
  });

  it("cleans up successful moves when a later move fails", async () => {
    const imageWorker = createImageWorker();
    imageWorker.move.mockResolvedValue({
      success: false,
      results: [
        {
          from: "temp/abc.jpg",
          to: "recipes/covers/group/img-1.jpg",
          success: true,
        },
        {
          from: "temp/def.jpg",
          to: "recipes/covers/group/img-2.jpg",
          success: false,
          error: "Source not found",
        },
      ],
    });

    await expect(
      prepareRecipeImages(
        { imageUploadIds: ["temp/abc.jpg", "temp/def.jpg"] },
        { imageWorker, imagePublicUrl: "https://images.example.com" },
      ),
    ).rejects.toThrow("Failed to move uploaded images");

    expect(imageWorker.delete).toHaveBeenCalledWith([
      "recipes/covers/group/img-1.jpg",
    ]);
  });

  it("deletes moved objects during compensation cleanup", async () => {
    const imageWorker = createImageWorker();

    await cleanupMovedRecipeImages(imageWorker, ["recipes/covers/a/b.jpg"]);

    expect(imageWorker.delete).toHaveBeenCalledWith(["recipes/covers/a/b.jpg"]);
  });
});
