"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { authorizeSharedContent, isUploader } from "@/lib/media/shared-content";
import { audioFormats, radioMetadataFromForm, RADIO_BUCKET, toPublicTrack, validateAudioFile, type PublicRadioTrack } from "@/lib/radio/tracks";
import { persistRadioCompletion, saveSafeLocation } from "@/lib/progression/user-progress";

export type RadioActionResult = { ok: boolean; error?: string; message?: string; track?: PublicRadioTrack; partial?: boolean };
const recentUploads = new Map<string, number>();

export async function uploadRadioTrack(formData: FormData): Promise<RadioActionResult> {
  const authorized = await authorizeSharedContent("radio");
  if (!authorized) return { ok: false, error: "You are not authorized to use Jessica’s Radio." };
  const metadata = radioMetadataFromForm(formData);
  if (!metadata.success) return { ok: false, error: metadata.error.issues[0]?.message ?? "Check the song details." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an audio file." };
  const validated = await validateAudioFile(file);
  if (!validated.ok) return { ok: false, error: validated.error };
  const previous = recentUploads.get(authorized.access.user.id) ?? 0;
  if (Date.now() - previous < 3000) return { ok: false, error: "Please wait a moment before uploading another song." };
  recentUploads.set(authorized.access.user.id, Date.now());
  const path = `${authorized.access.user.id}/${randomUUID()}.${validated.extension}`;
  const { error: uploadError } = await authorized.admin.storage.from(RADIO_BUCKET).upload(path, file, {
    contentType: validated.mime, upsert: false, cacheControl: "private, max-age=0",
  });
  if (uploadError) {
    console.error("Radio private upload failed", { code: uploadError.name });
    return { ok: false, error: "The private audio file could not be uploaded. Please try again." };
  }
  const { data, error } = await authorized.admin.from("radio_tracks").insert({
    uploader_user_id: authorized.access.user.id,
    title: metadata.data.title,
    artist: metadata.data.artist || null,
    personal_note: metadata.data.personal_note || null,
    original_filename: validated.originalFilename,
    storage_path: path,
    mime_type: validated.mime,
    file_extension: validated.extension,
    size_bytes: file.size,
  }).select("*").single();
  if (error || !data) {
    console.error("Radio metadata creation failed; removing uploaded object", { code: error?.code });
    await authorized.admin.storage.from(RADIO_BUCKET).remove([path]);
    return { ok: false, error: "The song details could not be saved. The uploaded file was cleaned up." };
  }
  revalidatePath("/radio");
  return { ok: true, message: "The song is now in the shared private Radio.", track: toPublicTrack(data, authorized.access.user.id) };
}

export async function updateRadioTrack(formData: FormData): Promise<RadioActionResult> {
  const authorized = await authorizeSharedContent("radio");
  if (!authorized) return { ok: false, error: "You are not authorized to use Jessica’s Radio." };
  const id = formData.get("id");
  const metadata = radioMetadataFromForm(formData);
  if (typeof id !== "string" || !metadata.success) return { ok: false, error: metadata.success ? "The song could not be updated." : metadata.error.issues[0]?.message };
  const { data, error } = await authorized.admin.from("radio_tracks").update({
    title: metadata.data.title, artist: metadata.data.artist || null, personal_note: metadata.data.personal_note || null,
  }).eq("id", id).eq("uploader_user_id", authorized.access.user.id).select("*").maybeSingle();
  if (error || !data) return { ok: false, error: "The song could not be updated." };
  revalidatePath("/radio");
  return { ok: true, message: "Song details updated.", track: toPublicTrack(data, authorized.access.user.id) };
}

export async function deleteRadioTrack(id: string): Promise<RadioActionResult> {
  const authorized = await authorizeSharedContent("radio");
  if (!authorized) return { ok: false, error: "You are not authorized to use Jessica’s Radio." };
  const { data } = await authorized.admin.from("radio_tracks").select("*").eq("id", id).maybeSingle();
  if (!data || !isUploader(data.uploader_user_id, authorized.access.user.id)) return { ok: false, error: "The song could not be deleted." };
  const { error: objectError } = await authorized.admin.storage.from(RADIO_BUCKET).remove([data.storage_path]);
  if (objectError) return { ok: false, error: "The private audio file could not be removed, so its Radio record was kept." };
  const { error } = await authorized.admin.from("radio_tracks").delete().eq("id", id).eq("uploader_user_id", authorized.access.user.id);
  if (error) return { ok: false, partial: true, error: "The file was removed, but its Radio record could not be removed." };
  revalidatePath("/radio");
  return { ok: true, message: "The song was removed from Jessica’s Radio." };
}

export async function completeRadioJourney() {
  const result = await persistRadioCompletion();
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

export async function recordRadioLocation() {
  return saveSafeLocation("radio");
}

export async function getAcceptedRadioFormats() {
  return Object.values(audioFormats).map((format) => format.label);
}
