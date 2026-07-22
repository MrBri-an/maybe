import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import type { AppMember } from "@/lib/supabase/database.types";

export type AccessFailure =
  | "configuration"
  | "unauthenticated"
  | "not-approved"
  | "inactive";

export type MembershipResult =
  | { ok: true; member: AppMember }
  | { ok: false; reason: Exclude<AccessFailure, "unauthenticated"> };

export type AuthenticatedAccess =
  | { ok: true; user: User; member: AppMember }
  | { ok: false; reason: AccessFailure };

export async function verifyMembership(user: User): Promise<MembershipResult> {
  const email = user.email?.trim().toLowerCase();
  const admin = createAdminSupabaseClient();

  if (!email || !admin) {
    return { ok: false, reason: "configuration" };
  }

  const { data: member, error } = await admin
    .from("app_members")
    .select("*")
    .eq("approved_email", email)
    .maybeSingle();

  if (error || !member) {
    return { ok: false, reason: "not-approved" };
  }

  if (!member.active) {
    return { ok: false, reason: "inactive" };
  }

  if (member.user_id && member.user_id !== user.id) {
    return { ok: false, reason: "not-approved" };
  }

  if (!member.user_id) {
    const { data: linkedMember, error: linkError } = await admin
      .from("app_members")
      .update({ user_id: user.id })
      .eq("id", member.id)
      .is("user_id", null)
      .select("*")
      .maybeSingle();

    if (linkError || !linkedMember) {
      return { ok: false, reason: "not-approved" };
    }

    return { ok: true, member: linkedMember };
  }

  return { ok: true, member };
}

export async function getAuthenticatedAccess(): Promise<AuthenticatedAccess> {
  if (!getServerSupabaseConfig()) {
    return { ok: false, reason: "configuration" };
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return { ok: false, reason: "configuration" };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const membership = await verifyMembership(data.user);

  if (!membership.ok) {
    return membership;
  }

  return { ok: true, user: data.user, member: membership.member };
}
