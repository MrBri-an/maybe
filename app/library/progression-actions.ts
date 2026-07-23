"use server";

import { persistLibraryCompletion, saveSafeLocation } from "@/lib/progression/user-progress";

export async function completeLibraryJourney() {
  const completed = await persistLibraryCompletion();
  return completed.ok
    ? { ok: true }
    : { ok: false, error: "The next step could not be saved. Please try again." };
}

export async function recordLibraryLocation() {
  return saveSafeLocation("library");
}
