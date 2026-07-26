import "server-only";

import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function authorizeOurCorner() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) return null;
  const journey = await loadUserJourneyProgress();
  const progress = journey?.progress;
  if (!progress?.storybook_completed_at
    || !progress.library_completed_at
    || !progress.puzzle_room_completed_at
    || !progress.radio_completed_at
    || !progress.question_garden_completed_at
    || !progress.gallery_completed_at
    || !progress.her_universe_completed_at
    || !progress.maybe_days_completed_at) return null;
  const admin = createAdminSupabaseClient();
  return admin ? { access, admin, progress } : null;
}

export async function recordOurCornerLocation(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeOurCorner>>>,
) {
  const { error } = await authorized.admin.from("user_journey_progress")
    .update({ last_location: "our-corner", last_world_destination: "our-corner" })
    .eq("user_id", authorized.access.user.id);
  if (error) console.error("Our Corner foundation operation failed", { operation: "record_location", code: error.code });
}
