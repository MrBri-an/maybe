import { NextRequest, NextResponse } from "next/server";
import { deriveResumeDestination, loadUserJourneyProgress, reconcileCompletionCookies } from "@/lib/progression/user-progress";

export async function GET(request: NextRequest) {
  const loaded = await loadUserJourneyProgress();
  if (!loaded) return NextResponse.redirect(new URL("/", request.url));
  await reconcileCompletionCookies(loaded.progress);
  return NextResponse.redirect(new URL(deriveResumeDestination(loaded.progress, loaded.created), request.url));
}
