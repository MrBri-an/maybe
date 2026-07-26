import "server-only";

import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { HerUniverseObjectView } from "@/lib/her-universe/contracts";

export async function authorizeHerUniverse() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) return null;
  const journey = await loadUserJourneyProgress();
  const progress = journey?.progress;
  if (!progress?.storybook_completed_at
    || !progress.library_completed_at
    || !progress.puzzle_room_completed_at
    || !progress.radio_completed_at
    || !progress.question_garden_completed_at
    || !progress.gallery_completed_at) return null;
  const admin = createAdminSupabaseClient();
  return admin ? { access, admin, progress } : null;
}

export async function loadHerUniverseObjects(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeHerUniverse>>>,
): Promise<HerUniverseObjectView[]> {
  const [{ data, error }, { data: visits, error: visitsError }] = await Promise.all([
    authorized.admin
      .from("her_universe_objects")
      .select("id,slug,object_type,name,caption,visual_variant,sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    authorized.admin
      .from("her_universe_object_visits")
      .select("object_id")
      .eq("user_id", authorized.access.user.id),
  ]);
  if (error) {
    console.error("Her Universe foundation operation failed", { operation: "load_objects", code: error.code });
    return [];
  }
  if (visitsError) console.error("Her Universe foundation operation failed", { operation: "load_visits", code: visitsError.code });
  const visitedIds = new Set((visits ?? []).map((visit) => visit.object_id));
  return (data ?? []).map((object) => ({
    slug: object.slug,
    objectType: object.object_type,
    name: object.name,
    caption: object.caption,
    visualVariant: object.visual_variant,
    sortOrder: object.sort_order,
    visited: visitedIds.has(object.id),
  }));
}

export async function recordHerUniverseLocation(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeHerUniverse>>>,
) {
  const { error } = await authorized.admin.from("user_journey_progress")
    .update({ last_location: "her-universe", last_world_destination: "her-universe" })
    .eq("user_id", authorized.access.user.id);
  if (error) console.error("Her Universe foundation operation failed", { operation: "record_location", code: error.code });
}
