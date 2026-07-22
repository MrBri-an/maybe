import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

const GATE_COOKIE = "maybe_experience_gate";
const ATTEMPT_COOKIE = "maybe_puzzle_attempts";
const GATE_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const ATTEMPT_WINDOW_SECONDS = 60 * 10;
const MAX_ATTEMPTS = 5;

const signedPayloadSchema = z.object({
  userId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
  count: z.number().int().min(0).optional(),
});

type SignedPayload = z.infer<typeof signedPayloadSchema>;

function getSigningKey(): string | null {
  const config = getServerSupabaseConfig();
  return config ? `the-beginning-of-maybe:experience-gate:${config.serviceRoleKey}` : null;
}

function signPayload(payload: SignedPayload): string | null {
  const key = getSigningKey();

  if (!key) {
    return null;
  }

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", key).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readPayload(value: string | undefined): SignedPayload | null {
  const key = getSigningKey();

  if (!value || !key) {
    return null;
  }

  const [encoded, receivedSignature, extra] = value.split(".");

  if (!encoded || !receivedSignature || extra) {
    return null;
  }

  const expectedSignature = createHmac("sha256", key).update(encoded).digest();
  let received: Buffer;

  try {
    received = Buffer.from(receivedSignature, "base64url");
  } catch {
    return null;
  }

  if (received.length !== expectedSignature.length || !timingSafeEqual(received, expectedSignature)) {
    return null;
  }

  try {
    const parsed = signedPayloadSchema.safeParse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function hasPassedExperienceGate(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const payload = readPayload(cookieStore.get(GATE_COOKIE)?.value);

  return Boolean(payload && payload.userId === userId && payload.expiresAt > Date.now());
}

export async function markExperienceGatePassed(userId: string): Promise<boolean> {
  const value = signPayload({
    userId,
    expiresAt: Date.now() + GATE_LIFETIME_SECONDS * 1000,
  });

  if (!value) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(GATE_COOKIE, value, cookieOptions(GATE_LIFETIME_SECONDS));
  cookieStore.delete(ATTEMPT_COOKIE);
  return true;
}

export async function getPuzzleAttemptState(userId: string) {
  const cookieStore = await cookies();
  const payload = readPayload(cookieStore.get(ATTEMPT_COOKIE)?.value);

  if (!payload || payload.userId !== userId || payload.expiresAt <= Date.now()) {
    return { limited: false, count: 0 };
  }

  return { limited: (payload.count ?? 0) >= MAX_ATTEMPTS, count: payload.count ?? 0 };
}

export async function recordPuzzleFailure(userId: string, currentCount: number) {
  const count = currentCount + 1;
  const value = signPayload({
    userId,
    count,
    expiresAt: Date.now() + ATTEMPT_WINDOW_SECONDS * 1000,
  });

  if (!value) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(ATTEMPT_COOKIE, value, cookieOptions(ATTEMPT_WINDOW_SECONDS));
}

export async function clearExperienceCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(GATE_COOKIE);
  cookieStore.delete(ATTEMPT_COOKIE);
}
