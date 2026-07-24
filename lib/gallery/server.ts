import "server-only";

import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { toPublicGalleryMedia, type PublicGalleryMedia } from "@/lib/gallery/media";

export const GALLERY_PAGE_SIZE = 18;

export async function authorizeGallery() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) return null;
  const journey = await loadUserJourneyProgress();
  if (!journey?.progress.storybook_completed_at
    || !journey.progress.library_completed_at
    || !journey.progress.puzzle_room_completed_at
    || !journey.progress.radio_completed_at
    || !journey.progress.question_garden_completed_at) return null;
  const admin = createAdminSupabaseClient();
  return admin ? { access, admin, progress: journey.progress } : null;
}

export async function sanitizeGalleryMedia(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeGallery>>>,
  rows: Awaited<ReturnType<typeof loadGalleryRows>>["rows"],
): Promise<PublicGalleryMedia[]> {
  const ownerIds = [...new Set(rows.map((row) => row.uploader_user_id))];
  const { data: members } = ownerIds.length
    ? await authorized.admin.from("app_members").select("user_id,role").in("user_id", ownerIds)
    : { data: [] };
  const labels = new Map((members ?? []).map((member) => [member.user_id, member.role === "owner" ? "Added by Brian" : "Added by Jessica"]));
  return rows.map((media) => toPublicGalleryMedia(media, authorized.access.user.id, labels.get(media.uploader_user_id)));
}

async function loadGalleryRows(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeGallery>>>,
  before?: string,
) {
  let query = authorized.admin.from("gallery_media")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(GALLERY_PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) {
    console.error("Gallery foundation operation failed", { operation: "load_media", code: error.code });
    return { rows: [], hasMore: false };
  }
  const rows = data ?? [];
  return { rows: rows.slice(0, GALLERY_PAGE_SIZE), hasMore: rows.length > GALLERY_PAGE_SIZE };
}

export async function loadGalleryMedia(authorized: NonNullable<Awaited<ReturnType<typeof authorizeGallery>>>, before?: string) {
  const loaded = await loadGalleryRows(authorized, before);
  return {
    media: await sanitizeGalleryMedia(authorized, loaded.rows),
    hasMore: loaded.hasMore,
    nextCursor: loaded.hasMore ? loaded.rows.at(-1)?.created_at ?? null : null,
  };
}

export async function recordGalleryVisit(authorized: NonNullable<Awaited<ReturnType<typeof authorizeGallery>>>) {
  const { error } = await authorized.admin.from("user_journey_progress")
    .update({ last_location: "gallery", last_world_destination: "gallery" })
    .eq("user_id", authorized.access.user.id);
  if (error) console.error("Gallery foundation operation failed", { operation: "record_location", code: error.code });
}
