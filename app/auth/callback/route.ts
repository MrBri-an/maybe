import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { verifyMembership } from "@/lib/auth/membership";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

const emailOtpTypes = new Set<EmailOtpType>([
  "email",
  "invite",
  "magiclink",
  "recovery",
  "signup",
  "email_change",
]);

function accessRedirect(request: NextRequest, params: Record<string, string>) {
  const target = new URL("/access", request.url);
  Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  if (!getServerSupabaseConfig()) {
    return accessRedirect(request, { error: "configuration" });
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return accessRedirect(request, { error: "configuration" });
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  let authenticationError = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authenticationError = Boolean(error);
  } else if (tokenHash && requestedType && emailOtpTypes.has(requestedType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: requestedType as EmailOtpType,
    });
    authenticationError = Boolean(error);
  }

  if (authenticationError) {
    return accessRedirect(request, { error: "link" });
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return accessRedirect(request, { error: "link" });
  }

  const membership = await verifyMembership(data.user);

  if (!membership.ok) {
    await supabase.auth.signOut();
    return accessRedirect(request, { error: "denied" });
  }

  return accessRedirect(request, { step: "puzzle" });
}
