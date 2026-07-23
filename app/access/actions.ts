"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clearExperienceCookies, getPuzzleAttemptState, markExperienceGatePassed, recordPuzzleFailure } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { clearRoomProgress } from "@/lib/auth/room-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const clueSchema = z.string().trim().max(40);

function normalizeAnswer(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function requestMagicLink(formData: FormData) {
  const config = getServerSupabaseConfig();
  const emailResult = emailSchema.safeParse(formData.get("email"));

  if (!config) {
    redirect("/?error=configuration");
  }

  if (!emailResult.success) {
    redirect("/?error=email");
  }

  const admin = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();

  if (!admin || !supabase) {
    redirect("/?error=configuration");
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
  redirect("/?sent=1");
}

export async function submitPuzzle(formData: FormData) {
  const access = await getAuthenticatedAccess();

  if (!access.ok) {
    redirect(access.reason === "configuration" ? "/?error=configuration" : "/?error=denied");
  }

  const attempts = await getPuzzleAttemptState(access.user.id);

  if (attempts.limited) {
    redirect("/?error=wait");
  }

  const result = clueSchema.safeParse(formData.get("answer"));
  const correct = result.success && normalizeAnswer(result.data) === "snapchat";

  if (!correct) {
    await recordPuzzleFailure(access.user.id, attempts.count);
    redirect("/?error=clue");
  }

  const gateSet = await markExperienceGatePassed(access.user.id);

  if (!gateSet) {
    redirect("/?error=configuration");
  }

  redirect("/auth/resume");
}

export async function logout() {
  const supabase = await createServerSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  await clearExperienceCookies();
  await clearRoomProgress();
  redirect("/");
}
