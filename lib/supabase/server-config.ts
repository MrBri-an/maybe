import "server-only";

const requiredServerVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_BASE_URL",
] as const;

type RequiredServerVariable = (typeof requiredServerVariables)[number];

type ServerSupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  appBaseUrl: string;
};

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function values(): Record<RequiredServerVariable, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    APP_BASE_URL: clean(process.env.APP_BASE_URL),
  };
}

export function getMissingServerConfigVariables(): RequiredServerVariable[] {
  const configured = values();
  return requiredServerVariables.filter((name) => !configured[name]);
}

export function getServerSupabaseConfig(): ServerSupabaseConfig | null {
  const configured = values();

  if (requiredServerVariables.some((name) => !configured[name])) return null;

  try {
    new URL(configured.NEXT_PUBLIC_SUPABASE_URL);
    new URL(configured.APP_BASE_URL);
  } catch {
    return null;
  }

  return {
    url: configured.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: configured.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: configured.SUPABASE_SERVICE_ROLE_KEY,
    appBaseUrl: configured.APP_BASE_URL,
  };
}
