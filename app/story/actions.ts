"use server";

import { persistStorybookCompletion, saveSafeLocation, saveUserStorybookPage } from "@/lib/progression/user-progress";

export async function completeStorybook() {
  return persistStorybookCompletion();
}

export async function saveStorybookPage(page: number, expectedUpdatedAt: string | null) {
  return saveUserStorybookPage(page, expectedUpdatedAt);
}

export async function recordStorybookLocation() {
  return saveSafeLocation("storybook");
}
