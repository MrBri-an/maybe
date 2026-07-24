import { redirect } from "next/navigation";
import { after } from "next/server";
import { GalleryExperience } from "@/features/gallery/gallery-experience";
import { authorizeGallery, loadGalleryMedia, recordGalleryVisit } from "@/lib/gallery/server";

export default async function GalleryPage() {
  const authorized = await authorizeGallery();
  if (!authorized) redirect("/?view=world");
  const page = await loadGalleryMedia(authorized);
  after(() => recordGalleryVisit(authorized));
  return <GalleryExperience initialMedia={page.media} initialCursor={page.nextCursor} initialHasMore={page.hasMore} galleryCompleted={Boolean(authorized.progress.gallery_completed_at)} />;
}
