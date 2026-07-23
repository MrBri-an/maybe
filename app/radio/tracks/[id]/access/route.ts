import { NextResponse } from "next/server";
import { authorizeSharedContent } from "@/lib/media/shared-content";
import { RADIO_BUCKET } from "@/lib/radio/tracks";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorized = await authorizeSharedContent("radio");
  if (!authorized) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const { data: track } = await authorized.admin.from("radio_tracks").select("*").eq("id", id).maybeSingle();
  if (!track) return NextResponse.json({ error: "The song is unavailable." }, { status: 404 });
  const { data, error } = await authorized.admin.storage.from(RADIO_BUCKET).createSignedUrl(track.storage_path, 120);
  if (error || !data) return NextResponse.json({ error: "Playback access could not be prepared." }, { status: 503 });
  return NextResponse.json({ url: data.signedUrl, expiresIn: 120 }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
