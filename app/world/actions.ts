"use server";

import { saveSafeLocation, saveWorldDestination } from "@/lib/progression/user-progress";

export async function recordWorldLocation() {
  return saveSafeLocation("world");
}

export async function recordWorldDestination(destination: string) {
  return saveWorldDestination(destination);
}
