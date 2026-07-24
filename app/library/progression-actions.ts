"use server";

import { persistLibraryCompletion, saveSafeLocation } from "@/lib/progression/user-progress";

export async function completeLibraryJourney() {
  const completed = await persistLibraryCompletion();
  if (completed.ok) return completed;
  return {
    ...completed,
    error: completed.reason === "unauthorized"
      ? "Please sign in with an approved account to continue."
      : completed.reason === "missing_prerequisite"
        ? "Complete the Storybook before continuing."
        : "The next step could not be saved. Please try again.",
  };
}

export async function recordLibraryLocation() {
  return saveSafeLocation("library");
}
