import { describe, expect, it, vi } from "vitest";

import {
  cleanupMovedRecipeImages,
  prepareRecipeImages,
} from "./recipe-image.service";

const createImageService = () => ({
  presign: vi.fn(),
  verify: vi.fn(),
  move: vi.fn(),
  delete: vi.fn(),
  uploadFromUrl: vi.fn(),
  uploadImage: vi.fn(),
});

describe("recipe image service", () => {
  it("uses direct image URLs without moving objects", async () => {
    const imageService = createImageService();

    const result = await prepareRecipeImages(
      { images: [{ url: "https://example.com/image.jpg" }] },
      {
        imageService,
        imagePublicUrl: "https://images.example.com",
        ownerId: "user-id",
      },
    );

    expect(result).toEqual({
      images: [{ url: "https://example.com/image.jpg" }],
      movedKeys: [],
    });
    expect(imageService.move).not.toHaveBeenCalled();
  });

  it("moves upload IDs and returns permanent public URLs", async () => {
    const imageService = createImageService();
    imageService.move.mockResolvedValue({
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
      {
        imageService,
        imagePublicUrl: "https://images.example.com/",
        ownerId: "user-id",
      },
    );

    expect(imageService.move).toHaveBeenCalledWith(
      [
        {
          from: "temp/abc.jpg",
          to: expect.stringMatching(/^recipes\/covers\/.+\/.+\.jpg$/),
        },
      ],
      "user-id",
    );
    expect(result.images[0]?.url).toMatch(
      /^https:\/\/images\.example\.com\/recipes\/covers\/.+\/.+\.jpg$/,
    );
    expect(result.movedKeys[0]).toMatch(/^recipes\/covers\/.+\/.+\.jpg$/);
  });

  it("preserves direct image URLs when moving uploaded images", async () => {
    const imageService = createImageService();
    imageService.move.mockResolvedValue({
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
      {
        imageService,
        imagePublicUrl: "https://images.example.com",
        ownerId: "user-id",
      },
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
    const imageService = createImageService();
    imageService.move.mockResolvedValue({
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
        {
          imageService,
          imagePublicUrl: "https://images.example.com",
          ownerId: "user-id",
        },
      ),
    ).rejects.toThrow("Failed to move uploaded images");
  });

  it("cleans up successful moves when a later move fails", async () => {
    const imageService = createImageService();
    imageService.move.mockResolvedValue({
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
        {
          imageService,
          imagePublicUrl: "https://images.example.com",
          ownerId: "user-id",
        },
      ),
    ).rejects.toThrow("Failed to move uploaded images");

    expect(imageService.delete).toHaveBeenCalledWith([
      "recipes/covers/group/img-1.jpg",
    ]);
  });

  it("deletes moved objects during compensation cleanup", async () => {
    const imageService = createImageService();

    await cleanupMovedRecipeImages(imageService, ["recipes/covers/a/b.jpg"]);

    expect(imageService.delete).toHaveBeenCalledWith(["recipes/covers/a/b.jpg"]);
  });
});
