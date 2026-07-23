import "server-only";

import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function authorizeSharedContent(required: "membership" | "library" | "radio") {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) return null;
  const journey = await loadUserJourneyProgress();
  if (!journey) return null;
  if (required !== "membership" && !journey.progress.storybook_completed_at) return null;
  if (required === "radio" && (!journey.progress.library_completed_at || !journey.progress.puzzle_room_completed_at)) return null;
  const admin = createAdminSupabaseClient();
  return admin ? { access, admin, progress: journey.progress } : null;
}

export function isUploader(ownerId: string, userId: string) {
  return ownerId === userId;
}
