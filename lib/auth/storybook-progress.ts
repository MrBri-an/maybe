import "server-only";

import { hasCompletedRoom, markRoomCompleted } from "@/lib/auth/room-progress";

export function hasCompletedStorybook(userId: string) {
  return hasCompletedRoom(userId, "storybook");
}

export function markStorybookCompleted(userId: string) {
  return markRoomCompleted(userId, "storybook");
}
