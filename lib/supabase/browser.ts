"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getPublicSupabaseConfig } from "./public-config";

let browserClient: SupabaseClient<Database> | undefined;

export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  const config = getPublicSupabaseConfig();

  if (!config) {
    throw new Error("Supabase browser configuration is unavailable.");
  }

  browserClient ??= createBrowserClient<Database>(config.url, config.anonKey);
  return browserClient;
}
