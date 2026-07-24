"use server";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { authorizeGallery, loadGalleryMedia, sanitizeGalleryMedia } from "@/lib/gallery/server";
import {
  GALLERY_BUCKET,
  matchesGallerySignature,
  toPublicGalleryMedia,
  validateGalleryDescriptor,
  type GalleryExtension,
  type GalleryMediaKind,
  type PublicGalleryMedia,
} from "@/lib/gallery/media";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import { persistGalleryCompletion, saveWorldDestination } from "@/lib/progression/user-progress";

export type GalleryActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  media?: PublicGalleryMedia;
  version: number;
};
export type GalleryUploadPreparation =
  | { ok: true; signedUrl: string; ticket: string }
  | { ok: false; error: string };

const mediaIdSchema = z.string().uuid();
const uploadInputSchema = z.object({
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(120),
  size: z.number().int().positive(),
  title: z.string().trim().max(160).default(""),
  caption: z.string().trim().max(2000).default(""),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  durationSeconds: z.number().finite().nonnegative().nullable().default(null),
});
const ticketSchema = z.object({
  userId: z.string().uuid(),
  path: z.string().min(1).max(1024),
  originalFilename: z.string().min(1).max(255),
  extension: z.enum(["jpg", "jpeg", "png", "webp", "gif", "avif", "mp4", "webm", "mov", "m4v"]),
  kind: z.enum(["image", "video"]),
  mime: z.string().min(1).max(120),
  size: z.number().int().positive(),
  title: z.string().max(160),
  caption: z.string().max(2000),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().finite().nonnegative().nullable(),
  expiresAt: z.number().int().positive(),
});
type UploadTicket = z.infer<typeof ticketSchema>;

const preparationWindows = new Map<string, { startedAt: number; count: number }>();

function ticketSecret() {
  return getServerSupabaseConfig()?.serviceRoleKey ?? null;
}

function createUploadTicket(payload: UploadTicket) {
  const secret = ticketSecret();
  if (!secret) return null;
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readUploadTicket(ticket: string) {
  const secret = ticketSecret();
  const [encoded, received, extra] = ticket.split(".");
  if (!secret || !encoded || !received || extra) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest();
  const receivedBuffer = Buffer.from(received, "base64url");
  if (receivedBuffer.length !== expected.length || !timingSafeEqual(receivedBuffer, expected)) return null;
  try {
    const parsed = ticketSchema.safeParse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    return parsed.success && parsed.data.expiresAt > Date.now() ? parsed.data : null;
  } catch {
    return null;
  }
}

function allowPreparation(userId: string) {
  const now = Date.now();
  const current = preparationWindows.get(userId);
  if (!current || now - current.startedAt > 60_000) {
    preparationWindows.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}

export async function prepareGalleryUpload(input: unknown): Promise<GalleryUploadPreparation> {
  const authorized = await authorizeGallery();
  if (!authorized) return { ok: false, error: "You are not authorized to upload to the Gallery." };
  if (!allowPreparation(authorized.access.user.id)) return { ok: false, error: "Please wait a moment before preparing more uploads." };
  const parsed = uploadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check this memory’s file and details." };
  const validated = validateGalleryDescriptor(parsed.data.filename, parsed.data.mime, parsed.data.size);
  if (!validated.ok) return validated;

  const path = `${randomUUID()}/${randomUUID()}.${validated.descriptor.extension}`;
  const payload: UploadTicket = {
    userId: authorized.access.user.id,
    path,
    originalFilename: validated.descriptor.originalFilename,
    extension: validated.descriptor.extension,
    kind: validated.descriptor.kind,
    mime: validated.descriptor.mime,
    size: validated.descriptor.size,
    title: parsed.data.title,
    caption: parsed.data.caption,
    width: parsed.data.width,
    height: parsed.data.height,
    durationSeconds: parsed.data.durationSeconds,
    expiresAt: Date.now() + 30 * 60_000,
  };
  const ticket = createUploadTicket(payload);
  if (!ticket) return { ok: false, error: "The private upload could not be prepared." };
  const { data, error } = await authorized.admin.storage.from(GALLERY_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    console.error("Gallery signed upload preparation failed", { code: error?.name ?? "no_data" });
    return { ok: false, error: "The private upload could not be prepared. Please try again." };
  }
  return { ok: true, signedUrl: data.signedUrl, ticket };
}

async function readStoredHeader(signedUrl: string) {
  const response = await fetch(signedUrl, { headers: { Range: "bytes=0-31" }, cache: "no-store" });
  if (!response.ok) return null;
  if (response.status === 206) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunk = await reader.read();
  await reader.cancel();
  return chunk.value?.slice(0, 32) ?? null;
}

async function safeMediaForOwner(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeGallery>>>,
  path: string,
) {
  const { data } = await authorized.admin.from("gallery_media").select("*").eq("storage_path", path).maybeSingle();
  if (!data) return null;
  const [safe] = await sanitizeGalleryMedia(authorized, [data]);
  return safe ?? null;
}

export async function finalizeGalleryUpload(ticket: string): Promise<GalleryActionResult> {
  const version = Date.now();
  const authorized = await authorizeGallery();
  const payload = readUploadTicket(ticket);
  if (!authorized || !payload || payload.userId !== authorized.access.user.id) {
    return { ok: false, error: "This upload authorization is no longer valid.", version };
  }

  const existing = await safeMediaForOwner(authorized, payload.path);
  if (existing) return { ok: true, media: existing, message: "This memory is already in the Gallery.", version };

  const { data: info, error: infoError } = await authorized.admin.storage.from(GALLERY_BUCKET).info(payload.path);
  if (infoError || !info || info.size !== payload.size || info.contentType !== payload.mime) {
    await authorized.admin.storage.from(GALLERY_BUCKET).remove([payload.path]);
    return { ok: false, error: "The uploaded file did not match the prepared memory.", version };
  }
  const { data: signed, error: signedError } = await authorized.admin.storage.from(GALLERY_BUCKET).createSignedUrl(payload.path, 60);
  const header = signed && !signedError ? await readStoredHeader(signed.signedUrl) : null;
  if (!header || !matchesGallerySignature(payload.extension as GalleryExtension, header)) {
    await authorized.admin.storage.from(GALLERY_BUCKET).remove([payload.path]);
    return { ok: false, error: "The uploaded media could not be verified.", version };
  }

  const { data, error } = await authorized.admin.from("gallery_media").insert({
    uploader_user_id: authorized.access.user.id,
    storage_path: payload.path,
    original_filename: payload.originalFilename,
    media_kind: payload.kind as GalleryMediaKind,
    mime_type: payload.mime,
    file_size_bytes: payload.size,
    title: payload.title || null,
    caption: payload.caption || null,
    width: payload.width,
    height: payload.height,
    duration_seconds: payload.durationSeconds,
  }).select("*").maybeSingle();
  if (error?.code === "23505") {
    const duplicate = await safeMediaForOwner(authorized, payload.path);
    if (duplicate) return { ok: true, media: duplicate, message: "This memory is already in the Gallery.", version };
  }
  if (error || !data) {
    console.error("Gallery finalize failed", { code: error?.code ?? "no_data" });
    await authorized.admin.storage.from(GALLERY_BUCKET).remove([payload.path]);
    return { ok: false, error: "The memory details could not be finalized.", version };
  }
  const media = toPublicGalleryMedia(data, authorized.access.user.id);
  return { ok: true, media, message: "Your memory is now resting in the private Gallery.", version };
}

export async function cancelGalleryUpload(ticket: string) {
  const authorized = await authorizeGallery();
  const payload = readUploadTicket(ticket);
  if (!authorized || !payload || payload.userId !== authorized.access.user.id) return { ok: false as const };
  await authorized.admin.storage.from(GALLERY_BUCKET).remove([payload.path]);
  return { ok: true as const };
}

export async function loadMoreGalleryMedia(before: string) {
  const authorized = await authorizeGallery();
  if (!authorized || !z.string().datetime({ offset: true }).safeParse(before).success) {
    return { ok: false as const, error: "More memories could not be loaded." };
  }
  const page = await loadGalleryMedia(authorized, before);
  return { ok: true as const, ...page };
}

export async function getGalleryViewingUrl(id: string) {
  const authorized = await authorizeGallery();
  const parsed = mediaIdSchema.safeParse(id);
  if (!authorized || !parsed.success) return { ok: false as const, error: "This memory is unavailable." };
  const { data: media } = await authorized.admin.from("gallery_media")
    .select("storage_path")
    .eq("id", parsed.data)
    .is("archived_at", null)
    .maybeSingle();
  if (!media) return { ok: false as const, error: "This memory is unavailable." };
  const expiresIn = 120;
  const { data, error } = await authorized.admin.storage.from(GALLERY_BUCKET).createSignedUrl(media.storage_path, expiresIn);
  if (error || !data) return { ok: false as const, error: "This memory could not be prepared." };
  return { ok: true as const, url: data.signedUrl, expiresAt: Date.now() + (expiresIn - 15) * 1000 };
}

export async function updateGalleryMemory(formData: FormData): Promise<GalleryActionResult> {
  const version = Date.now();
  const authorized = await authorizeGallery();
  if (!authorized) return { ok: false, error: "You are not authorized to use the Gallery.", version };
  const id = mediaIdSchema.safeParse(formData.get("id"));
  const metadata = z.object({
    title: z.string().trim().max(160),
    caption: z.string().trim().max(2000),
  }).safeParse({ title: formData.get("title"), caption: formData.get("caption") });
  if (!id.success || !metadata.success) return { ok: false, error: "Check the memory details.", version };
  const { data, error } = await authorized.admin.from("gallery_media").update({
    title: metadata.data.title || null,
    caption: metadata.data.caption || null,
  }).eq("id", id.data).eq("uploader_user_id", authorized.access.user.id).is("archived_at", null).select("*").maybeSingle();
  if (error || !data) return { ok: false, error: "The memory could not be updated.", version };
  return { ok: true, message: "Memory details updated.", media: toPublicGalleryMedia(data, authorized.access.user.id), version };
}

export async function archiveGalleryMemory(id: string): Promise<GalleryActionResult> {
  const version = Date.now();
  const authorized = await authorizeGallery();
  const parsed = mediaIdSchema.safeParse(id);
  if (!authorized) return { ok: false, error: "You are not authorized to use the Gallery.", version };
  if (!parsed.success) return { ok: false, error: "The memory could not be archived.", version };
  const { data, error } = await authorized.admin.from("gallery_media").update({
    archived_at: new Date().toISOString(),
  }).eq("id", parsed.data).eq("uploader_user_id", authorized.access.user.id).is("archived_at", null).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "The memory could not be archived.", version };
  return { ok: true, message: "The memory was archived without deleting it.", version };
}

export async function cleanupArchivedGalleryObject(id: string) {
  const authorized = await authorizeGallery();
  const parsed = mediaIdSchema.safeParse(id);
  if (!authorized || !parsed.success) return { ok: false as const };
  const { data } = await authorized.admin.from("gallery_media")
    .select("storage_path")
    .eq("id", parsed.data)
    .eq("uploader_user_id", authorized.access.user.id)
    .not("archived_at", "is", null)
    .maybeSingle();
  if (!data) return { ok: false as const };
  const { error } = await authorized.admin.storage.from(GALLERY_BUCKET).remove([data.storage_path]);
  if (error) {
    console.error("Archived Gallery object cleanup failed", { code: error.name });
    return { ok: false as const };
  }
  return { ok: true as const };
}

export async function completeGalleryJourney() {
  const result = await persistGalleryCompletion();
  if (result.ok) {
    after(async () => {
      const saved = await saveWorldDestination("our-journey");
      if (!saved) console.error("Gallery completion operation failed", { operation: "save_navigation_metadata" });
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
