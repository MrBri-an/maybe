"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { LIBRARY_BUCKET, metadataFromForm, toPublicBook, validateBookFile } from "@/lib/library/books";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PublicLibraryBook } from "@/lib/library/books";

export type LibraryActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  book?: PublicLibraryBook;
  partial?: boolean;
};

const recentUploads = new Map<string, number>();

async function authorizeLibraryAction() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) return null;
  const journey = await loadUserJourneyProgress();
  if (!journey?.progress.storybook_completed_at) return null;
  const admin = createAdminSupabaseClient();
  return admin ? { access, admin } : null;
}

export async function uploadLibraryBook(formData: FormData): Promise<LibraryActionResult> {
  const authorized = await authorizeLibraryAction();
  if (!authorized) return { ok: false, error: "You are not authorized to use the private Library." };

  const metadata = metadataFromForm(formData);
  if (!metadata.success) return { ok: false, error: metadata.error.issues[0]?.message ?? "Check the book details." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a book file." };
  const validatedFile = await validateBookFile(file);
  if (!validatedFile.ok) return { ok: false, error: validatedFile.error };

  const now = Date.now();
  const previousUpload = recentUploads.get(authorized.access.user.id) ?? 0;
  if (now - previousUpload < 3000) return { ok: false, error: "Please wait a moment before uploading another book." };
  recentUploads.set(authorized.access.user.id, now);

  const storagePath = `${authorized.access.user.id}/${randomUUID()}.${validatedFile.extension}`;
  const { error: uploadError } = await authorized.admin.storage
    .from(LIBRARY_BUCKET)
    .upload(storagePath, file, { contentType: validatedFile.mime, upsert: false, cacheControl: "private, max-age=0" });

  if (uploadError) {
    console.error("Library upload failed during private Storage write.");
    return { ok: false, error: "The private file could not be uploaded. Please try again." };
  }

  const { data: book, error: metadataError } = await authorized.admin
    .from("library_books")
    .insert({
      uploader_user_id: authorized.access.user.id,
      ...metadata.data,
      original_filename: validatedFile.originalFilename,
      storage_path: storagePath,
      mime_type: validatedFile.mime,
      file_extension: validatedFile.extension,
      size_bytes: file.size,
    })
    .select("*")
    .single();

  if (metadataError || !book) {
    console.error("Library upload failed during metadata creation; cleanup requested.");
    await authorized.admin.storage.from(LIBRARY_BUCKET).remove([storagePath]);
    return { ok: false, error: "The book details could not be saved. The uploaded file was cleaned up." };
  }

  revalidatePath("/library");
  return { ok: true, message: "The book is now in the private Library.", book: toPublicBook(book, authorized.access.user.id) };
}

export async function updateLibraryBook(formData: FormData): Promise<LibraryActionResult> {
  const authorized = await authorizeLibraryAction();
  if (!authorized) return { ok: false, error: "You are not authorized to use the private Library." };
  const id = formData.get("id");
  if (typeof id !== "string") return { ok: false, error: "The book could not be updated." };
  const metadata = metadataFromForm(formData);
  if (!metadata.success) return { ok: false, error: metadata.error.issues[0]?.message ?? "Check the book details." };

  const { data: book, error } = await authorized.admin
    .from("library_books")
    .update(metadata.data)
    .eq("id", id)
    .eq("uploader_user_id", authorized.access.user.id)
    .select("*")
    .maybeSingle();

  if (error || !book) {
    console.error("Library metadata update failed or was not authorized.");
    return { ok: false, error: "The book could not be updated." };
  }
  revalidatePath("/library");
  return { ok: true, message: "Book details updated.", book: toPublicBook(book, authorized.access.user.id) };
}

export async function deleteLibraryBook(id: string): Promise<LibraryActionResult> {
  const authorized = await authorizeLibraryAction();
  if (!authorized) return { ok: false, error: "You are not authorized to use the private Library." };

  const { data: book } = await authorized.admin
    .from("library_books")
    .select("*")
    .eq("id", id)
    .eq("uploader_user_id", authorized.access.user.id)
    .maybeSingle();

  if (!book) return { ok: false, error: "The book could not be deleted." };
  const { error: storageError } = await authorized.admin.storage.from(LIBRARY_BUCKET).remove([book.storage_path]);
  if (storageError) {
    console.error("Library deletion stopped because private Storage removal failed.");
    return { ok: false, error: "The private file could not be removed, so its Library record was kept." };
  }

  const { error: metadataError } = await authorized.admin
    .from("library_books")
    .delete()
    .eq("id", book.id)
    .eq("uploader_user_id", authorized.access.user.id);

  if (metadataError) {
    console.error("Library deletion partially failed after private Storage removal.");
    return { ok: false, partial: true, error: "The file was removed, but its Library record could not be removed. Please contact the Library owner." };
  }

  revalidatePath("/library");
  return { ok: true, message: "The book was removed from the private Library." };
}
