import { z } from "zod";

const publicConfigSchema = z.object({
  url: z.url().startsWith("https://"),
  anonKey: z.string().min(1),
});

export type PublicSupabaseConfig = z.infer<typeof publicConfigSchema>;

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const result = publicConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return result.success ? result.data : null;
}
