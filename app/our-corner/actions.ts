"use server";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { authorizeOurCorner } from "@/lib/our-corner/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import { persistOurCornerCompletion, saveWorldDestination } from "@/lib/progression/user-progress";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CornerMessagePage,
  CornerMessageResult,
  CornerMessageView,
  CornerMutationResult,
  CornerFeaturesResult,
  CornerMood,
  CornerMoodView,
  CornerShareKind,
  CornerSharePage,
  CornerVoicePreparation,
  CornerVoiceUrlResult,
  CornerReplyView,
  CornerStateResult,
} from "@/lib/our-corner/contracts";

type AuthorizedCorner = NonNullable<Awaited<ReturnType<typeof authorizeOurCorner>>>;
type MessageRow = Database["public"]["Tables"]["our_corner_messages"]["Row"];
const refSchema = z.string().min(20).max(300);
const clientIdSchema = z.string().uuid();
const bodySchema = z.string().trim().min(1).max(4000);
const cursorSchema = z.string().datetime({ offset: true });
const refsSchema = z.array(refSchema).min(1).max(50);
const PAGE_SIZE = 30;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const VOICE_BUCKET = "our-corner-voice";
const VOICE_MAX_BYTES = 20 * 1024 * 1024;
const voiceMimeSchema = z.enum(["audio/webm", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/ogg"]);
const voiceInputSchema = z.object({
  clientMessageId: clientIdSchema,
  mimeType: voiceMimeSchema,
  sizeBytes: z.number().int().positive().max(VOICE_MAX_BYTES),
  durationSeconds: z.number().int().min(1).max(600),
  waveform: z.array(z.number().int().min(1).max(100)).min(8).max(64),
  replyRef: refSchema.optional(),
});
const voiceTicketSchema = voiceInputSchema.extend({
  userId: z.string().uuid(),
  conversationId: z.string().uuid(),
  path: z.string().min(10).max(500),
  expiresAt: z.number().int().positive(),
});
type VoiceTicket = z.infer<typeof voiceTicketSchema>;
const ticketStringSchema = z.string().min(40).max(4000);
const shareKindSchema = z.enum(["gallery", "radio", "maybe-days", "her-universe"]);
const moodSchema = z.enum(["Happy", "Calm", "Tired", "Missing you", "Stressed", "Excited", "Quiet"]);
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function referenceKey() {
  const secret = getServerSupabaseConfig()?.serviceRoleKey;
  return secret ? createHash("sha256").update(`our-corner:${secret}`).digest() : null;
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

function createVoiceTicket(payload: VoiceTicket) {
  const secret = getServerSupabaseConfig()?.serviceRoleKey;
  if (!secret) return null;
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readVoiceTicket(ticket: string) {
  const parsedTicket = ticketStringSchema.safeParse(ticket);
  const secret = getServerSupabaseConfig()?.serviceRoleKey;
  if (!parsedTicket.success || !secret) return null;
  const [encoded, received, extra] = parsedTicket.data.split(".");
  if (!encoded || !received || extra) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest();
  const receivedBuffer = Buffer.from(received, "base64url");
  if (receivedBuffer.length !== expected.length || !timingSafeEqual(receivedBuffer, expected)) return null;
  try {
    const parsed = voiceTicketSchema.safeParse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    return parsed.success && parsed.data.expiresAt > Date.now() ? parsed.data : null;
  } catch {
    return null;
  }
}

async function voiceHeader(context: NonNullable<Awaited<ReturnType<typeof conversationContext>>>, path: string) {
  const { data } = await context.admin.storage.from(VOICE_BUCKET).createSignedUrl(path, 60);
  if (!data) return null;
  const response = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
  if (!response.ok) return null;
  if (response.status === 206) return new Uint8Array(await response.arrayBuffer()).slice(0, 16);
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunk = await reader.read();
  await reader.cancel();
  return chunk.value?.slice(0, 16) ?? null;
}

function matchesVoiceHeader(mime: z.infer<typeof voiceMimeSchema>, header: Uint8Array) {
  if (mime === "audio/webm") return header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
  if (mime === "audio/ogg") return String.fromCharCode(...header.slice(0, 4)) === "OggS";
  return String.fromCharCode(...header.slice(4, 8)) === "ftyp";
}

async function resolveShared(
  authorized: AuthorizedCorner,
  value: string | null,
): Promise<CornerMessageView["shared"]> {
  if (!value) return null;
  const separator = value.indexOf(":");
  const kind = value.slice(0, separator) as CornerShareKind;
  const id = value.slice(separator + 1);
  if (!shareKindSchema.safeParse(kind).success || !z.string().uuid().safeParse(id).success) return null;
  if (kind === "gallery") {
    const { data } = await authorized.admin.from("gallery_media").select("title,caption,media_kind").eq("id", id).is("archived_at", null).maybeSingle();
    return data
      ? { type: kind, title: data.title || `${data.media_kind === "image" ? "Photo" : "Video"} memory`, detail: data.caption || "From our Gallery", href: "/gallery", available: true }
      : { type: kind, title: "Gallery memory", detail: "This memory is no longer available.", href: "/gallery", available: false };
  }
  if (kind === "radio") {
    const { data } = await authorized.admin.from("radio_tracks").select("title,artist").eq("id", id).maybeSingle();
    return data
      ? { type: kind, title: data.title, detail: data.artist || "From Jessica’s Radio", href: "/jessicas-radio", available: true }
      : { type: kind, title: "Radio track", detail: "This track is no longer available.", href: "/jessicas-radio", available: false };
  }
  if (kind === "maybe-days") {
    const { data } = await authorized.admin.from("maybe_day_activities").select("title,prompt").eq("id", id).eq("is_active", true).maybeSingle();
    return data
      ? { type: kind, title: data.title, detail: data.prompt, href: "/maybe-days", available: true }
      : { type: kind, title: "Maybe Days activity", detail: "This activity is no longer available.", href: "/maybe-days", available: false };
  }
  const { data } = await authorized.admin.from("her_universe_messages").select("body").eq("id", id).is("archived_at", null).maybeSingle();
  return data
    ? { type: kind, title: "A message from Her Universe", detail: data.body.slice(0, 180), href: "/her-universe", available: true }
    : { type: kind, title: "Her Universe message", detail: "This message is no longer available.", href: "/her-universe", available: false };
}

async function conversationContext(authorized: AuthorizedCorner) {
  const { data: memberships, error } = await authorized.admin.from("our_corner_members")
    .select("conversation_id")
    .eq("user_id", authorized.access.user.id);
  if (error || !memberships?.length) return null;
  const conversationIds = memberships.map((membership) => membership.conversation_id);
  const { data: conversation } = await authorized.admin.from("our_corner_conversations")
    .select("id")
    .in("id", conversationIds)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return conversation ? { ...authorized, conversationId: conversation.id } : null;
}

function memberLabel(
  authorized: AuthorizedCorner,
  userId: string,
  roles: Map<string, "owner" | "guest">,
): "you" | "Brian" | "Jessica" {
  if (userId === authorized.access.user.id) return "you";
  return roles.get(userId) === "owner" ? "Brian" : "Jessica";
}

function excerpt(message: MessageRow) {
  if (message.archived_at) return "This message was removed.";
  if (message.message_kind === "voice") return "Voice note";
  if (message.message_kind === "shared") return "Shared something";
  return (message.body ?? "").slice(0, 120);
}

async function buildMessageViews(
  authorized: AuthorizedCorner,
  conversationId: string,
  messages: MessageRow[],
): Promise<CornerMessageView[]> {
  if (!messages.length) return [];
  const ids = messages.map((message) => message.id);
  const replyIds = messages.flatMap((message) => message.reply_to_message_id ? [message.reply_to_message_id] : []);
  const [{ data: members }, { data: hearts }, { data: receipts }, { data: replies }, { data: voiceNotes }, sharedViews] = await Promise.all([
    authorized.admin.from("app_members").select("user_id,role").eq("active", true).not("user_id", "is", null),
    authorized.admin.from("our_corner_message_hearts").select("message_id,user_id").in("message_id", ids),
    authorized.admin.from("our_corner_read_receipts").select("message_id,user_id").in("message_id", ids),
    replyIds.length
      ? authorized.admin.from("our_corner_messages").select("*").eq("conversation_id", conversationId).in("id", [...new Set(replyIds)])
      : Promise.resolve({ data: [] as MessageRow[] }),
    authorized.admin.from("our_corner_voice_notes").select("message_id,mime_type,size_bytes,duration_seconds").in("message_id", ids),
    Promise.all(messages.map((message) => message.message_kind === "shared" && !message.archived_at
      ? resolveShared(authorized, message.shared_reference)
      : Promise.resolve(null))),
  ]);
  const roles = new Map((members ?? []).map((member) => [member.user_id!, member.role]));
  const replyMap = new Map((replies ?? []).map((reply) => [reply.id, reply]));
  return messages.flatMap((message, index) => {
    const ref = sealReference(message.id);
    if (!ref) return [];
    const replied = message.reply_to_message_id ? replyMap.get(message.reply_to_message_id) : null;
    let reply: CornerReplyView | null = null;
    if (replied) {
      const replyRef = sealReference(replied.id);
      if (replyRef) reply = {
        ref: replyRef,
        senderLabel: memberLabel(authorized, replied.sender_user_id, roles),
        excerpt: excerpt(replied),
        kind: replied.message_kind,
      };
    }
    const voice = (voiceNotes ?? []).find((note) => note.message_id === message.id);
    let savedWaveform: number[] | null = null;
    if (voice && message.body) {
      try {
        const parsed = z.object({ waveform: z.array(z.number().int().min(1).max(100)).min(8).max(64) }).safeParse(JSON.parse(message.body));
        if (parsed.success) savedWaveform = parsed.data.waveform;
      } catch { /* A legacy voice note falls back to deterministic bars. */ }
    }
    const waveform = voice
      ? savedWaveform ?? Array.from({ length: 28 }, (_, bar) => 18 + (parseInt(message.id.replaceAll("-", "").slice(bar % 24, (bar % 24) + 2), 16) % 78))
      : [];
    return [{
      ref,
      clientMessageId: message.client_message_id,
      kind: message.message_kind,
      body: message.archived_at || message.message_kind !== "text" ? null : message.body,
      senderLabel: memberLabel(authorized, message.sender_user_id, roles),
      isOwn: message.sender_user_id === authorized.access.user.id,
      reply,
      heartCount: (hearts ?? []).filter((heart) => heart.message_id === message.id).length,
      ownHeart: Boolean((hearts ?? []).find((heart) => heart.message_id === message.id && heart.user_id === authorized.access.user.id)),
      readByMe: message.sender_user_id === authorized.access.user.id || Boolean((receipts ?? []).find((receipt) => receipt.message_id === message.id && receipt.user_id === authorized.access.user.id)),
      readByOther: Boolean((receipts ?? []).find((receipt) => receipt.message_id === message.id && receipt.user_id !== authorized.access.user.id)),
      createdAt: message.created_at,
      editedAt: message.edited_at,
      archivedAt: message.archived_at,
      voice: voice && !message.archived_at ? {
        durationSeconds: voice.duration_seconds,
        sizeBytes: voice.size_bytes,
        mimeType: voice.mime_type,
        waveform,
      } : null,
      shared: message.archived_at ? null : sharedViews[index],
    }];
  });
}

function page(messages: CornerMessageView[], hasMore: boolean): CornerMessagePage {
  return {
    messages: messages.slice(0, PAGE_SIZE).reverse(),
    nextCursor: hasMore ? messages[PAGE_SIZE - 1]?.createdAt ?? null : null,
  };
}

async function loadPage(context: NonNullable<Awaited<ReturnType<typeof conversationContext>>>, cursor?: string) {
  let query = context.admin.from("our_corner_messages")
    .select("*")
    .eq("conversation_id", context.conversationId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (cursor) query = query.lt("created_at", cursor);
  const { data, error } = await query;
  if (error) return null;
  const views = await buildMessageViews(context, context.conversationId, data ?? []);
  return page(views, (data?.length ?? 0) > PAGE_SIZE);
}

export async function loadOurCornerState(): Promise<CornerStateResult> {
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const loaded = await loadPage(context);
  const conversationRef = sealReference(context.conversationId);
  const { data: ownMember } = await context.admin.from("app_members").select("role").eq("user_id", context.access.user.id).maybeSingle();
  const peerLabel = ownMember?.role === "owner" ? "Jessica" as const : "Brian" as const;
  return loaded && conversationRef
    ? { ok: true, conversationRef, peerLabel, page: loaded }
    : { ok: false, error: "The conversation could not be loaded." };
}

export async function loadOlderOurCornerMessages(cursor: string): Promise<CornerStateResult> {
  const parsed = cursorSchema.safeParse(cursor);
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!parsed.success) return { ok: false, error: "That message page is not available." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const loaded = await loadPage(context, parsed.data);
  const conversationRef = sealReference(context.conversationId);
  const { data: ownMember } = await context.admin.from("app_members").select("role").eq("user_id", context.access.user.id).maybeSingle();
  const peerLabel = ownMember?.role === "owner" ? "Jessica" as const : "Brian" as const;
  return loaded && conversationRef
    ? { ok: true, conversationRef, peerLabel, page: loaded }
    : { ok: false, error: "Older messages could not be loaded." };
}

async function oneMessage(context: NonNullable<Awaited<ReturnType<typeof conversationContext>>>, id: string) {
  const { data } = await context.admin.from("our_corner_messages")
    .select("*")
    .eq("id", id)
    .eq("conversation_id", context.conversationId)
    .maybeSingle();
  return data ? (await buildMessageViews(context, context.conversationId, [data]))[0] ?? null : null;
}

export async function sendOurCornerMessage(clientMessageId: string, body: string, replyRef?: string): Promise<CornerMessageResult> {
  const parsedClientId = clientIdSchema.safeParse(clientMessageId);
  const parsedBody = bodySchema.safeParse(body);
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!parsedClientId.success || !parsedBody.success) return { ok: false, error: "Write a message of up to 4,000 characters." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const replyId = replyRef ? openReference(replyRef) : null;
  if (replyRef && !replyId) return { ok: false, error: "That reply is no longer available." };
  if (replyId) {
    const { data: reply } = await context.admin.from("our_corner_messages")
      .select("id")
      .eq("id", replyId)
      .eq("conversation_id", context.conversationId)
      .maybeSingle();
    if (!reply) return { ok: false, error: "Replies must stay inside this conversation." };
  }
  const { data, error } = await context.admin.from("our_corner_messages").insert({
    conversation_id: context.conversationId,
    sender_user_id: context.access.user.id,
    client_message_id: parsedClientId.data,
    message_kind: "text",
    body: parsedBody.data,
    reply_to_message_id: replyId,
  }).select("*").maybeSingle();
  let stored = data;
  if (error?.code === "23505") {
    const existing = await context.admin.from("our_corner_messages").select("*")
      .eq("conversation_id", context.conversationId)
      .eq("sender_user_id", context.access.user.id)
      .eq("client_message_id", parsedClientId.data)
      .maybeSingle();
    stored = existing.data;
  } else if (error) {
    console.error("Our Corner message operation failed", { operation: "send", code: error.code });
  }
  const message = stored ? (await buildMessageViews(context, context.conversationId, [stored]))[0] : null;
  return message ? { ok: true, message } : { ok: false, error: "Your message could not be sent just now." };
}

export async function editOurCornerMessage(ref: string, body: string): Promise<CornerMessageResult> {
  const id = openReference(ref);
  const parsedBody = bodySchema.safeParse(body);
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id || !parsedBody.success) return { ok: false, error: "That edit is not valid." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const cutoff = new Date(Date.now() - EDIT_WINDOW_MS).toISOString();
  const { data, error } = await context.admin.from("our_corner_messages")
    .update({ body: parsedBody.data })
    .eq("id", id)
    .eq("conversation_id", context.conversationId)
    .eq("sender_user_id", context.access.user.id)
    .eq("message_kind", "text")
    .is("archived_at", null)
    .gte("created_at", cutoff)
    .select("*")
    .maybeSingle();
  if (error) console.error("Our Corner message operation failed", { operation: "edit", code: error.code });
  const message = data ? (await buildMessageViews(context, context.conversationId, [data]))[0] : null;
  return message ? { ok: true, message } : { ok: false, error: "Messages can be edited by their author for 15 minutes." };
}

export async function archiveOurCornerMessage(ref: string): Promise<CornerMessageResult> {
  const id = openReference(ref);
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id) return { ok: false, error: "That message is no longer available." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const cutoff = new Date(Date.now() - EDIT_WINDOW_MS).toISOString();
  const { data } = await context.admin.from("our_corner_messages")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("conversation_id", context.conversationId)
    .eq("sender_user_id", context.access.user.id)
    .is("archived_at", null)
    .gte("created_at", cutoff)
    .select("*")
    .maybeSingle();
  const message = data ? (await buildMessageViews(context, context.conversationId, [data]))[0] : null;
  return message ? { ok: true, message } : { ok: false, error: "Messages can be removed by their author for 15 minutes." };
}

export async function setOurCornerHeart(ref: string, active: boolean): Promise<CornerMutationResult> {
  const id = openReference(ref);
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!id) return { ok: false, error: "That message is no longer available." };
  const context = await conversationContext(authorized);
  if (!context || !(await oneMessage(context, id))) return { ok: false, error: "That message is not in this conversation." };
  const { error } = active
    ? await context.admin.from("our_corner_message_hearts").upsert({ message_id: id, user_id: context.access.user.id }, { onConflict: "message_id,user_id" })
    : await context.admin.from("our_corner_message_hearts").delete().eq("message_id", id).eq("user_id", context.access.user.id);
  return error ? { ok: false, error: "Your heart could not be updated." } : { ok: true };
}

export async function markOurCornerMessagesRead(refs: string[]): Promise<CornerMutationResult> {
  const parsed = refsSchema.safeParse(refs);
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!parsed.success) return { ok: false, error: "Those read receipts are not valid." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const ids = parsed.data.flatMap((ref) => openReference(ref) ?? []);
  const { data: messages } = await context.admin.from("our_corner_messages")
    .select("id")
    .eq("conversation_id", context.conversationId)
    .neq("sender_user_id", context.access.user.id)
    .in("id", ids);
  if (!messages?.length) return { ok: true };
  const { error } = await context.admin.from("our_corner_read_receipts").upsert(
    messages.map((message) => ({ message_id: message.id, user_id: context.access.user.id, read_at: new Date().toISOString() })),
    { onConflict: "message_id,user_id" },
  );
  return error ? { ok: false, error: "Read state could not be updated." } : { ok: true };
}

export async function prepareOurCornerVoiceUpload(input: unknown): Promise<CornerVoicePreparation> {
  const parsed = voiceInputSchema.safeParse(input);
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "Your session could not be authorized." };
  if (!parsed.success) return { ok: false, error: "Voice notes must be under 10 minutes and 20 MB." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  if (parsed.data.replyRef) {
    const replyId = openReference(parsed.data.replyRef);
    if (!replyId || !(await oneMessage(context, replyId))) return { ok: false, error: "That reply is no longer available." };
  }
  const extension = parsed.data.mimeType.includes("ogg") ? "ogg" : parsed.data.mimeType.includes("mp4") || parsed.data.mimeType.includes("m4a") ? "m4a" : "webm";
  const path = `${context.conversationId}/${randomUUID()}.${extension}`;
  const payload: VoiceTicket = {
    ...parsed.data,
    userId: context.access.user.id,
    conversationId: context.conversationId,
    path,
    expiresAt: Date.now() + 15 * 60_000,
  };
  const ticket = createVoiceTicket(payload);
  if (!ticket) return { ok: false, error: "The private voice upload could not be prepared." };
  const { data, error } = await context.admin.storage.from(VOICE_BUCKET).createSignedUploadUrl(path, { upsert: false });
  return error || !data
    ? { ok: false, error: "The private voice upload could not be prepared." }
    : { ok: true, signedUrl: data.signedUrl, ticket };
}

export async function cancelOurCornerVoiceUpload(ticket: string): Promise<CornerMutationResult> {
  const payload = readVoiceTicket(ticket);
  const authorized = await authorizeOurCorner();
  if (!authorized || !payload || payload.userId !== authorized.access.user.id) return { ok: false, error: "That upload is no longer available." };
  await authorized.admin.storage.from(VOICE_BUCKET).remove([payload.path]);
  return { ok: true };
}

export async function finalizeOurCornerVoiceUpload(ticket: string): Promise<CornerMessageResult> {
  const payload = readVoiceTicket(ticket);
  const authorized = await authorizeOurCorner();
  if (!authorized || !payload || payload.userId !== authorized.access.user.id) return { ok: false, error: "That upload authorization has expired." };
  const context = await conversationContext(authorized);
  if (!context || context.conversationId !== payload.conversationId) return { ok: false, error: "The private conversation is not available." };
  const existing = await context.admin.from("our_corner_messages").select("*")
    .eq("conversation_id", context.conversationId).eq("sender_user_id", context.access.user.id)
    .eq("client_message_id", payload.clientMessageId).maybeSingle();
  if (existing.data) {
    const message = (await buildMessageViews(context, context.conversationId, [existing.data]))[0];
    return message ? { ok: true, message } : { ok: false, error: "The voice note could not be loaded." };
  }
  const { data: info, error: infoError } = await context.admin.storage.from(VOICE_BUCKET).info(payload.path);
  if (infoError || !info || info.size !== payload.sizeBytes || info.contentType?.split(";")[0] !== payload.mimeType) {
    await context.admin.storage.from(VOICE_BUCKET).remove([payload.path]);
    return { ok: false, error: "The uploaded voice note could not be verified." };
  }
  const header = await voiceHeader(context, payload.path);
  if (!header || !matchesVoiceHeader(payload.mimeType, header)) {
    await context.admin.storage.from(VOICE_BUCKET).remove([payload.path]);
    return { ok: false, error: "The uploaded file was not a supported voice recording." };
  }
  const replyId = payload.replyRef ? openReference(payload.replyRef) : null;
  if (payload.replyRef && (!replyId || !(await oneMessage(context, replyId)))) {
    await context.admin.storage.from(VOICE_BUCKET).remove([payload.path]);
    return { ok: false, error: "That reply is no longer available." };
  }
  const inserted = await context.admin.from("our_corner_messages").insert({
    conversation_id: context.conversationId,
    sender_user_id: context.access.user.id,
    client_message_id: payload.clientMessageId,
    message_kind: "voice",
    body: JSON.stringify({ waveform: payload.waveform }),
    reply_to_message_id: replyId,
  }).select("*").maybeSingle();
  if (!inserted.data) {
    await context.admin.storage.from(VOICE_BUCKET).remove([payload.path]);
    return { ok: false, error: "The voice note could not be sent." };
  }
  const metadata = await context.admin.from("our_corner_voice_notes").insert({
    message_id: inserted.data.id,
    storage_object_path: payload.path,
    mime_type: payload.mimeType,
    size_bytes: payload.sizeBytes,
    duration_seconds: payload.durationSeconds,
  });
  if (metadata.error) {
    await Promise.all([
      context.admin.from("our_corner_messages").update({ archived_at: new Date().toISOString() }).eq("id", inserted.data.id),
      context.admin.storage.from(VOICE_BUCKET).remove([payload.path]),
    ]);
    return { ok: false, error: "The voice note could not be finalized." };
  }
  const message = (await buildMessageViews(context, context.conversationId, [inserted.data]))[0];
  return message ? { ok: true, message } : { ok: false, error: "The voice note could not be loaded." };
}

export async function getOurCornerVoiceUrl(ref: string): Promise<CornerVoiceUrlResult> {
  const id = openReference(ref);
  const authorized = await authorizeOurCorner();
  if (!authorized || !id) return { ok: false, error: "That voice note is unavailable." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const { data: message } = await context.admin.from("our_corner_messages").select("id")
    .eq("id", id).eq("conversation_id", context.conversationId).eq("message_kind", "voice").is("archived_at", null).maybeSingle();
  if (!message) return { ok: false, error: "That voice note is unavailable." };
  const { data: voice } = await context.admin.from("our_corner_voice_notes").select("storage_object_path").eq("message_id", id).maybeSingle();
  if (!voice) return { ok: false, error: "That voice note is unavailable." };
  const lifetime = 120;
  const { data, error } = await context.admin.storage.from(VOICE_BUCKET).createSignedUrl(voice.storage_object_path, lifetime);
  return error || !data
    ? { ok: false, error: "That voice note could not be played." }
    : { ok: true, signedUrl: data.signedUrl, expiresAt: new Date(Date.now() + lifetime * 1000).toISOString() };
}

export async function loadOurCornerShareItems(kind: CornerShareKind, offset = 0): Promise<
  { ok: true; page: CornerSharePage } | { ok: false; error: string }
> {
  const parsedKind = shareKindSchema.safeParse(kind);
  const parsedOffset = z.number().int().min(0).max(1000).safeParse(offset);
  const authorized = await authorizeOurCorner();
  if (!authorized || !parsedKind.success || !parsedOffset.success) return { ok: false, error: "Those shared items are unavailable." };
  const limit = 10;
  let rows: { id: string; title: string; detail: string }[] = [];
  if (kind === "gallery") {
    const { data } = await authorized.admin.from("gallery_media").select("id,title,caption,media_kind").is("archived_at", null).order("created_at", { ascending: false }).range(offset, offset + limit);
    rows = (data ?? []).map((item) => ({ id: item.id, title: item.title || `${item.media_kind === "image" ? "Photo" : "Video"} memory`, detail: item.caption || "From our Gallery" }));
  } else if (kind === "radio") {
    const { data } = await authorized.admin.from("radio_tracks").select("id,title,artist").order("created_at", { ascending: false }).range(offset, offset + limit);
    rows = (data ?? []).map((item) => ({ id: item.id, title: item.title, detail: item.artist || "From Jessica’s Radio" }));
  } else if (kind === "maybe-days") {
    const { data } = await authorized.admin.from("maybe_day_activities").select("id,title,prompt").eq("is_active", true).order("sort_order").range(offset, offset + limit);
    rows = (data ?? []).map((item) => ({ id: item.id, title: item.title, detail: item.prompt }));
  } else {
    const { data } = await authorized.admin.from("her_universe_messages").select("id,body").is("archived_at", null).order("created_at", { ascending: false }).range(offset, offset + limit);
    rows = (data ?? []).map((item) => ({ id: item.id, title: "A message from Her Universe", detail: item.body.slice(0, 180) }));
  }
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).flatMap((item) => {
    const ref = sealReference(`${kind}:${item.id}`);
    return ref ? [{ ref, kind, title: item.title, detail: item.detail }] : [];
  });
  return { ok: true, page: { items, nextCursor: hasMore ? offset + limit : null } };
}

export async function shareOurCornerItem(clientMessageId: string, itemRef: string, replyRef?: string): Promise<CornerMessageResult> {
  const parsedClient = clientIdSchema.safeParse(clientMessageId);
  const raw = openReference(itemRef);
  const separator = raw?.indexOf(":") ?? -1;
  const kind = raw?.slice(0, separator) as CornerShareKind;
  const id = raw?.slice(separator + 1);
  const authorized = await authorizeOurCorner();
  if (!authorized || !parsedClient.success || !raw || !shareKindSchema.safeParse(kind).success || !z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "That item cannot be shared." };
  }
  const context = await conversationContext(authorized);
  const shared = await resolveShared(authorized, raw);
  if (!context || !shared?.available) return { ok: false, error: "That item is no longer available." };
  const replyId = replyRef ? openReference(replyRef) : null;
  if (replyRef && (!replyId || !(await oneMessage(context, replyId)))) return { ok: false, error: "That reply is no longer available." };
  const sharedType = kind === "gallery" ? "memory" : kind === "radio" ? "song" : kind === "maybe-days" ? "activity" : "question";
  const inserted = await context.admin.from("our_corner_messages").insert({
    conversation_id: context.conversationId,
    sender_user_id: context.access.user.id,
    client_message_id: parsedClient.data,
    message_kind: "shared",
    shared_type: sharedType,
    shared_reference: raw,
    reply_to_message_id: replyId,
  }).select("*").maybeSingle();
  let stored = inserted.data;
  if (inserted.error?.code === "23505") {
    stored = (await context.admin.from("our_corner_messages").select("*")
      .eq("sender_user_id", context.access.user.id).eq("client_message_id", parsedClient.data).maybeSingle()).data;
  }
  const message = stored ? (await buildMessageViews(context, context.conversationId, [stored]))[0] : null;
  return message ? { ok: true, message } : { ok: false, error: "That item could not be shared." };
}

export async function loadOurCornerFeatures(localDate: string): Promise<CornerFeaturesResult> {
  const parsedDate = localDateSchema.safeParse(localDate);
  const authorized = await authorizeOurCorner();
  if (!authorized || !parsedDate.success) return { ok: false, error: "The shared room details could not be loaded." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const [{ data: pins }, { data: notes }, { data: moods }, { data: members }] = await Promise.all([
    context.admin.from("our_corner_pinned_messages").select("message_id,pinned_at").eq("conversation_id", context.conversationId).order("pinned_at", { ascending: false }).limit(8),
    context.admin.from("our_corner_daily_notes").select("*").eq("conversation_id", context.conversationId).eq("note_date", parsedDate.data).is("archived_at", null),
    context.admin.from("our_corner_temporary_moods").select("*").eq("conversation_id", context.conversationId).gt("expires_at", new Date().toISOString()),
    context.admin.from("app_members").select("user_id,role").eq("active", true).not("user_id", "is", null),
  ]);
  const roles = new Map((members ?? []).map((member) => [member.user_id!, member.role]));
  const pinnedIds = (pins ?? []).map((pin) => pin.message_id);
  const { data: pinnedMessages } = pinnedIds.length
    ? await context.admin.from("our_corner_messages").select("*").eq("conversation_id", context.conversationId).in("id", pinnedIds)
    : { data: [] as MessageRow[] };
  const views = await buildMessageViews(context, context.conversationId, pinnedMessages ?? []);
  const byId = new Map((pinnedMessages ?? []).map((message, index) => [message.id, views[index]]));
  return {
    ok: true,
    pins: (pins ?? []).flatMap((pin) => {
      const message = byId.get(pin.message_id);
      return message ? [{ message, pinnedAt: pin.pinned_at }] : [];
    }),
    notes: (notes ?? []).map((note) => ({
      body: note.body,
      authorLabel: memberLabel(context, note.author_user_id, roles),
      isOwn: note.author_user_id === context.access.user.id,
      updatedAt: note.updated_at,
    })),
    moods: (moods ?? []).flatMap((mood) => {
      const parsed = moodSchema.safeParse(mood.mood);
      return parsed.success ? [{
        mood: parsed.data,
        authorLabel: memberLabel(context, mood.user_id, roles),
        isOwn: mood.user_id === context.access.user.id,
      }] : [];
    }),
  };
}

export async function loadOurCornerMoods(): Promise<{ ok: true; moods: CornerMoodView[] } | { ok: false; error: string }> {
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false, error: "The room mood could not be loaded." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const [{ data: moods }, { data: members }] = await Promise.all([
    context.admin.from("our_corner_temporary_moods").select("*").eq("conversation_id", context.conversationId).gt("expires_at", new Date().toISOString()),
    context.admin.from("app_members").select("user_id,role").eq("active", true).not("user_id", "is", null),
  ]);
  const roles = new Map((members ?? []).map((member) => [member.user_id!, member.role]));
  return {
    ok: true,
    moods: (moods ?? []).flatMap((mood) => {
      const parsed = moodSchema.safeParse(mood.mood);
      return parsed.success ? [{
        mood: parsed.data,
        authorLabel: memberLabel(context, mood.user_id, roles),
        isOwn: mood.user_id === context.access.user.id,
      }] : [];
    }),
  };
}

export async function setOurCornerPin(ref: string, active: boolean): Promise<CornerMutationResult> {
  const id = openReference(ref);
  const authorized = await authorizeOurCorner();
  if (!authorized || !id) return { ok: false, error: "That message is unavailable." };
  const context = await conversationContext(authorized);
  if (!context || !(await oneMessage(context, id))) return { ok: false, error: "That message is not in this conversation." };
  const { error } = active
    ? await context.admin.from("our_corner_pinned_messages").upsert({
      conversation_id: context.conversationId,
      message_id: id,
      pinned_by_user_id: context.access.user.id,
    }, { onConflict: "conversation_id,message_id" })
    : await context.admin.from("our_corner_pinned_messages").delete().eq("conversation_id", context.conversationId).eq("message_id", id);
  return error ? { ok: false, error: "The pinned corner could not be updated." } : { ok: true };
}

export async function saveOurCornerDailyNote(localDate: string, body: string): Promise<CornerMutationResult> {
  const parsedDate = localDateSchema.safeParse(localDate);
  const parsedBody = z.string().trim().min(1).max(280).safeParse(body);
  const authorized = await authorizeOurCorner();
  if (!authorized || !parsedDate.success || !parsedBody.success) return { ok: false, error: "Today’s note must be between 1 and 280 characters." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const existing = await context.admin.from("our_corner_daily_notes").select("id")
    .eq("conversation_id", context.conversationId).eq("author_user_id", context.access.user.id).eq("note_date", parsedDate.data).maybeSingle();
  const operation = existing.data
    ? context.admin.from("our_corner_daily_notes").update({ body: parsedBody.data, archived_at: null }).eq("id", existing.data.id).eq("author_user_id", context.access.user.id)
    : context.admin.from("our_corner_daily_notes").insert({
      conversation_id: context.conversationId,
      author_user_id: context.access.user.id,
      note_date: parsedDate.data,
      body: parsedBody.data,
    });
  const { error } = await operation;
  return error ? { ok: false, error: "Today’s note could not be saved." } : { ok: true };
}

export async function setOurCornerMood(mood: CornerMood | null): Promise<CornerMutationResult> {
  const parsedMood = mood === null ? null : moodSchema.safeParse(mood);
  const authorized = await authorizeOurCorner();
  if (!authorized || (parsedMood && !parsedMood.success)) return { ok: false, error: "That mood is not available." };
  const context = await conversationContext(authorized);
  if (!context) return { ok: false, error: "The private conversation is not available." };
  const { error } = mood === null
    ? await context.admin.from("our_corner_temporary_moods").delete().eq("conversation_id", context.conversationId).eq("user_id", context.access.user.id)
    : await context.admin.from("our_corner_temporary_moods").upsert({
      conversation_id: context.conversationId,
      user_id: context.access.user.id,
      mood,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "conversation_id,user_id" });
  return error ? { ok: false, error: "Your mood could not be updated." } : { ok: true };
}

export async function completeOurCornerJourney() {
  const authorized = await authorizeOurCorner();
  if (!authorized) return { ok: false as const, error: "Please sign in with an approved account to continue." };
  const result = await persistOurCornerCompletion();
  if (result.ok) return result;
  return {
    ...result,
    error: result.reason === "unauthorized"
      ? "Please sign in with an approved account to continue."
      : result.reason === "missing_prerequisite"
        ? "Complete the earlier journey rooms before continuing."
        : "The next step could not be saved. Please try again.",
  };
}

export async function recordOurCornerNextDestination() {
  const authorized = await authorizeOurCorner();
  if (!authorized) return false;
  return saveWorldDestination("open-when");
}
