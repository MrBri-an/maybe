import { redirect } from "next/navigation";
import { Storybook } from "@/features/story/storybook";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";

export default async function StoryPage() {
  const access = await getAuthenticatedAccess();

  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) {
    redirect("/");
  }

  return <Storybook />;
}
