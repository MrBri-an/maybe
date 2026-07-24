import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeGallery } from "@/lib/gallery/server";
import { GALLERY_BUCKET } from "@/lib/gallery/media";

const idSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorized = await authorizeGallery();
  if (!authorized) return NextResponse.json({ error: "This memory is unavailable." }, { status: 404 });
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return NextResponse.json({ error: "This memory is unavailable." }, { status: 404 });
  const { data: media } = await authorized.admin.from("gallery_media")
    .select("storage_path")
    .eq("id", parsed.data)
    .is("archived_at", null)
    .maybeSingle();
  if (!media) return NextResponse.json({ error: "This memory is unavailable." }, { status: 404 });
  const { data, error } = await authorized.admin.storage.from(GALLERY_BUCKET).createSignedUrl(media.storage_path, 120);
  if (error || !data) return NextResponse.json({ error: "This memory could not be prepared." }, { status: 503 });
  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
