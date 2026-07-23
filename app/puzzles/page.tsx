import { redirect } from "next/navigation";
import { PuzzleRoom } from "@/features/puzzles/puzzle-room";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadQuizAttempt, loadUserJourneyProgress } from "@/lib/progression/user-progress";

export default async function PuzzlesPage() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) redirect("/?view=world");
  const journey = await loadUserJourneyProgress();
  if (!journey?.progress.storybook_completed_at || !journey.progress.library_completed_at) redirect("/?view=world");

  const [millionaire, kculture] = await Promise.all([loadQuizAttempt("millionaire"), loadQuizAttempt("kculture")]);
  return <PuzzleRoom initialProgress={journey.progress} initialAttempts={{ millionaire: millionaire.ok ? millionaire.attempt : null, kculture: kculture.ok ? kculture.attempt : null }} />;
}
