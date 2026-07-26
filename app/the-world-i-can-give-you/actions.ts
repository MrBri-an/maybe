"use server";

import { z } from "zod";
import { authorizeFinalWorld } from "@/lib/final-world/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { persistFinalWorldCompletion } from "@/lib/progression/user-progress";

const draftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(12000),
});

export type FinalLetterView =
  | { audience: "author"; status: "none" }
  | {
      audience: "author";
      status: "draft" | "sealed" | "opened";
      title: string;
      body: string;
      sealedAt: string | null;
      openedAt: string | null;
    }
  | { audience: "recipient"; status: "waiting" | "sealed" | "opened"; sealedAt: string | null };

type LetterActionResult =
  | { ok: true; letter: FinalLetterView }
  | { ok: false; error: string };

export type OpenedFinalLetter = {
  status: "opened";
  title: string;
  body: string;
  sealedAt: string;
  openedAt: string;
};

type OpenLetterResult =
  | { ok: true; letter: OpenedFinalLetter }
  | { ok: false; error: string };

async function loadFinalLetterViewFromContext(
  context: NonNullable<Awaited<ReturnType<typeof authorizeFinalWorld>>>,
): Promise<FinalLetterView> {
  const isAuthor = context.access.member.role === "owner";
  if (isAuthor) {
    const { data, error } = await context.admin.from("final_world_letter")
      .select("title,body,status,sealed_at,opened_at")
      .neq("status", "withdrawn").limit(1).maybeSingle();
    if (error) {
      console.error("Final letter operation failed", { operation: "load_author_view", code: error.code });
      return { audience: "author", status: "none" };
    }
    if (!data) return { audience: "author", status: "none" };
    return {
      audience: "author",
      status: data.status as "draft" | "sealed" | "opened",
      title: data.title,
      body: data.body,
      sealedAt: data.sealed_at,
      openedAt: data.opened_at,
    };
  }
  const { data, error } = await context.admin.from("final_world_letter")
    .select("status,sealed_at").neq("status", "withdrawn").limit(1).maybeSingle();
  if (error) {
    console.error("Final letter operation failed", { operation: "load_recipient_view", code: error.code });
    return { audience: "recipient", status: "waiting", sealedAt: null };
  }
  if (!data || data.status === "draft") return { audience: "recipient", status: "waiting", sealedAt: null };
  return {
    audience: "recipient",
    status: data.status === "opened" ? "opened" : "sealed",
    sealedAt: data.sealed_at,
  };
}

export async function loadFinalLetterView(): Promise<FinalLetterView | null> {
  const context = await authorizeFinalWorld();
  return context ? loadFinalLetterViewFromContext(context) : null;
}

async function getAuthorizedRpc(role: "owner" | "guest") {
  const authorized = await authorizeFinalWorld();
  if (!authorized || authorized.access.member.role !== role) return null;
  const supabase = await createServerSupabaseClient();
  return supabase ? { authorized, supabase } : null;
}

export async function saveFinalLetterDraft(input: unknown): Promise<LetterActionResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a title and letter of no more than 12,000 characters." };
  const context = await getAuthorizedRpc("owner");
  if (!context) return { ok: false, error: "This private writing desk is available only to its author." };
  const { error } = await context.supabase.rpc("save_final_world_letter_draft", {
    p_title: parsed.data.title,
    p_body: parsed.data.body,
  });
  if (error) {
    console.error("Final letter operation failed", { operation: "save_draft", code: error.code });
    return { ok: false, error: "Your draft could not be saved. Your words are still here." };
  }
  const letter = await loadFinalLetterViewFromContext(context.authorized);
  return letter ? { ok: true, letter } : { ok: false, error: "Your draft was saved, but its status could not be refreshed." };
}

export async function sealFinalLetter(input: unknown): Promise<LetterActionResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a complete title and letter before sealing it." };
  const context = await getAuthorizedRpc("owner");
  if (!context) return { ok: false, error: "This private writing desk is available only to its author." };
  const { data: current } = await context.authorized.admin.from("final_world_letter")
    .select("id,status,title,body").neq("status", "withdrawn").limit(1).maybeSingle();
  if (!current) {
    return { ok: false, error: "Save a complete title and letter before sealing it." };
  }
  if (current.status === "draft") {
    const { error: saveError } = await context.supabase.rpc("save_final_world_letter_draft", {
      p_title: parsed.data.title,
      p_body: parsed.data.body,
    });
    if (saveError) {
      console.error("Final letter operation failed", { operation: "save_before_seal", code: saveError.code });
      return { ok: false, error: "The latest words could not be saved, so the letter was not sealed." };
    }
    const { error } = await context.supabase.rpc("seal_final_world_letter", { p_letter_id: current.id });
    if (error) {
      console.error("Final letter operation failed", { operation: "seal", code: error.code });
      return { ok: false, error: "The letter could not be sealed. Please try again." };
    }
  } else if (current.status !== "sealed" && current.status !== "opened") {
    return { ok: false, error: "This letter is no longer available to seal." };
  }
  const letter = await loadFinalLetterViewFromContext(context.authorized);
  return letter ? { ok: true, letter } : { ok: false, error: "The letter was sealed, but its status could not be refreshed." };
}

export async function withdrawFinalLetter(): Promise<LetterActionResult> {
  const context = await getAuthorizedRpc("owner");
  if (!context) return { ok: false, error: "This private writing desk is available only to its author." };
  const { data: current } = await context.authorized.admin.from("final_world_letter")
    .select("id,status").neq("status", "withdrawn").limit(1).maybeSingle();
  if (!current) return { ok: true, letter: { audience: "author", status: "none" } };
  if (current.status === "opened") return { ok: false, error: "An opened letter remains part of the journey." };
  if (current.status !== "sealed" && current.status !== "draft") {
    return { ok: false, error: "This letter cannot be withdrawn." };
  }
  const { error } = await context.supabase.rpc("withdraw_final_world_letter", { p_letter_id: current.id });
  if (error) {
    console.error("Final letter operation failed", { operation: "withdraw", code: error.code });
    return { ok: false, error: "The letter could not be withdrawn. Please try again." };
  }
  return { ok: true, letter: { audience: "author", status: "none" } };
}

export async function openFinalLetter(): Promise<OpenLetterResult> {
  const context = await getAuthorizedRpc("guest");
  if (!context) return { ok: false, error: "This letter can be opened only by its intended recipient." };
  const { data: current, error: lookupError } = await context.authorized.admin.from("final_world_letter")
    .select("id,status,recipient_user_id")
    .neq("status", "withdrawn")
    .limit(1)
    .maybeSingle();
  if (lookupError || !current
    || current.recipient_user_id !== context.authorized.access.user.id
    || (current.status !== "sealed" && current.status !== "opened")) {
    return { ok: false, error: "The sealed letter is not available right now." };
  }
  const { data, error } = await context.supabase.rpc("open_final_world_letter", {
    p_letter_id: current.id,
  });
  if (error || !data || data.status !== "opened" || !data.opened_at || !data.sealed_at) {
    if (error) console.error("Final letter operation failed", { operation: "open", code: error.code });
    return { ok: false, error: "The letter could not be opened. Please try again." };
  }
  return {
    ok: true,
    letter: {
      status: "opened",
      title: data.title,
      body: data.body,
      sealedAt: data.sealed_at,
      openedAt: data.opened_at,
    },
  };
}

export async function completeFinalWorldJourney() {
  const authorized = await authorizeFinalWorld();
  if (!authorized) return { ok: false as const, error: "Please sign in with an approved account to complete this journey." };
  const result = await persistFinalWorldCompletion();
  if (result.ok) return result;
  return {
    ...result,
    error: result.reason === "unauthorized"
      ? "Please sign in with an approved account to complete this journey."
      : result.reason === "missing_prerequisite"
        ? "Complete the earlier journey rooms before finishing this journey."
        : "The final step could not be saved. Please try again.",
  };
}
