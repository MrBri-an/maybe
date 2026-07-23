import "server-only";

import { z } from "zod";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { clearCompletedRoom, hasCompletedRoom, markRoomCompleted } from "@/lib/auth/room-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { UserJourneyProgress } from "@/lib/supabase/database.types";
import { JOURNEY_ROOM_SLUGS } from "@/lib/progression/rooms";

export type SafeLocation = "world" | "storybook" | "library";
export const worldDestinationSchema = z.enum(JOURNEY_ROOM_SLUGS);
const pageSchema = z.number().int().min(1).max(30);
const locationSchema = z.enum(["world", "storybook", "library"]);

async function authorizeProgress() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) return null;
  const admin = createAdminSupabaseClient();
  return admin ? { access, admin } : null;
}

async function loadOrCreateAuthorizedProgress(authorized: NonNullable<Awaited<ReturnType<typeof authorizeProgress>>>) {
  const { data: existing } = await authorized.admin.from("user_journey_progress").select("*").eq("user_id", authorized.access.user.id).maybeSingle();
  if (existing) return { progress: existing, created: false };

  const [storybookCookie, libraryCookie] = await Promise.all([
    hasCompletedRoom(authorized.access.user.id, "storybook"),
    hasCompletedRoom(authorized.access.user.id, "library"),
  ]);
  const now = new Date().toISOString();
  await authorized.admin.from("user_journey_progress").insert({
    user_id: authorized.access.user.id,
    storybook_completed_at: storybookCookie ? now : null,
    library_completed_at: storybookCookie && libraryCookie ? now : null,
  });
  const { data } = await authorized.admin.from("user_journey_progress").select("*").eq("user_id", authorized.access.user.id).single();
  return data ? { progress: data, created: !storybookCookie && !libraryCookie } : null;
}

export async function loadUserJourneyProgress() {
  const authorized = await authorizeProgress();
  if (!authorized) return null;
  return loadOrCreateAuthorizedProgress(authorized);
}

export async function saveUserStorybookPage(page: number, expectedUpdatedAt: string | null) {
  const parsedPage = pageSchema.safeParse(page);
  if (!parsedPage.success) return { ok: false as const, error: "invalid" as const };
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const, error: "unauthorized" as const };
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return { ok: false as const, error: "unavailable" as const };
  if (loaded.progress.storybook_page_updated_at !== expectedUpdatedAt) {
    return { ok: false as const, error: "conflict" as const, progress: loaded.progress };
  }

  let query = authorized.admin.from("user_journey_progress").update({
    storybook_page: parsedPage.data,
    storybook_page_updated_at: new Date().toISOString(),
  }).eq("user_id", authorized.access.user.id);
  query = expectedUpdatedAt === null ? query.is("storybook_page_updated_at", null) : query.eq("storybook_page_updated_at", expectedUpdatedAt);
  const { data } = await query.select("*").maybeSingle();
  if (!data) {
    const current = await loadOrCreateAuthorizedProgress(authorized);
    if (!current) return { ok: false as const, error: "unavailable" as const };
    return { ok: false as const, error: "conflict" as const, progress: current.progress };
  }
  return { ok: true as const, progress: data };
}

export async function persistStorybookCompletion() {
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const };
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return { ok: false as const };
  const completedAt = loaded.progress.storybook_completed_at ?? new Date().toISOString();
  const { data } = await authorized.admin.from("user_journey_progress").update({
    storybook_page: 30,
    storybook_page_updated_at: new Date().toISOString(),
    storybook_completed_at: completedAt,
    last_location: "storybook",
  }).eq("user_id", authorized.access.user.id).select("*").single();
  if (!data || !(await markRoomCompleted(authorized.access.user.id, "storybook"))) return { ok: false as const };
  return { ok: true as const, progress: data };
}

export async function persistLibraryCompletion() {
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const };
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return { ok: false as const };
  if (!loaded.progress.storybook_completed_at) return { ok: false as const };
  const completedAt = loaded.progress.library_completed_at ?? new Date().toISOString();
  const { data } = await authorized.admin.from("user_journey_progress").update({
    library_completed_at: completedAt,
    last_location: "world",
  }).eq("user_id", authorized.access.user.id).select("*").single();
  if (!data || !(await markRoomCompleted(authorized.access.user.id, "storybook")) || !(await markRoomCompleted(authorized.access.user.id, "library"))) return { ok: false as const };
  return { ok: true as const, progress: data };
}

export async function saveSafeLocation(location: SafeLocation) {
  const parsed = locationSchema.safeParse(location);
  if (!parsed.success) return false;
  const authorized = await authorizeProgress();
  if (!authorized) return false;
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return false;
  if (parsed.data === "library" && !loaded.progress.storybook_completed_at) return false;
  const { error } = await authorized.admin.from("user_journey_progress").update({ last_location: parsed.data }).eq("user_id", authorized.access.user.id);
  return !error;
}

export async function saveWorldDestination(destination: string) {
  const parsed = worldDestinationSchema.safeParse(destination);
  if (!parsed.success) return false;
  const authorized = await authorizeProgress();
  if (!authorized) return false;
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return false;
  const { error } = await authorized.admin.from("user_journey_progress").update({
    last_location: "world",
    last_world_destination: parsed.data,
  }).eq("user_id", authorized.access.user.id);
  return !error;
}

export async function reconcileCompletionCookies(progress: UserJourneyProgress) {
  if (progress.storybook_completed_at) await markRoomCompleted(progress.user_id, "storybook");
  else await clearCompletedRoom("storybook");
  if (progress.library_completed_at && progress.storybook_completed_at) await markRoomCompleted(progress.user_id, "library");
  else await clearCompletedRoom("library");
}

export function deriveResumeDestination(progress: UserJourneyProgress, firstProgressRow: boolean) {
  if (firstProgressRow) return "/";
  if (progress.last_location === "storybook") return "/story";
  if (progress.last_location === "library" && progress.storybook_completed_at) return "/library";
  return "/?view=world";
}
