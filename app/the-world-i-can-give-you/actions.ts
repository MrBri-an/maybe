"use server";

import { z } from "zod";
import { authorizeFinalWorld } from "@/lib/final-world/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FinalWorldLetter } from "@/lib/supabase/database.types";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import { persistFinalWorldCompletion } from "@/lib/progression/user-progress";

const draftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(12000),
});
const recipientEmailSchema = z.string().trim().toLowerCase().email().max(254);

type AuthorContext = NonNullable<Awaited<ReturnType<typeof authorizeFinalWorld>>>;

type SafeDatabaseError = { code?: string | null; message?: string | null; hint?: string | null };

function finalLetterDatabaseError(operation: "save" | "seal", error: SafeDatabaseError) {
  const safeReason = error.message?.includes("final_world_recipient_unavailable")
    ? "Jessica does not have an approved guest account yet. Add and link her approved membership before saving this private letter."
    : error.message?.includes("final_world_author_not_authorized")
      ? "Your approved owner session could not be verified. Sign in again before saving."
      : error.message?.includes("final_world_letter_not_editable")
        ? "The canonical letter is no longer an editable draft."
        : error.message?.includes("final_world_letter_invalid")
          ? "The title or letter body does not meet the allowed length requirements."
          : `${operation === "save" ? "Save" : "Seal"} failed${error.code ? ` (${error.code})` : ""}. Please try again.`;

  if (process.env.NODE_ENV !== "production") {
    console.error("Final letter database operation failed", {
      operation,
      code: error.code ?? null,
      message: error.message ?? null,
      hint: error.hint ?? null,
    });
  }
  return safeReason;
}

function parseFinalLetterRpcRow(value: unknown): FinalWorldLetter | null {
  const candidate = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Partial<FinalWorldLetter>;
  return typeof row.id === "string"
    && typeof row.author_user_id === "string"
    && typeof row.recipient_user_id === "string"
    && typeof row.title === "string"
    && typeof row.body === "string"
    && ["draft", "sealed", "opened", "withdrawn"].includes(row.status ?? "")
    ? row as FinalWorldLetter
    : null;
}

async function authorizeLetterAuthor(): Promise<AuthorContext | null> {
  const context = await authorizeFinalWorld();
  if (!context || context.access.member.role !== "owner") return null;

  const { data: membership, error } = await context.admin
    .from("app_members")
    .select("user_id,role,active")
    .eq("user_id", context.access.user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || membership?.role !== "owner") return null;
  return context;
}

export type FinalRecipientState = { ready: boolean };

type PrepareRecipientResult =
  | { ok: true; recipient: FinalRecipientState }
  | { ok: false; error: string; code: "invalid_email" | "conflict" | "invitation_failed" | "unauthorized" };

async function findAuthUserByEmail(context: AuthorContext, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await context.admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { user: null, error };
    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email);
    if (user) return { user, error: null };
    if (data.users.length < 1000) break;
  }
  return { user: null, error: null };
}

export async function loadFinalRecipientState(): Promise<FinalRecipientState | null> {
  const context = await authorizeLetterAuthor();
  if (!context) return null;
  const { data, error } = await context.admin.from("app_members")
    .select("user_id")
    .eq("role", "guest")
    .eq("active", true)
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) return { ready: false };
  return { ready: Boolean(data?.user_id) };
}

export async function prepareFinalLetterRecipient(input: unknown): Promise<PrepareRecipientResult> {
  const parsed = recipientEmailSchema.safeParse(
    typeof input === "object" && input !== null && "email" in input
      ? (input as { email?: unknown }).email
      : input,
  );
  if (!parsed.success) {
    return { ok: false, code: "invalid_email", error: "Enter a valid email address for Jessica." };
  }
  const context = await authorizeLetterAuthor();
  if (!context) {
    return { ok: false, code: "unauthorized", error: "Only the approved owner can prepare Jessica’s access." };
  }
  const config = getServerSupabaseConfig();
  if (!config) {
    return { ok: false, code: "invitation_failed", error: "Jessica’s access could not be prepared. Your letter is still here. Please try again." };
  }

  const { data: activeGuests, error: guestError } = await context.admin.from("app_members")
    .select("approved_email,user_id")
    .eq("role", "guest")
    .eq("active", true)
    .limit(2);
  if (guestError) {
    return { ok: false, code: "invitation_failed", error: "Jessica’s access could not be checked. Your letter is still here." };
  }
  const conflictingGuest = activeGuests?.find((guest) => guest.approved_email !== parsed.data);
  if (conflictingGuest) {
    return { ok: false, code: "conflict", error: "A different active guest is already approved. Nothing was changed." };
  }
  const preparedGuest = activeGuests?.find((guest) => guest.approved_email === parsed.data);
  if (preparedGuest?.user_id) return { ok: true, recipient: { ready: true } };

  const { data: matchingMember, error: memberError } = await context.admin.from("app_members")
    .select("id,role,active,user_id")
    .eq("approved_email", parsed.data)
    .maybeSingle();
  if (memberError || matchingMember?.role === "owner"
    || (matchingMember?.user_id && preparedGuest?.user_id && matchingMember.user_id !== preparedGuest.user_id)) {
    return { ok: false, code: "conflict", error: "That address already belongs to a different approved membership. Nothing was changed." };
  }

  const { user: existingAuthUser, error: authLookupError } = await findAuthUserByEmail(context, parsed.data);
  let authUser = existingAuthUser;
  if (authLookupError) {
    return { ok: false, code: "invitation_failed", error: "Jessica’s access could not be checked. Your letter is still here." };
  }
  if (!authUser) {
    const { data, error } = await context.admin.auth.admin.inviteUserByEmail(parsed.data, {
      redirectTo: new URL("/auth/callback", config.appBaseUrl).toString(),
    });
    if (error || !data.user) {
      const retryLookup = await findAuthUserByEmail(context, parsed.data);
      authUser = retryLookup.user;
      if (!authUser) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Final recipient invitation failed", {
            operation: "invite_final_recipient",
            code: error?.code ?? null,
            message: error?.message ?? null,
            status: error?.status ?? null,
          });
        }
        return { ok: false, code: "invitation_failed", error: "Jessica’s access could not be prepared. Your letter is still here. Please try again." };
      }
    } else {
      authUser = data.user;
    }
  }
  if (matchingMember?.user_id && matchingMember.user_id !== authUser.id) {
    return { ok: false, code: "conflict", error: "That approved membership is linked to a different account. Nothing was changed." };
  }

  const membershipWrite = matchingMember
    ? context.admin.from("app_members")
      .update({ user_id: authUser.id, role: "guest", active: true })
      .eq("id", matchingMember.id)
      .eq("role", "guest")
    : context.admin.from("app_members")
      .insert({ approved_email: parsed.data, user_id: authUser.id, role: "guest", active: true });
  const { error: writeError } = await membershipWrite;
  if (writeError) {
    const { data: idempotentGuest } = await context.admin.from("app_members")
      .select("user_id")
      .eq("approved_email", parsed.data)
      .eq("role", "guest")
      .eq("active", true)
      .maybeSingle();
    if (idempotentGuest?.user_id === authUser.id) return { ok: true, recipient: { ready: true } };
    if (process.env.NODE_ENV !== "production") {
      console.error("Final recipient membership operation failed", {
        operation: "link_final_recipient",
        code: writeError.code,
        message: writeError.message,
        hint: writeError.hint,
      });
    }
    return { ok: false, code: "conflict", error: "Jessica’s invitation exists, but her approved membership could not be linked safely. Nothing was reassigned." };
  }
  return { ok: true, recipient: { ready: true } };
}

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
  const authorized = role === "owner" ? await authorizeLetterAuthor() : await authorizeFinalWorld();
  if (!authorized || authorized.access.member.role !== role) return null;
  const supabase = await createServerSupabaseClient();
  return supabase ? { authorized, supabase } : null;
}

export async function saveFinalLetterDraft(input: unknown): Promise<LetterActionResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a title and letter of no more than 12,000 characters." };
  const context = await getAuthorizedRpc("owner");
  if (!context) return { ok: false, error: "This private writing desk is available only to its author." };
  const { data, error } = await context.supabase.rpc("save_final_world_letter_draft", {
    p_title: parsed.data.title,
    p_body: parsed.data.body,
  });
  if (error) return { ok: false, error: finalLetterDatabaseError("save", error) };
  const saved = parseFinalLetterRpcRow(data);
  if (!saved || saved.author_user_id !== context.authorized.access.user.id || saved.status !== "draft") {
    return { ok: false, error: "Save failed because the database returned an unexpected result shape." };
  }
  return {
    ok: true,
    letter: {
      audience: "author",
      status: "draft",
      title: saved.title,
      body: saved.body,
      sealedAt: saved.sealed_at,
      openedAt: saved.opened_at,
    },
  };
}

export async function sealFinalLetter(input: unknown): Promise<LetterActionResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a complete title and letter before sealing it." };
  const context = await getAuthorizedRpc("owner");
  if (!context) return { ok: false, error: "This private writing desk is available only to its author." };
  const { data: existing, error: existingError } = await context.authorized.admin.from("final_world_letter")
    .select("id,status,author_user_id").neq("status", "withdrawn").limit(1).maybeSingle();
  if (existingError) return { ok: false, error: "The letter could not be checked before sealing. Please try again." };
  if (existing && existing.author_user_id !== context.authorized.access.user.id) {
    return { ok: false, error: "This private letter belongs to its approved author." };
  }
  if (existing?.status === "sealed" || existing?.status === "opened") {
    const letter = await loadFinalLetterViewFromContext(context.authorized);
    return letter.status === "sealed" || letter.status === "opened"
      ? { ok: true, letter }
      : { ok: false, error: "The sealed letter could not be refreshed." };
  }
  if (existing && existing.status !== "draft") {
    return { ok: false, error: "This letter is no longer available to seal." };
  }

  const { data: saved, error: saveError } = await context.supabase.rpc("save_final_world_letter_draft", {
      p_title: parsed.data.title,
      p_body: parsed.data.body,
  });
  if (saveError) return { ok: false, error: finalLetterDatabaseError("save", saveError) };
  const savedRow = parseFinalLetterRpcRow(saved);
  if (!savedRow || savedRow.author_user_id !== context.authorized.access.user.id || savedRow.status !== "draft") {
    return { ok: false, error: "The latest draft returned an unexpected database result, so it was not sealed." };
  }
  const { data: sealed, error } = await context.supabase.rpc("seal_final_world_letter", { p_letter_id: savedRow.id });
  if (error) return { ok: false, error: finalLetterDatabaseError("seal", error) };
  const sealedRow = parseFinalLetterRpcRow(sealed);
  if (!sealedRow || sealedRow.author_user_id !== context.authorized.access.user.id
    || (sealedRow.status !== "sealed" && sealedRow.status !== "opened")) {
    return { ok: false, error: "The letter returned an unexpected database result after sealing." };
  }
  return {
    ok: true,
    letter: {
      audience: "author",
      status: sealedRow.status,
      title: sealedRow.title,
      body: sealedRow.body,
      sealedAt: sealedRow.sealed_at,
      openedAt: sealedRow.opened_at,
    },
  };
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
  const opened = parseFinalLetterRpcRow(data);
  if (error || !opened || opened.status !== "opened" || !opened.opened_at || !opened.sealed_at) {
    if (error) console.error("Final letter operation failed", { operation: "open", code: error.code });
    return { ok: false, error: "The letter could not be opened. Please try again." };
  }
  return {
    ok: true,
    letter: {
      status: "opened",
      title: opened.title,
      body: opened.body,
      sealedAt: opened.sealed_at,
      openedAt: opened.opened_at,
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
