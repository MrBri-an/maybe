import { redirect } from "next/navigation";
import { Storybook } from "@/features/story/storybook";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";

export default async function StoryPage() {
  const access = await getAuthenticatedAccess();

  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) {
    redirect("/");
  }

  const journey = await loadUserJourneyProgress();
  return <Storybook initialCompleted={Boolean(journey?.progress.storybook_completed_at)} initialPage={journey?.progress.storybook_page ?? 1} initialPageUpdatedAt={journey?.progress.storybook_page_updated_at ?? null} />;
}
