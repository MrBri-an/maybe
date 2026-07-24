import { z } from "zod";
import type { GalleryMedia } from "@/lib/supabase/database.types";

export const GALLERY_BUCKET = "gallery-media";
export const MAX_GALLERY_IMAGE_SIZE = 25 * 1024 * 1024;
export const MAX_GALLERY_VIDEO_SIZE = 200 * 1024 * 1024;

export const galleryFormats = {
  jpg: { kind: "image", mimes: ["image/jpeg"], label: "JPG" },
  jpeg: { kind: "image", mimes: ["image/jpeg"], label: "JPEG" },
  png: { kind: "image", mimes: ["image/png"], label: "PNG" },
  webp: { kind: "image", mimes: ["image/webp"], label: "WebP" },
  gif: { kind: "image", mimes: ["image/gif"], label: "GIF" },
  avif: { kind: "image", mimes: ["image/avif"], label: "AVIF" },
  mp4: { kind: "video", mimes: ["video/mp4"], label: "MP4" },
  webm: { kind: "video", mimes: ["video/webm"], label: "WebM" },
  mov: { kind: "video", mimes: ["video/quicktime"], label: "MOV" },
  m4v: { kind: "video", mimes: ["video/x-m4v", "video/mp4"], label: "M4V" },
} as const;

export type GalleryExtension = keyof typeof galleryFormats;
export type GalleryMediaKind = (typeof galleryFormats)[GalleryExtension]["kind"];
export type PublicGalleryMedia = Omit<GalleryMedia, "storage_path" | "uploader_user_id"> & {
  is_uploader: boolean;
  uploader_label: string;
};
export type GalleryUploadDescriptor = {
  originalFilename: string;
  extension: GalleryExtension;
  kind: GalleryMediaKind;
  mime: string;
  size: number;
};

const metadataSchema = z.object({
  title: z.string().trim().max(160, "Titles must be 160 characters or fewer."),
  caption: z.string().trim().max(2000, "Captions must be 2,000 characters or fewer."),
});

export function galleryMetadataFromForm(formData: FormData) {
  return metadataSchema.safeParse({
    title: formData.get("title"),
    caption: formData.get("caption"),
  });
}

export function galleryExtension(filename: string): GalleryExtension | null {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension && extension in galleryFormats ? extension as GalleryExtension : null;
}

export function safeGalleryFilename(filename: string) {
  const basename = filename.replaceAll("\\", "/").split("/").pop() ?? "memory";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "memory";
}

export function matchesGallerySignature(extension: GalleryExtension, bytes: Uint8Array) {
  const ascii = new TextDecoder("latin1").decode(bytes);
  if (extension === "jpg" || extension === "jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === "png") return bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (extension === "webp") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  if (extension === "gif") return ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  if (extension === "avif") return ascii.slice(4, 12) === "ftypavif" || ascii.slice(4, 12) === "ftypavis";
  if (extension === "webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return ascii.slice(4, 8) === "ftyp";
}

export function validateGalleryDescriptor(filename: string, mime: string, size: number) {
  const extension = galleryExtension(filename);
  if (!extension) return { ok: false as const, error: "Choose a supported image or video file." };
  const format = galleryFormats[extension];
  if (!(format.mimes as readonly string[]).includes(mime)) {
    return { ok: false as const, error: "The file extension and media type do not match." };
  }
  const limit = format.kind === "image" ? MAX_GALLERY_IMAGE_SIZE : MAX_GALLERY_VIDEO_SIZE;
  if (!Number.isSafeInteger(size) || size < 1) return { ok: false as const, error: "Choose a non-empty media file." };
  if (size > limit) {
    return { ok: false as const, error: format.kind === "image" ? "Images must be 25 MB or smaller." : "Videos must be 200 MB or smaller." };
  }
  return {
    ok: true as const,
    descriptor: {
      originalFilename: safeGalleryFilename(filename),
      extension,
      kind: format.kind,
      mime,
      size,
    } satisfies GalleryUploadDescriptor,
  };
}

export async function validateGalleryFile(file: File) {
  const validated = validateGalleryDescriptor(file.name, file.type, file.size);
  if (!validated.ok) return validated;
  const { descriptor } = validated;
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (!matchesGallerySignature(descriptor.extension, bytes)) {
    return { ok: false as const, error: `This does not appear to be a valid ${galleryFormats[descriptor.extension].label} file.` };
  }
  return {
    ok: true as const,
    extension: descriptor.extension,
    kind: descriptor.kind,
    mime: descriptor.mime,
    originalFilename: descriptor.originalFilename,
  };
}

export function toPublicGalleryMedia(media: GalleryMedia, userId: string, uploaderLabel = "Added by your person"): PublicGalleryMedia {
  const { storage_path: _path, uploader_user_id: _owner, ...safe } = media;
  void _path;
  void _owner;
  return {
    ...safe,
    is_uploader: media.uploader_user_id === userId,
    uploader_label: media.uploader_user_id === userId ? "Added by you" : uploaderLabel,
  };
}
