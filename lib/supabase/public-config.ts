type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) return null;

  try {
    new URL(url);
  } catch {
    return null;
  }

  return { url, anonKey };
}
