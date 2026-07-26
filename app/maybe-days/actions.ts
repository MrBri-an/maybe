"use server";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { authorizeMaybeDays } from "@/lib/maybe-days/server";
import { persistMaybeDaysCompletion, saveWorldDestination } from "@/lib/progression/user-progress";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import type { Database } from "@/lib/supabase/database.types";
import type {
  MaybeDayActivityView,
  MaybeDayCommentResult,
  MaybeDayCommentView,
  MaybeDayDrawResult,
  MaybeDayDrawView,
  MaybeDayHistoryPage,
  MaybeDayHistoryResult,
  MaybeDayMutationResult,
  MaybeDayStatus,
  MaybeDaysStateResult,
} from "@/lib/maybe-days/contracts";

type AuthorizedMaybeDays = NonNullable<Awaited<ReturnType<typeof authorizeMaybeDays>>>;
type DrawRow = Database["public"]["Tables"]["maybe_day_draws"]["Row"];
type ActivityRow = Database["public"]["Tables"]["maybe_day_activities"]["Row"];
type CommentRow = Database["public"]["Tables"]["maybe_day_comments"]["Row"];

const refSchema = z.string().min(20).max(300);
const commentSchema = z.string().trim().min(1).max(4000);
const reasonSchema = z.string().trim().max(500);
const cursorSchema = z.string().datetime({ offset: true });
const historyStatusSchema = z.enum(["completed", "skipped"]);
const HISTORY_PAGE_SIZE = 6;

function referenceKey() {
  const secret = getServerSupabaseConfig()?.serviceRoleKey;
  return secret ? createHash("sha256").update(`maybe-days:${secret}`).digest() : null;
}

function sealReference(id: string) {
  const key = referenceKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(id, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function openReference(value: string) {
  const parsed = refSchema.safeParse(value);
  const key = referenceKey();
  if (!parsed.success || !key) return null;
  try {
    const payload = Buffer.from(parsed.data, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function sanitizeActivity(activity: ActivityRow): MaybeDayActivityView {
  return {
    slug: activity.slug,
    title: activity.title,
    prompt: activity.prompt,
    category: activity.category,
    iconKey: activity.icon_key,
    estimatedMinutes: activity.estimated_minutes,
    requiresVoice: activity.requires_voice,
    requiresVideo: activity.requires_video,
  };
}

function memberLabel(
  authorized: AuthorizedMaybeDays,
  userId: string,
  roles: Map<string, "owner" | "guest">,
): "you" | "Brian" | "Jessica" {
  if (userId === authorized.access.user.id) return "you";
  return roles.get(userId) === "owner" ? "Brian" : "Jessica";
}

async function buildDrawViews(
  authorized: AuthorizedMaybeDays,
  draws: DrawRow[],
  suppliedActivities?: Map<string, ActivityRow>,
): Promise<MaybeDayDrawView[]> {
  if (!draws.length) return [];
  const drawIds = draws.map((draw) => draw.id);
  const activityIds = [...new Set(draws.map((draw) => draw.activity_id))];
  const [{ data: loadedActivities }, { data: members }, { data: checkins }, { data: comments }, { data: hearts }] = await Promise.all([
    suppliedActivities
      ? Promise.resolve({ data: [...suppliedActivities.values()].filter((activity) => activityIds.includes(activity.id)) })
      : authorized.admin.from("maybe_day_activities").select("*").in("id", activityIds),
    authorized.admin.from("app_members").select("user_id,role").eq("active", true).not("user_id", "is", null),
    authorized.admin.from("maybe_day_checkins").select("draw_id,user_id,confirmed_at").in("draw_id", drawIds),
    authorized.admin.from("maybe_day_comments").select("*").in("draw_id", drawIds).is("archived_at", null).order("created_at"),
    authorized.admin.from("maybe_day_hearts").select("draw_id,user_id").in("draw_id", drawIds),
  ]);
  const activities = suppliedActivities ?? new Map((loadedActivities ?? []).map((activity) => [activity.id, activity]));
  const roles = new Map((members ?? []).map((member) => [member.user_id!, member.role]));
  const activeMembers = (members ?? []).filter((member): member is typeof member & { user_id: string } => Boolean(member.user_id));

  return draws.flatMap((draw) => {
    const ref = sealReference(draw.id);
    const activity = activities.get(draw.activity_id);
    if (!ref || !activity) return [];
    const drawComments: MaybeDayCommentView[] = (comments ?? [])
      .filter((comment) => comment.draw_id === draw.id)
      .flatMap((comment) => {
        const commentRef = sealReference(comment.id);
        if (!commentRef) return [];
        return [{
          ref: commentRef,
          body: comment.body,
          authorLabel: memberLabel(authorized, comment.author_user_id, roles),
          isOwn: comment.author_user_id === authorized.access.user.id,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
        }];
      });
    return [{
      ref,
      status: draw.status,
      selectedAt: draw.selected_at,
      startedAt: draw.started_at,
      completedAt: draw.completed_at,
      skippedAt: draw.skipped_at,
      skipReason: draw.skip_reason,
      selectedBy: memberLabel(authorized, draw.selected_by_user_id, roles),
      activity: sanitizeActivity(activity),
      checkins: activeMembers.map((member) => ({
        label: memberLabel(authorized, member.user_id, roles),
        isOwn: member.user_id === authorized.access.user.id,
        confirmed: Boolean((checkins ?? []).find((checkin) => checkin.draw_id === draw.id && checkin.user_id === member.user_id)),
      })),
      comments: drawComments,
      heartCount: (hearts ?? []).filter((heart) => heart.draw_id === draw.id).length,
      ownHeart: Boolean((hearts ?? []).find((heart) => heart.draw_id === draw.id && heart.user_id === authorized.access.user.id)),
    }];
  });
}

async function loadOneDraw(authorized: AuthorizedMaybeDays, id: string): Promise<MaybeDayDrawView | null> {
  const { data } = await authorized.admin.from("maybe_day_draws").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return (await buildDrawViews(authorized, [data]))[0] ?? null;
}

function historyPage(items: MaybeDayDrawView[], hasMore: boolean): MaybeDayHistoryPage {
  return {
    items: items.slice(0, HISTORY_PAGE_SIZE),
    nextCursor: hasMore ? items[HISTORY_PAGE_SIZE - 1]?.selectedAt ?? null : null,
  };
}

async function selectDraw(authorized: AuthorizedMaybeDays): Promise<MaybeDayDrawResult> {
  const { data, error } = await authorized.admin.rpc("select_maybe_day_activity", {
    p_selected_by_user_id: authorized.access.user.id,
  });
  if (error || !data) {
    console.error("Maybe Days operation failed", { operation: "select_draw", code: error?.code });
    return { ok: false, error: "The jar could not choose a note just now. Please try again." };
  }
  const draw = (await buildDrawViews(authorized, [data]))[0];
  return draw ? { ok: true, draw } : { ok: false, error: "The chosen activity could not be opened just now." };
}

export async function loadMaybeDaysState(): Promise<MaybeDaysStateResult> {
  const authorized = await authorizeMaybeDays();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  const [
    { data: activities, error: activitiesError },
    { data: activeDraw, error: activeError },
    { data: completed, error: completedError },
    { data: skipped, error: skippedError },
  ] = await Promise.all([
    authorized.admin.from("maybe_day_activities").select("*").eq("is_active", true).order("sort_order"),
    authorized.admin.from("maybe_day_draws").select("*").in("status", ["selected", "started"]).order("selected_at", { ascending: false }).limit(1).maybeSingle(),
    authorized.admin.from("maybe_day_draws").select("*").eq("status", "completed").order("selected_at", { ascending: false }).limit(HISTORY_PAGE_SIZE + 1),
    authorized.admin.from("maybe_day_draws").select("*").eq("status", "skipped").order("selected_at", { ascending: false }).limit(HISTORY_PAGE_SIZE + 1),
  ]);
  if (activitiesError || activeError || completedError || skippedError) {
    console.error("Maybe Days operation failed", { operation: "load_state", code: activitiesError?.code ?? activeError?.code ?? completedError?.code ?? skippedError?.code });
    return { ok: false, error: "The Maybe Jar could not be gathered just now." };
  }
  const activityMap = new Map((activities ?? []).map((activity) => [activity.id, activity]));
  const allRows = [...(activeDraw ? [activeDraw] : []), ...(completed ?? []), ...(skipped ?? [])];
  const views = await buildDrawViews(authorized, allRows, activityMap);
  const byRef = new Map(allRows.map((row, index) => [row.id, views[index]]));
  const activeView = activeDraw ? byRef.get(activeDraw.id) ?? null : null;
  const completedViews = (completed ?? []).flatMap((row) => byRef.get(row.id) ?? []);
  const skippedViews = (skipped ?? []).flatMap((row) => byRef.get(row.id) ?? []);
  return {
    ok: true,
    activities: (activities ?? []).map(sanitizeActivity),
    activeDraw: activeView,
    completed: historyPage(completedViews, completedViews.length > HISTORY_PAGE_SIZE),
    skipped: historyPage(skippedViews, skippedViews.length > HISTORY_PAGE_SIZE),
  };
}

export async function loadMaybeDaysHistory(status: MaybeDayStatus, cursor?: string): Promise<MaybeDayHistoryResult> {
  const authorized = await authorizeMaybeDays();
  const parsedStatus = historyStatusSchema.safeParse(status);
  const parsedCursor = cursor ? cursorSchema.safeParse(cursor) : null;
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!parsedStatus.success || (parsedCursor && !parsedCursor.success)) return { ok: false, error: "That history page is not available." };
  let query = authorized.admin.from("maybe_day_draws").select("*").eq("status", parsedStatus.data).order("selected_at", { ascending: false }).limit(HISTORY_PAGE_SIZE + 1);
  if (parsedCursor?.success) query = query.lt("selected_at", parsedCursor.data);
  const { data, error } = await query;
  if (error) return { ok: false, error: "More activity history could not be loaded." };
  const views = await buildDrawViews(authorized, data ?? []);
  return { ok: true, page: historyPage(views, views.length > HISTORY_PAGE_SIZE) };
}

export async function openMaybeJar(): Promise<MaybeDayDrawResult> {
  const authorized = await authorizeMaybeDays();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  return selectDraw(authorized);
}

export async function startMaybeDay(ref: string): Promise<MaybeDayDrawResult> {
  const authorized = await authorizeMaybeDays();
  const id = openReference(ref);
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id) return { ok: false, error: "This activity reference is no longer valid." };
  const { data: current, error: currentError } = await authorized.admin.from("maybe_day_draws")
    .select("id,status")
    .in("status", ["selected", "started"])
    .order("selected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) return { ok: false, error: "The current shared activity could not be verified." };
  if (!current || current.id !== id) return { ok: false, error: "This is no longer the current shared activity." };
  if (current.status === "started") {
    const existing = await loadOneDraw(authorized, id);
    return existing ? { ok: true, draw: existing } : { ok: false, error: "The started activity could not be loaded." };
  }
  const now = new Date().toISOString();
  const { data, error } = await authorized.admin.from("maybe_day_draws")
    .update({ status: "started", started_at: now })
    .eq("id", id).eq("status", "selected")
    .select("*").maybeSingle();
  if (error) return { ok: false, error: "The activity could not be started just now." };
  const draw = data ? (await buildDrawViews(authorized, [data]))[0] : await loadOneDraw(authorized, id);
  if (!draw || draw.status !== "started") return { ok: false, error: "This activity is no longer waiting to begin." };
  return { ok: true, draw };
}

export async function confirmMaybeDayParticipation(ref: string): Promise<MaybeDayDrawResult> {
  const authorized = await authorizeMaybeDays();
  const id = openReference(ref);
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id) return { ok: false, error: "This activity reference is no longer valid." };
  const { data: draw } = await authorized.admin.from("maybe_day_draws").select("id,status").eq("id", id).in("status", ["started", "completed"]).maybeSingle();
  if (!draw) return { ok: false, error: "Start this activity before confirming your part." };
  const { error: checkinError } = await authorized.admin.from("maybe_day_checkins").upsert({
    draw_id: id,
    user_id: authorized.access.user.id,
  }, { onConflict: "draw_id,user_id", ignoreDuplicates: true });
  if (checkinError) return { ok: false, error: "Your confirmation could not be saved just now." };
  if (draw.status === "started") {
    const { error: completionError } = await authorized.admin.rpc("complete_maybe_day_if_confirmed", { p_draw_id: id });
    if (completionError && !completionError.message.includes("maybe_days_waiting_for_checkins")) {
      console.error("Maybe Days operation failed", { operation: "complete_confirmed_draw", code: completionError.code });
    }
  }
  const updated = await loadOneDraw(authorized, id);
  return updated ? { ok: true, draw: updated } : { ok: false, error: "The shared activity state could not be refreshed." };
}

export async function pickAnotherMaybeDay(ref: string, reason: string): Promise<MaybeDayDrawResult> {
  const authorized = await authorizeMaybeDays();
  const id = openReference(ref);
  const parsedReason = reasonSchema.safeParse(reason);
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id || !parsedReason.success) return { ok: false, error: "That skip reason could not be saved." };
  const { data: current, error: currentError } = await authorized.admin.from("maybe_day_draws")
    .select("id,status")
    .in("status", ["selected", "started"])
    .order("selected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) return { ok: false, error: "The current shared activity could not be verified." };
  if (!current || current.id !== id || current.status !== "selected") {
    return { ok: false, error: "Pick another is available only for the current activity before it starts." };
  }
  const now = new Date().toISOString();
  const { data: skipped, error } = await authorized.admin.from("maybe_day_draws")
    .update({ status: "skipped", skipped_at: now, skip_reason: parsedReason.data || null })
    .eq("id", id).eq("status", "selected")
    .select("id").maybeSingle();
  if (error) return { ok: false, error: "The jar could not return this note just now." };
  if (!skipped) return { ok: false, error: "Pick another is available only before an activity starts." };
  const selected = await selectDraw(authorized);
  if (selected.ok) return selected;
  return selected;
}

export async function setMaybeDayHeart(ref: string, active: boolean): Promise<MaybeDayMutationResult> {
  const authorized = await authorizeMaybeDays();
  const id = openReference(ref);
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id) return { ok: false, error: "This activity reference is no longer valid." };
  const { data: draw } = await authorized.admin.from("maybe_day_draws").select("id").eq("id", id).maybeSingle();
  if (!draw) return { ok: false, error: "This activity could not be found." };
  const { error } = active
    ? await authorized.admin.from("maybe_day_hearts").upsert({ draw_id: id, user_id: authorized.access.user.id }, { onConflict: "draw_id,user_id" })
    : await authorized.admin.from("maybe_day_hearts").delete().eq("draw_id", id).eq("user_id", authorized.access.user.id);
  return error ? { ok: false, error: "Your heart could not be updated just now." } : { ok: true };
}

function sanitizeOwnComment(authorized: AuthorizedMaybeDays, comment: CommentRow): MaybeDayCommentView | null {
  const ref = sealReference(comment.id);
  return ref ? {
    ref,
    body: comment.body,
    authorLabel: "you",
    isOwn: true,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  } : null;
}

export async function addMaybeDayComment(drawRef: string, body: string): Promise<MaybeDayCommentResult> {
  const authorized = await authorizeMaybeDays();
  const drawId = openReference(drawRef);
  const parsedBody = commentSchema.safeParse(body);
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!drawId || !parsedBody.success) return { ok: false, error: "Add a valid comment before saving." };
  const { data, error } = await authorized.admin.from("maybe_day_comments").insert({
    draw_id: drawId,
    author_user_id: authorized.access.user.id,
    body: parsedBody.data,
  }).select("*").single();
  const comment = data ? sanitizeOwnComment(authorized, data) : null;
  return error || !comment ? { ok: false, error: "Your comment could not be saved just now." } : { ok: true, comment };
}

export async function updateMaybeDayComment(ref: string, body: string): Promise<MaybeDayCommentResult> {
  const authorized = await authorizeMaybeDays();
  const id = openReference(ref);
  const parsedBody = commentSchema.safeParse(body);
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id || !parsedBody.success) return { ok: false, error: "Add a valid comment before saving." };
  const { data, error } = await authorized.admin.from("maybe_day_comments")
    .update({ body: parsedBody.data })
    .eq("id", id).eq("author_user_id", authorized.access.user.id).is("archived_at", null)
    .select("*").maybeSingle();
  const comment = data ? sanitizeOwnComment(authorized, data) : null;
  return error || !comment ? { ok: false, error: "Only the author can update this comment." } : { ok: true, comment };
}

export async function archiveMaybeDayComment(ref: string): Promise<MaybeDayMutationResult> {
  const authorized = await authorizeMaybeDays();
  const id = openReference(ref);
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id) return { ok: false, error: "This comment reference is no longer valid." };
  const { data, error } = await authorized.admin.from("maybe_day_comments")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id).eq("author_user_id", authorized.access.user.id).is("archived_at", null)
    .select("id").maybeSingle();
  return error || !data ? { ok: false, error: "Only the author can archive this comment." } : { ok: true };
}

export async function completeMaybeDaysJourney() {
  const authorized = await authorizeMaybeDays();
  if (!authorized) return { ok: false as const, error: "Please sign in with an approved account to continue." };
  const result = await persistMaybeDaysCompletion();
  if (result.ok) {
    after(async () => {
      const saved = await saveWorldDestination("our-corner");
      if (!saved) console.error("Maybe Days completion operation failed", { operation: "save_navigation_metadata" });
    });
    return result;
  }
  return {
    ...result,
    error: result.reason === "unauthorized"
      ? "Please sign in with an approved account to continue."
      : result.reason === "missing_prerequisite"
        ? "Complete the earlier journey rooms before continuing."
        : "The next step could not be saved. Please try again.",
  };
}
