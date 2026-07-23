import { z } from "zod";
import type { LibraryBook } from "@/lib/supabase/database.types";

export const LIBRARY_BUCKET = "library-books";
export const MAX_BOOK_SIZE = 25 * 1024 * 1024;

export const bookFormats = {
  pdf: { mime: "application/pdf", label: "PDF" },
  epub: { mime: "application/epub+zip", label: "EPUB" },
  txt: { mime: "text/plain", label: "Plain text" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word document" },
} as const;

export type BookExtension = keyof typeof bookFormats;
export type PublicLibraryBook = Omit<LibraryBook, "storage_path" | "uploader_user_id"> & { is_uploader: boolean };

export const bookMetadataSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160),
  author: z.string().trim().min(1, "Author is required.").max(160),
  description: z.string().trim().max(2000).default(""),
  personal_note: z.string().trim().max(2000).default(""),
  shelf: z.enum(["jessicas_shelf", "read_together"]),
  reading_status: z.enum(["not_started", "reading", "completed"]).default("not_started"),
  allow_download: z.boolean().default(false),
});

export function metadataFromForm(formData: FormData) {
  return bookMetadataSchema.safeParse({
    title: formData.get("title"),
    author: formData.get("author"),
    description: formData.get("description") ?? "",
    personal_note: formData.get("personal_note") ?? "",
    shelf: formData.get("shelf"),
    reading_status: formData.get("reading_status") ?? "not_started",
    allow_download: formData.get("allow_download") === "on",
  });
}

export function getFileExtension(filename: string): BookExtension | null {
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return extension && extension in bookFormats ? extension as BookExtension : null;
}

export function sanitizeFilename(filename: string) {
  const basename = filename.replaceAll("\\", "/").split("/").pop() ?? "book";
  return basename.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\s+/g, " ").slice(0, 255) || "book";
}

export async function validateBookFile(file: File) {
  if (file.size === 0) return { ok: false as const, error: "Choose a non-empty book file." };
  if (file.size > MAX_BOOK_SIZE) return { ok: false as const, error: "Books must be 25 MB or smaller." };
  const extension = getFileExtension(file.name);
  if (!extension) return { ok: false as const, error: "Use a PDF, EPUB, TXT, or DOCX file." };
  const format = bookFormats[extension];
  if (file.type !== format.mime) return { ok: false as const, error: "The file extension and type do not match." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const startsWith = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const decodedProbe = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
  let valid = false;

  if (extension === "pdf") valid = startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (extension === "epub") valid = startsWith(0x50, 0x4b, 0x03, 0x04) && decodedProbe.includes("mimetypeapplication/epub+zip");
  if (extension === "docx") {
    const archiveProbe = new TextDecoder("latin1").decode(bytes);
    valid = startsWith(0x50, 0x4b, 0x03, 0x04) && archiveProbe.includes("[Content_Types].xml") && archiveProbe.includes("word/");
  }
  if (extension === "txt") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      valid = !bytes.includes(0);
    } catch {
      valid = false;
    }
  }

  return valid
    ? { ok: true as const, extension, mime: format.mime, originalFilename: sanitizeFilename(file.name) }
    : { ok: false as const, error: `This does not appear to be a valid ${format.label} file.` };
}

export function toPublicBook(book: LibraryBook, userId: string): PublicLibraryBook {
  const { storage_path: _privatePath, uploader_user_id: _privateOwner, ...safeBook } = book;
  void _privatePath;
  void _privateOwner;
  return { ...safeBook, is_uploader: book.uploader_user_id === userId };
}
