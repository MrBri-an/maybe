"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clearExperienceCookies, getPuzzleAttemptState, markExperienceGatePassed, recordPuzzleFailure } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const clueSchema = z.object({
  beginning: z.string().trim().max(40),
  notification: z.string().trim().max(60),
  person: z.string().trim().max(40),
});

function normalizeAnswer(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function requestMagicLink(formData: FormData) {
  const config = getServerSupabaseConfig();
  const emailResult = emailSchema.safeParse(formData.get("email"));

  if (!config) {
    redirect("/access?error=configuration");
  }

  if (!emailResult.success) {
    redirect("/access?error=email");
  }

  const admin = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();

  if (!admin || !supabase) {
    redirect("/access?error=configuration");
  }

  const { data: member } = await admin
    .from("app_members")
    .select("id")
    .eq("approved_email", emailResult.data)
    .eq("active", true)
    .maybeSingle();

  if (member) {
    await supabase.auth.signInWithOtp({
      email: emailResult.data,
      options: {
        emailRedirectTo: new URL("/auth/callback", config.appBaseUrl).toString(),
        shouldCreateUser: false,
      },
    });
  }

  // The same response is used for approved and unapproved addresses.
  redirect("/access?sent=1");
}

export async function submitPuzzle(formData: FormData) {
  const access = await getAuthenticatedAccess();

  if (!access.ok) {
    redirect(access.reason === "configuration" ? "/access?error=configuration" : "/access?error=denied");
  }

  const attempts = await getPuzzleAttemptState(access.user.id);

  if (attempts.limited) {
    redirect("/access?step=puzzle&error=wait");
  }

  const result = clueSchema.safeParse({
    beginning: formData.get("beginning"),
    notification: formData.get("notification"),
    person: formData.get("person"),
  });

  const correct = result.success
    && ["snapchat", "snap chat"].includes(normalizeAnswer(result.data.beginning))
    && ["screenshot", "screenshot notification", "the screenshot", "a screenshot"].includes(normalizeAnswer(result.data.notification))
    && normalizeAnswer(result.data.person) === "jessica";

  if (!correct) {
    await recordPuzzleFailure(access.user.id, attempts.count);
    redirect("/access?step=puzzle&error=clues");
  }

  const gateSet = await markExperienceGatePassed(access.user.id);

  if (!gateSet) {
    redirect("/access?step=puzzle&error=configuration");
  }

  redirect("/world");
}

export async function logout() {
  const supabase = await createServerSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  await clearExperienceCookies();
  redirect("/access");
}
