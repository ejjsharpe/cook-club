import { beforeEach, describe, expect, it, vi } from "vitest";

import { notificationRouter } from "./notification-router";
import { createMockContext } from "../__mocks__/context";

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  registerPushToken: vi.fn(),
  unregisterPushToken: vi.fn(),
}));

vi.mock("@repo/db/services", () => ({
  getNotifications: mocks.getNotifications,
  getUnreadCount: mocks.getUnreadCount,
  markAsRead: mocks.markAsRead,
  registerPushToken: mocks.registerPushToken,
  unregisterPushToken: mocks.unregisterPushToken,
}));

describe("notificationRouter push token mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerPushToken.mockResolvedValue({
      id: 1,
      userId: "test-user-id",
      expoPushToken: "ExponentPushToken[test]",
      platform: "ios",
      enabled: true,
    });
    mocks.unregisterPushToken.mockResolvedValue({
      success: true,
      updatedCount: 1,
    });
  });

  it("registers a push token for the current user", async () => {
    const caller = notificationRouter.createCaller(createMockContext() as any);

    await expect(
      caller.registerPushToken({
        token: "ExponentPushToken[test]",
        platform: "ios",
      }),
    ).resolves.toEqual({
      success: true,
      pushToken: expect.objectContaining({
        expoPushToken: "ExponentPushToken[test]",
      }),
    });

    expect(mocks.registerPushToken).toHaveBeenCalledWith(expect.anything(), {
      userId: "test-user-id",
      expoPushToken: "ExponentPushToken[test]",
      platform: "ios",
    });
  });

  it("unregisters a push token for the current user", async () => {
    const caller = notificationRouter.createCaller(createMockContext() as any);

    await expect(
      caller.unregisterPushToken({ token: "ExponentPushToken[test]" }),
    ).resolves.toEqual({
      success: true,
      updatedCount: 1,
    });

    expect(mocks.unregisterPushToken).toHaveBeenCalledWith(expect.anything(), {
      userId: "test-user-id",
      expoPushToken: "ExponentPushToken[test]",
    });
  });
});
