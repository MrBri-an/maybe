import "server-only";

import { z } from "zod";
import { getPublicSupabaseConfig } from "./public-config";

const privateConfigSchema = z.object({
  serviceRoleKey: z.string().min(1),
  appBaseUrl: z.url(),
});

export type ServerSupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  appBaseUrl: string;
};

export function getServerSupabaseConfig(): ServerSupabaseConfig | null {
  const publicConfig = getPublicSupabaseConfig();
  const privateResult = privateConfigSchema.safeParse({
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    appBaseUrl: process.env.APP_BASE_URL,
  });

  if (!publicConfig || !privateResult.success) {
    return null;
  }

  return { ...publicConfig, ...privateResult.data };
}
