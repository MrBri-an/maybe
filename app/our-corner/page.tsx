import { redirect } from "next/navigation";
import { after } from "next/server";
import { OurCornerExperience } from "@/features/our-corner/our-corner-experience";
import { authorizeOurCorner, recordOurCornerLocation } from "@/lib/our-corner/server";

export default async function OurCornerPage() {
  const authorized = await authorizeOurCorner();
  if (!authorized) redirect("/?view=world");
  after(() => recordOurCornerLocation(authorized));
  return <OurCornerExperience ourCornerCompleted={Boolean(authorized.progress.our_corner_completed_at)} />;
}
