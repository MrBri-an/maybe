import { redirect } from "next/navigation";
import { after } from "next/server";
import { HerUniverseExperience } from "@/features/her-universe/her-universe-experience";
import { authorizeHerUniverse, loadHerUniverseObjects, recordHerUniverseLocation } from "@/lib/her-universe/server";

export default async function HerUniversePage() {
  const authorized = await authorizeHerUniverse();
  if (!authorized) redirect("/?view=world");
  const objects = await loadHerUniverseObjects(authorized);
  after(() => recordHerUniverseLocation(authorized));
  return <HerUniverseExperience objects={objects} herUniverseCompleted={Boolean(authorized.progress.her_universe_completed_at)} />;
}
