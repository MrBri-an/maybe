import { z } from "zod";
import type { RadioTrack } from "@/lib/supabase/database.types";

export const RADIO_BUCKET = "radio-audio";
export const MAX_AUDIO_SIZE = 50 * 1024 * 1024;
export const audioFormats = {
  mp3: { mimes: ["audio/mpeg"], label: "MP3" },
  m4a: { mimes: ["audio/mp4", "audio/x-m4a"], label: "M4A" },
  aac: { mimes: ["audio/aac"], label: "AAC" },
  wav: { mimes: ["audio/wav", "audio/x-wav"], label: "WAV" },
  ogg: { mimes: ["audio/ogg"], label: "OGG" },
} as const;
export type AudioExtension = keyof typeof audioFormats;
export type PublicRadioTrack = Omit<RadioTrack, "storage_path" | "uploader_user_id"> & { is_uploader: boolean; uploader_label: string };

const metadataSchema = z.object({
  title: z.string().trim().min(1, "Song title is required.").max(160),
  artist: z.string().trim().max(160).default(""),
  personal_note: z.string().trim().max(2000).default(""),
});

export function radioMetadataFromForm(formData: FormData) {
  return metadataSchema.safeParse({
    title: formData.get("title"),
    artist: formData.get("artist") ?? "",
    personal_note: formData.get("personal_note") ?? "",
  });
}

export function audioExtension(filename: string): AudioExtension | null {
  const value = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return value && value in audioFormats ? value as AudioExtension : null;
}

export function sanitizeAudioFilename(filename: string) {
  const basename = filename.replaceAll("\\", "/").split("/").pop() ?? "audio";
  return basename.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\s+/g, " ").slice(0, 255) || "audio";
}

export async function validateAudioFile(file: File) {
  if (file.size === 0) return { ok: false as const, error: "Choose a non-empty audio file." };
  if (file.size > MAX_AUDIO_SIZE) return { ok: false as const, error: "Songs must be 50 MB or smaller." };
  const extension = audioExtension(file.name);
  if (!extension) return { ok: false as const, error: "Use an MP3, M4A, AAC, WAV, or OGG file." };
  const format = audioFormats[extension];
  if (!(format.mimes as readonly string[]).includes(file.type)) return { ok: false as const, error: "The file extension and type do not match." };
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const text = new TextDecoder("latin1").decode(bytes);
  const valid = extension === "mp3" ? (text.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
    : extension === "wav" ? text.startsWith("RIFF") && text.slice(8, 12) === "WAVE"
      : extension === "ogg" ? text.startsWith("OggS")
        : extension === "m4a" ? text.slice(4, 8) === "ftyp"
          : extension === "aac" ? (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0)
            : false;
  return valid
    ? { ok: true as const, extension, mime: file.type, originalFilename: sanitizeAudioFilename(file.name) }
    : { ok: false as const, error: `This does not appear to be a valid ${format.label} file.` };
}

export function toPublicTrack(track: RadioTrack, userId: string, uploaderLabel = "Another approved member"): PublicRadioTrack {
  const { storage_path: _path, uploader_user_id: _owner, ...safe } = track;
  void _path; void _owner;
  return { ...safe, is_uploader: track.uploader_user_id === userId, uploader_label: track.uploader_user_id === userId ? "Added by you" : `Added by ${uploaderLabel}` };
}
