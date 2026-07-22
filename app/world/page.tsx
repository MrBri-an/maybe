import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { logout } from "@/app/access/actions";
import { WorldExperience } from "@/features/world/world-experience";

export const metadata: Metadata = {
  title: "Private world | The Beginning of Maybe",
};

export default async function WorldPage() {
  const access = await getAuthenticatedAccess();

  if (!access.ok) {
    redirect(access.reason === "configuration" ? "/access?error=configuration" : "/access?error=denied");
  }

  if (!(await hasPassedExperienceGate(access.user.id))) {
    redirect("/access?step=puzzle");
  }

  return <WorldExperience logoutAction={logout} />;
}
