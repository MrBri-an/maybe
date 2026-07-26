import { redirect } from "next/navigation";
import { after } from "next/server";
import { FinalWorldExperience } from "@/features/final-world/final-world-experience";
import { authorizeFinalWorld, recordFinalWorldLocation } from "@/lib/final-world/server";
import { loadFinalLetterView } from "@/app/the-world-i-can-give-you/actions";

export default async function FinalWorldPage() {
  const authorized = await authorizeFinalWorld();
  if (!authorized) redirect("/?view=world");
  const initialLetter = await loadFinalLetterView();
  if (!initialLetter) redirect("/?view=world");
  after(() => recordFinalWorldLocation(authorized));
  return <FinalWorldExperience initialLetter={initialLetter} finalWorldCompleted={Boolean(authorized.progress.final_world_completed_at)} />;
}
