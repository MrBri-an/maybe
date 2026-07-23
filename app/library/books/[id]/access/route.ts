import { NextRequest, NextResponse } from "next/server";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { LIBRARY_BUCKET } from "@/lib/library/books";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const journey = await loadUserJourneyProgress();
  if (!journey?.progress.storybook_completed_at) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Library access is unavailable." }, { status: 503 });

  const { id } = await params;
  const mode = request.nextUrl.searchParams.get("mode") === "download" ? "download" : "open";
  const { data: book } = await admin.from("library_books").select("*").eq("id", id).maybeSingle();
  if (!book) return NextResponse.json({ error: "The book is unavailable." }, { status: 404 });

  const isUploader = book.uploader_user_id === access.user.id;
  const previewable = book.file_extension === "pdf" || book.file_extension === "txt";
  if ((mode === "open" && !previewable) || (mode === "download" && !isUploader && !book.allow_download)) {
    return NextResponse.json({ error: "The book is unavailable." }, { status: 403 });
  }

  const options = mode === "download" ? { download: book.original_filename } : undefined;
  const { data, error } = await admin.storage.from(LIBRARY_BUCKET).createSignedUrl(book.storage_path, 60, options);
  if (error || !data) return NextResponse.json({ error: "Temporary access could not be prepared." }, { status: 503 });
  return NextResponse.redirect(data.signedUrl);
}
