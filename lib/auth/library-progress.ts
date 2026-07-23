import "server-only";

import { hasCompletedRoom, markRoomCompleted } from "@/lib/auth/room-progress";

export function hasCompletedLibrary(userId: string) {
  return hasCompletedRoom(userId, "library");
}

export function markLibraryCompleted(userId: string) {
  return markRoomCompleted(userId, "library");
}
