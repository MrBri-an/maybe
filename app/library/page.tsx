import { redirect } from "next/navigation";
import { LibraryExperience } from "@/features/library/library-experience";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { toPublicBook } from "@/lib/library/books";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function LibraryPage() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) redirect("/");
  const journey = await loadUserJourneyProgress();
  if (!journey?.progress.storybook_completed_at) redirect("/?view=world");
  const admin = createAdminSupabaseClient();
  if (!admin) redirect("/");

  const { data } = await admin.from("library_books").select("*").order("created_at", { ascending: false });
  const books = (data ?? []).map((book) => toPublicBook(book, access.user.id));

  return <LibraryExperience initialBooks={books} initialStorybookPage={journey.progress.storybook_page} libraryCompleted={Boolean(journey.progress.library_completed_at)} />;
}
