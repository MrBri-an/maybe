import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

export type ProgressRoom = "storybook" | "library";

const ROOM_COOKIES: Record<ProgressRoom, string> = {
  storybook: "storybook_completed",
  library: "library_completed",
};
const LIFETIME_SECONDS = 60 * 60 * 24 * 365;
const payloadSchema = z.object({
  userId: z.string().uuid(),
  room: z.enum(["storybook", "library"]),
  completedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

function signingKey(room: ProgressRoom) {
  const config = getServerSupabaseConfig();
  return config ? `the-beginning-of-maybe:room-progress:${room}:${config.serviceRoleKey}` : null;
}

export async function hasCompletedRoom(userId: string, room: ProgressRoom) {
  const key = signingKey(room);
  const value = (await cookies()).get(ROOM_COOKIES[room])?.value;
  if (!key || !value) return false;
  const [encoded, received, extra] = value.split(".");
  if (!encoded || !received || extra) return false;
  const expected = createHmac("sha256", key).update(encoded).digest();
  const receivedBuffer = Buffer.from(received, "base64url");
  if (receivedBuffer.length !== expected.length || !timingSafeEqual(receivedBuffer, expected)) return false;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    return Boolean(parsed.success && parsed.data.userId === userId && parsed.data.room === room && parsed.data.expiresAt > Date.now());
  } catch {
    return false;
  }
}

export async function markRoomCompleted(userId: string, room: ProgressRoom) {
  if (await hasCompletedRoom(userId, room)) return true;
  const key = signingKey(room);
  if (!key) return false;
  const payload = Buffer.from(JSON.stringify({
    userId,
    room,
    completedAt: Date.now(),
    expiresAt: Date.now() + LIFETIME_SECONDS * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", key).update(payload).digest("base64url");
  (await cookies()).set(ROOM_COOKIES[room], `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LIFETIME_SECONDS,
  });
  return true;
}

export async function clearRoomProgress() {
  const cookieStore = await cookies();
  Object.values(ROOM_COOKIES).forEach((name) => cookieStore.delete(name));
}

export async function clearCompletedRoom(room: ProgressRoom) {
  (await cookies()).delete(ROOM_COOKIES[room]);
}
