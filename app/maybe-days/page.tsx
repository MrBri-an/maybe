import { redirect } from "next/navigation";
import { after } from "next/server";
import { MaybeDaysExperience } from "@/features/maybe-days/maybe-days-experience";
import { authorizeMaybeDays, recordMaybeDaysLocation } from "@/lib/maybe-days/server";

export default async function MaybeDaysPage() {
  const authorized = await authorizeMaybeDays();
  if (!authorized) redirect("/?view=world");
  after(() => recordMaybeDaysLocation(authorized));
  return <MaybeDaysExperience maybeDaysCompleted={Boolean(authorized.progress.maybe_days_completed_at)} />;
}
