import { NextRequest, NextResponse } from "next/server";
import { deriveResumeDestination, loadUserJourneyProgress, reconcileCompletionCookies } from "@/lib/progression/user-progress";

const POST_AUTH_INTRO_COOKIE = "maybe_post_auth_intro";

export async function GET(request: NextRequest) {
  const loaded = await loadUserJourneyProgress();
  if (!loaded) return NextResponse.redirect(new URL("/", request.url));
  await reconcileCompletionCookies(loaded.progress);
  if (request.cookies.get(POST_AUTH_INTRO_COOKIE)?.value === "1") {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(POST_AUTH_INTRO_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }
  return NextResponse.redirect(new URL(deriveResumeDestination(loaded.progress, loaded.created), request.url));
}
