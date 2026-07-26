"use server";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { authorizeHerUniverse } from "@/lib/her-universe/server";
import { after } from "next/server";
import { persistHerUniverseCompletion, saveWorldDestination } from "@/lib/progression/user-progress";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import type {
  HerUniverseAnimationVariant,
  HerUniverseDetailResult,
  HerUniverseMessageView,
  HerUniverseMutationResult,
  HerUniverseReaction,
  HerUniverseVisitResult,
} from "@/lib/her-universe/contracts";

const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const slugsSchema = z.array(slugSchema).min(1).max(3);
const messageSchema = z.string().trim().min(1).max(4000);
const responseSchema = z.string().trim().min(1).max(4000);
const animationSchema = z.enum(["drift", "orbit", "glow", "rise"]);
const refSchema = z.string().min(20).max(300);

function referenceKey() {
  const secret = getServerSupabaseConfig()?.serviceRoleKey;
  return secret ? createHash("sha256").update(`her-universe:${secret}`).digest() : null;
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

async function findObject(authorized: NonNullable<Awaited<ReturnType<typeof authorizeHerUniverse>>>, slug: string) {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  const { data } = await authorized.admin.from("her_universe_objects")
    .select("id")
    .eq("slug", parsed.data)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function messageIsActive(authorized: NonNullable<Awaited<ReturnType<typeof authorizeHerUniverse>>>, id: string) {
  const { data } = await authorized.admin.from("her_universe_messages").select("id").eq("id", id).is("archived_at", null).maybeSingle();
  return Boolean(data);
}

async function sanitizeMessage(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeHerUniverse>>>,
  message: {
    id: string;
    author_user_id: string;
    body: string;
    animation_variant: HerUniverseAnimationVariant;
    created_at: string;
    updated_at: string;
  },
  interactions?: {
    ownReactions: Map<string, HerUniverseReaction>;
    reactionCounts: Map<string, number>;
    authorLabels: Map<string, "Brian" | "Jessica">;
  },
): Promise<HerUniverseMessageView | null> {
  const ref = sealReference(message.id);
  if (!ref) return null;
  let ownReaction = interactions?.ownReactions.get(message.id) ?? null;
  let reactionCount = interactions?.reactionCounts.get(message.id) ?? 0;
  let authorLabel = interactions?.authorLabels.get(message.author_user_id)
    ?? (authorized.access.member.role === "owner" ? "Brian" : "Jessica");
  if (!interactions) {
    const [{ data: reactionRow }, { count }, { data: author }] = await Promise.all([
      authorized.admin.from("her_universe_message_reactions").select("reaction").eq("message_id", message.id).eq("user_id", authorized.access.user.id).maybeSingle(),
      authorized.admin.from("her_universe_message_reactions").select("*", { count: "exact", head: true }).eq("message_id", message.id),
      authorized.admin.from("app_members").select("role").eq("user_id", message.author_user_id).eq("active", true).maybeSingle(),
    ]);
    ownReaction = (reactionRow?.reaction as HerUniverseReaction | undefined) ?? null;
    reactionCount = count ?? 0;
    authorLabel = author?.role === "owner" ? "Brian" : "Jessica";
  }
  return {
    ref,
    body: message.body,
    animationVariant: message.animation_variant,
    isOwn: message.author_user_id === authorized.access.user.id,
    authorLabel,
    ownReaction,
    reactionCount,
    createdAt: message.created_at,
    updatedAt: message.updated_at,
  };
}

export async function recordCelestialObjectVisit(slug: string): Promise<HerUniverseVisitResult> {
  const authorized = await authorizeHerUniverse();
  if (!authorized) return { ok: false, error: "unauthorized" };
  const object = await findObject(authorized, slug);
  if (!object) return { ok: false, error: "not_found" };

  const { data: existing } = await authorized.admin.from("her_universe_object_visits")
    .select("visit_count")
    .eq("object_id", object.id)
    .eq("user_id", authorized.access.user.id)
    .maybeSingle();
  const now = new Date().toISOString();
  const { error } = await authorized.admin.from("her_universe_object_visits").upsert({
    object_id: object.id,
    user_id: authorized.access.user.id,
    visit_count: (existing?.visit_count ?? 0) + 1,
    first_visited_at: existing ? undefined : now,
    last_visited_at: now,
  }, { onConflict: "object_id,user_id" });
  return error ? { ok: false, error: "unavailable" } : { ok: true };
}

export async function loadCelestialObjectWords(slugs: string[]): Promise<HerUniverseDetailResult> {
  const authorized = await authorizeHerUniverse();
  if (!authorized) return { ok: false, error: "unauthorized" };
  const parsed = slugsSchema.safeParse([...new Set(slugs)]);
  if (!parsed.success) return { ok: false, error: "not_found" };
  const { data: objects, error: objectsError } = await authorized.admin.from("her_universe_objects")
    .select("id,slug")
    .in("slug", parsed.data)
    .eq("is_active", true);
  if (objectsError || !objects?.length) return { ok: false, error: "not_found" };
  const objectIds = objects.map((object) => object.id);
  const { data: rows, error } = await authorized.admin.from("her_universe_messages")
      .select("id,object_id,author_user_id,body,animation_variant,created_at,updated_at")
      .in("object_id", objectIds)
      .is("archived_at", null)
      .order("display_order")
      .order("created_at");
  if (error) return { ok: false, error: "unavailable" };
  const ids = (rows ?? []).map((row) => row.id);
  const authorIds = [...new Set((rows ?? []).map((row) => row.author_user_id))];
  const [{ data: ownReactions }, { data: allReactions }, { data: authors }] = await Promise.all([
    ids.length
      ? authorized.admin.from("her_universe_message_reactions").select("message_id,reaction").eq("user_id", authorized.access.user.id).in("message_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? authorized.admin.from("her_universe_message_reactions").select("message_id,reaction").in("message_id", ids).eq("reaction", "heart")
      : Promise.resolve({ data: [] }),
    authorIds.length
      ? authorized.admin.from("app_members").select("user_id,role").eq("active", true).in("user_id", authorIds)
      : Promise.resolve({ data: [] }),
  ]);
  const reactionCounts = new Map<string, number>();
  for (const reaction of allReactions ?? []) reactionCounts.set(reaction.message_id, (reactionCounts.get(reaction.message_id) ?? 0) + 1);
  const interactions = {
    ownReactions: new Map((ownReactions ?? []).filter((reaction) => reaction.reaction === "heart").map((reaction) => [reaction.message_id, "heart" as const])),
    reactionCounts,
    authorLabels: new Map((authors ?? []).map((author) => [author.user_id!, author.role === "owner" ? "Brian" as const : "Jessica" as const])),
  };
  const details: Record<string, { messages: HerUniverseMessageView[] }> = Object.fromEntries(objects.map((object) => [object.slug, { messages: [] }]));
  for (const row of rows ?? []) {
    const object = objects.find((candidate) => candidate.id === row.object_id);
    if (!object) continue;
    const message = await sanitizeMessage(authorized, row, interactions);
    if (message) details[object.slug].messages.push(message);
  }
  return { ok: true, details };
}

export async function addHerUniverseMessage(slug: string, body: string, animationVariant: HerUniverseAnimationVariant): Promise<HerUniverseMutationResult> {
  const authorized = await authorizeHerUniverse();
  const parsedBody = messageSchema.safeParse(body);
  const parsedAnimation = animationSchema.safeParse(animationVariant);
  if (!authorized) return { ok: false, error: "unauthorized" };
  if (!parsedBody.success || !parsedAnimation.success) return { ok: false, error: "invalid" };
  const object = await findObject(authorized, slug);
  if (!object) return { ok: false, error: "not_found" };
  const { data, error } = await authorized.admin.from("her_universe_messages").insert({
    object_id: object.id,
    author_user_id: authorized.access.user.id,
    body: parsedBody.data,
    animation_variant: parsedAnimation.data,
  }).select("id,author_user_id,body,animation_variant,created_at,updated_at").single();
  if (error || !data) return { ok: false, error: "unavailable" };
  const message = await sanitizeMessage(authorized, data);
  return message ? { ok: true, message } : { ok: false, error: "unavailable" };
}

export async function updateHerUniverseMessage(ref: string, body: string, animationVariant: HerUniverseAnimationVariant): Promise<HerUniverseMutationResult> {
  const authorized = await authorizeHerUniverse();
  const id = openReference(ref);
  const parsedBody = messageSchema.safeParse(body);
  const parsedAnimation = animationSchema.safeParse(animationVariant);
  if (!authorized) return { ok: false, error: "unauthorized" };
  if (!id || !parsedBody.success || !parsedAnimation.success) return { ok: false, error: "invalid" };
  const { data, error } = await authorized.admin.from("her_universe_messages").update({
    body: parsedBody.data,
    animation_variant: parsedAnimation.data,
  }).eq("id", id).eq("author_user_id", authorized.access.user.id).is("archived_at", null)
    .select("id,author_user_id,body,animation_variant,created_at,updated_at").maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  if (!data) return { ok: false, error: "forbidden" };
  const message = await sanitizeMessage(authorized, data);
  return message ? { ok: true, message } : { ok: false, error: "unavailable" };
}

export async function archiveHerUniverseMessage(ref: string): Promise<HerUniverseMutationResult> {
  const authorized = await authorizeHerUniverse();
  const id = openReference(ref);
  if (!authorized) return { ok: false, error: "unauthorized" };
  if (!id) return { ok: false, error: "invalid" };
  const { data, error } = await authorized.admin.from("her_universe_messages")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id).eq("author_user_id", authorized.access.user.id).is("archived_at", null)
    .select("id").maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  return data ? { ok: true } : { ok: false, error: "forbidden" };
}

export async function setHerUniverseReaction(ref: string, reaction: HerUniverseReaction | null): Promise<HerUniverseMutationResult> {
  const authorized = await authorizeHerUniverse();
  const id = openReference(ref);
  if (!authorized) return { ok: false, error: "unauthorized" };
  if (!id || (reaction !== null && reaction !== "heart")) return { ok: false, error: "invalid" };
  if (!(await messageIsActive(authorized, id))) return { ok: false, error: "not_found" };
  const { error } = reaction === null
    ? await authorized.admin.from("her_universe_message_reactions").delete().eq("message_id", id).eq("user_id", authorized.access.user.id)
    : await authorized.admin.from("her_universe_message_reactions").upsert({ message_id: id, user_id: authorized.access.user.id, reaction: "heart" }, { onConflict: "message_id,user_id" });
  return error ? { ok: false, error: "unavailable" } : { ok: true, value: reaction ?? "" };
}

export async function toggleHerUniverseFavourite(ref: string): Promise<HerUniverseMutationResult> {
  const authorized = await authorizeHerUniverse();
  const id = openReference(ref);
  if (!authorized) return { ok: false, error: "unauthorized" };
  if (!id) return { ok: false, error: "invalid" };
  if (!(await messageIsActive(authorized, id))) return { ok: false, error: "not_found" };
  const { data: existing } = await authorized.admin.from("her_universe_message_favourites").select("message_id").eq("message_id", id).eq("user_id", authorized.access.user.id).maybeSingle();
  const { error } = existing
    ? await authorized.admin.from("her_universe_message_favourites").delete().eq("message_id", id).eq("user_id", authorized.access.user.id)
    : await authorized.admin.from("her_universe_message_favourites").insert({ message_id: id, user_id: authorized.access.user.id });
  return error ? { ok: false, error: "unavailable" } : { ok: true, active: !existing };
}

export async function saveHerUniversePrivateResponse(slug: string, body: string): Promise<HerUniverseMutationResult> {
  const authorized = await authorizeHerUniverse();
  const parsedBody = responseSchema.safeParse(body);
  if (!authorized) return { ok: false, error: "unauthorized" };
  if (!parsedBody.success) return { ok: false, error: "invalid" };
  const object = await findObject(authorized, slug);
  if (!object) return { ok: false, error: "not_found" };
  const { error } = await authorized.admin.from("her_universe_private_responses").upsert({
    object_id: object.id,
    user_id: authorized.access.user.id,
    body: parsedBody.data,
    archived_at: null,
  }, { onConflict: "object_id,user_id" });
  return error ? { ok: false, error: "unavailable" } : { ok: true, value: parsedBody.data };
}

export async function completeHerUniverseJourney() {
  const result = await persistHerUniverseCompletion();
  if (result.ok) {
    after(async () => {
      const saved = await saveWorldDestination("maybe-days");
      if (!saved) console.error("Her Universe completion operation failed", { operation: "save_navigation_metadata" });
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
