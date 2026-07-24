import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { clearCompletedRoom, hasCompletedRoom, markRoomCompleted } from "@/lib/auth/room-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { UserJourneyProgress } from "@/lib/supabase/database.types";
import { JOURNEY_ROOM_SLUGS } from "@/lib/progression/rooms";
import { getQuestionBank, type QuizId } from "@/features/puzzles/quiz/question-banks";
import { attemptAsJson, type SavedQuizAttempt, type VerifiedQuizResult } from "@/features/puzzles/quiz/contracts";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

export type SafeLocation = "world" | "storybook" | "library" | "puzzle_room" | "radio" | "question_garden";
export type PuzzleId = "millionaire" | "kculture" | "constellation";
export type PuzzleRoomCompletionResult =
  | { ok: true; alreadyCompleted: boolean; navigationMetadataSaved: boolean }
  | { ok: false; reason: "unauthorized" | "missing_prerequisite" | "completion_write_failed" };
export type RadioCompletionResult =
  | { ok: true; alreadyCompleted: boolean; navigationMetadataSaved: boolean }
  | { ok: false; reason: "unauthorized" | "missing_prerequisite" | "completion_write_failed" };
export const worldDestinationSchema = z.enum(JOURNEY_ROOM_SLUGS);
const pageSchema = z.number().int().min(1).max(30);
const locationSchema = z.enum(["world", "storybook", "library", "puzzle_room", "radio", "question_garden"]);
const puzzleSchema = z.enum(["millionaire", "kculture", "constellation"]);

async function authorizeProgress() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) return null;
  const admin = createAdminSupabaseClient();
  return admin ? { access, admin } : null;
}

async function loadOrCreateAuthorizedProgress(authorized: NonNullable<Awaited<ReturnType<typeof authorizeProgress>>>) {
  const { data: existing } = await authorized.admin.from("user_journey_progress").select("*").eq("user_id", authorized.access.user.id).maybeSingle();
  if (existing) return { progress: existing, created: false };

  const [storybookCookie, libraryCookie] = await Promise.all([
    hasCompletedRoom(authorized.access.user.id, "storybook"),
    hasCompletedRoom(authorized.access.user.id, "library"),
  ]);
  const now = new Date().toISOString();
  await authorized.admin.from("user_journey_progress").insert({
    user_id: authorized.access.user.id,
    storybook_completed_at: storybookCookie ? now : null,
    library_completed_at: storybookCookie && libraryCookie ? now : null,
  });
  const { data } = await authorized.admin.from("user_journey_progress").select("*").eq("user_id", authorized.access.user.id).single();
  return data ? { progress: data, created: !storybookCookie && !libraryCookie } : null;
}

export async function loadUserJourneyProgress() {
  const authorized = await authorizeProgress();
  if (!authorized) return null;
  return loadOrCreateAuthorizedProgress(authorized);
}

export async function saveUserStorybookPage(page: number, expectedUpdatedAt: string | null) {
  const parsedPage = pageSchema.safeParse(page);
  if (!parsedPage.success) return { ok: false as const, error: "invalid" as const };
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const, error: "unauthorized" as const };
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return { ok: false as const, error: "unavailable" as const };
  if (loaded.progress.storybook_page_updated_at !== expectedUpdatedAt) {
    return { ok: false as const, error: "conflict" as const, progress: loaded.progress };
  }

  let query = authorized.admin.from("user_journey_progress").update({
    storybook_page: parsedPage.data,
    storybook_page_updated_at: new Date().toISOString(),
  }).eq("user_id", authorized.access.user.id);
  query = expectedUpdatedAt === null ? query.is("storybook_page_updated_at", null) : query.eq("storybook_page_updated_at", expectedUpdatedAt);
  const { data } = await query.select("*").maybeSingle();
  if (!data) {
    const current = await loadOrCreateAuthorizedProgress(authorized);
    if (!current) return { ok: false as const, error: "unavailable" as const };
    return { ok: false as const, error: "conflict" as const, progress: current.progress };
  }
  return { ok: true as const, progress: data };
}

export async function persistStorybookCompletion() {
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const };
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return { ok: false as const };
  const completedAt = loaded.progress.storybook_completed_at ?? new Date().toISOString();
  const { data } = await authorized.admin.from("user_journey_progress").update({
    storybook_page: 30,
    storybook_page_updated_at: new Date().toISOString(),
    storybook_completed_at: completedAt,
    last_location: "storybook",
  }).eq("user_id", authorized.access.user.id).select("*").single();
  if (!data || !(await markRoomCompleted(authorized.access.user.id, "storybook"))) return { ok: false as const };
  return { ok: true as const, progress: data };
}

export async function persistLibraryCompletion() {
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const };
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return { ok: false as const };
  if (!loaded.progress.storybook_completed_at) return { ok: false as const };
  const completedAt = loaded.progress.library_completed_at ?? new Date().toISOString();
  const { data } = await authorized.admin.from("user_journey_progress").update({
    library_completed_at: completedAt,
    last_location: "world",
  }).eq("user_id", authorized.access.user.id).select("*").single();
  if (!data || !(await markRoomCompleted(authorized.access.user.id, "storybook")) || !(await markRoomCompleted(authorized.access.user.id, "library"))) return { ok: false as const };
  return { ok: true as const, progress: data };
}

export async function loadAuthorizedPuzzleProgress() {
  const loaded = await loadUserJourneyProgress();
  return loaded?.progress.storybook_completed_at && loaded.progress.library_completed_at ? loaded : null;
}

function attemptColumn(quiz: QuizId) {
  return quiz === "millionaire" ? "puzzle_millionaire_attempt_state" as const : "puzzle_kculture_attempt_state" as const;
}
function seeded(seed: number) {
  let value = seed || 1;
  return () => ((value = (value * 48271) % 2147483647) / 2147483647);
}
function shuffle<T>(items: readonly T[], random: () => number) {
  return [...items].sort(() => random() - .5);
}
function isValidAttempt(value: unknown, quiz?: QuizId): value is SavedQuizAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<SavedQuizAttempt>;
  if (attempt.version !== 1 || (attempt.quizId !== "millionaire" && attempt.quizId !== "kculture") || (quiz && attempt.quizId !== quiz) || typeof attempt.attemptId !== "string" || !Array.isArray(attempt.questionIds) || attempt.questionIds.length !== 15 || new Set(attempt.questionIds).size !== 15 || typeof attempt.currentQuestionIndex !== "number" || attempt.currentQuestionIndex < 0 || attempt.currentQuestionIndex > 14 || !attempt.optionOrderByQuestion || !attempt.answersByQuestion || !Array.isArray(attempt.usedLifelines) || !attempt.eliminatedOptionsByQuestion || typeof attempt.startedAt !== "string" || typeof attempt.updatedAt !== "string") return false;
  const bank = getQuestionBank(attempt.quizId);
  const validAttempt = attempt as SavedQuizAttempt;
  const optionsValid = validAttempt.questionIds.every((id) => {
    const question = bank.find((item) => item.id === id);
    const order = validAttempt.optionOrderByQuestion[id];
    return Boolean(question && Array.isArray(order) && order.length === 4 && new Set(order).size === 4 && order.every((optionId) => /^.+:[0-3]$/.test(optionId) && optionId.startsWith(`${id}:`)) && [0, 1, 2, 3].every((index) => order.includes(`${id}:${index}`)));
  });
  const answerEntries = Object.entries(validAttempt.answersByQuestion);
  const eliminations = Object.entries(validAttempt.eliminatedOptionsByQuestion);
  const selectedValid = validAttempt.selectedOptionId === null || validAttempt.selectedOptionId === undefined || validAttempt.optionOrderByQuestion[validAttempt.questionIds[validAttempt.currentQuestionIndex]]?.includes(validAttempt.selectedOptionId);
  return optionsValid && selectedValid
    && answerEntries.every(([id, option]) => validAttempt.questionIds.includes(id) && validAttempt.optionOrderByQuestion[id]?.includes(option))
    && eliminations.every(([id, options]) => validAttempt.questionIds.includes(id) && Array.isArray(options) && options.every((option) => validAttempt.optionOrderByQuestion[id]?.includes(option)));
}

export async function startQuizAttempt(quiz: QuizId) {
  const loaded = await loadAuthorizedPuzzleProgress();
  if (!loaded) return { ok: false as const };
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const };
  const seed = Date.now() % 2147483647;
  const random = seeded(seed);
  const bank = getQuestionBank(quiz);
  const questions = quiz === "millionaire" ? [...bank] : shuffle(bank, random).slice(0, 15);
  const now = new Date().toISOString();
  const attempt: SavedQuizAttempt = {
    version: 1, quizId: quiz, attemptId: randomUUID(), questionIds: questions.map((question) => question.id),
    optionOrderByQuestion: Object.fromEntries(questions.map((question) => [question.id, shuffle(question.options.map((_, index) => `${question.id}:${index}`), random)])),
    answersByQuestion: {}, selectedOptionId: null, currentQuestionIndex: 0, usedLifelines: [], eliminatedOptionsByQuestion: {}, secondChanceQuestionId: null, seed: String(seed), startedAt: now, updatedAt: now,
  };
  const column = attemptColumn(quiz);
  const update = quiz === "millionaire" ? { puzzle_millionaire_attempt_state: attemptAsJson(attempt) } : { puzzle_kculture_attempt_state: attemptAsJson(attempt) };
  const { error } = await authorized.admin.from("user_journey_progress").update(update).eq("user_id", authorized.access.user.id);
  if (error) console.error("Puzzle attempt could not be started", { quiz, code: error.code });
  return { ok: true as const, attempt, persisted: !error, column };
}

export async function loadQuizAttempt(quiz: QuizId) {
  const loaded = await loadAuthorizedPuzzleProgress();
  if (!loaded) return { ok: false as const };
  const value = loaded.progress[attemptColumn(quiz)];
  if (value == null) return { ok: true as const, attempt: null };
  if (isValidAttempt(value, quiz)) return { ok: true as const, attempt: value };
  await clearQuizAttempt(quiz);
  return { ok: true as const, attempt: null };
}

export async function saveQuizAttempt(attempt: SavedQuizAttempt, expectedUpdatedAt: string) {
  if (!isValidAttempt(attempt)) return { ok: false as const };
  const loaded = await loadAuthorizedPuzzleProgress();
  if (!loaded) return { ok: false as const };
  const current = loaded.progress[attemptColumn(attempt.quizId)];
  if (!isValidAttempt(current, attempt.quizId) || current.attemptId !== attempt.attemptId || current.updatedAt !== expectedUpdatedAt) return { ok: false as const, stale: true as const };
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const };
  const saved = { ...attempt, updatedAt: new Date().toISOString() };
  const update = attempt.quizId === "millionaire" ? { puzzle_millionaire_attempt_state: attemptAsJson(saved) } : { puzzle_kculture_attempt_state: attemptAsJson(saved) };
  const { error } = await authorized.admin.from("user_journey_progress").update(update).eq("user_id", authorized.access.user.id);
  return error ? { ok: false as const } : { ok: true as const, attempt: saved };
}

export async function clearQuizAttempt(quiz: QuizId) {
  const loaded = await loadAuthorizedPuzzleProgress();
  if (!loaded) return false;
  const authorized = await authorizeProgress();
  if (!authorized) return false;
  const update = quiz === "millionaire" ? { puzzle_millionaire_attempt_state: null } : { puzzle_kculture_attempt_state: null };
  const { error } = await authorized.admin.from("user_journey_progress").update(update).eq("user_id", authorized.access.user.id);
  return !error;
}

export async function persistPuzzleState(puzzle: PuzzleId, state: "completed" | "skipped") {
  const parsedPuzzle = puzzleSchema.safeParse(puzzle);
  if (!parsedPuzzle.success) return { ok: false as const };
  const loaded = await loadAuthorizedPuzzleProgress();
  if (!loaded) return { ok: false as const };
  const column = `puzzle_${parsedPuzzle.data}_${state}_at` as
    | "puzzle_millionaire_completed_at" | "puzzle_kculture_completed_at" | "puzzle_constellation_completed_at"
    | "puzzle_millionaire_skipped_at" | "puzzle_kculture_skipped_at" | "puzzle_constellation_skipped_at";
  if (loaded.progress[column]) return { ok: true as const, progress: loaded.progress };
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false as const };
  const timestamp = new Date().toISOString();
  const update = column === "puzzle_millionaire_completed_at" ? { puzzle_millionaire_completed_at: timestamp }
    : column === "puzzle_kculture_completed_at" ? { puzzle_kculture_completed_at: timestamp }
      : column === "puzzle_constellation_completed_at" ? { puzzle_constellation_completed_at: timestamp }
        : column === "puzzle_millionaire_skipped_at" ? { puzzle_millionaire_skipped_at: timestamp }
          : column === "puzzle_kculture_skipped_at" ? { puzzle_kculture_skipped_at: timestamp }
            : { puzzle_constellation_skipped_at: timestamp };
  const { data } = await authorized.admin.from("user_journey_progress").update(update).eq("user_id", authorized.access.user.id).select("*").single();
  return data ? { ok: true as const, progress: data } : { ok: false as const };
}

type QuizVerificationPayload = { userId: string; quizId: QuizId; attemptId: string; score: number; expiresAt: number };
function quizVerificationKey() {
  const config = getServerSupabaseConfig();
  return config ? `the-beginning-of-maybe:quiz-result:${config.serviceRoleKey}` : null;
}
function signQuizVerification(payload: QuizVerificationPayload) {
  const key = quizVerificationKey();
  if (!key) return null;
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", key).update(encoded).digest("base64url")}`;
}
function readQuizVerification(reference: string): QuizVerificationPayload | null {
  const key = quizVerificationKey();
  const [encoded, received, extra] = reference.split(".");
  if (!key || !encoded || !received || extra) return null;
  const expected = createHmac("sha256", key).update(encoded).digest();
  const receivedBuffer = Buffer.from(received, "base64url");
  if (receivedBuffer.length !== expected.length || !timingSafeEqual(receivedBuffer, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as QuizVerificationPayload;
    return value.expiresAt > Date.now() && Number.isInteger(value.score) && value.score >= 0 && value.score <= 15 ? value : null;
  } catch { return null; }
}

export async function verifyQuizAttempt(puzzle: QuizId, attemptId: string, questionIds: string[], selectedOptionIds: string[]): Promise<VerifiedQuizResult> {
  const invalid = (error: string): VerifiedQuizResult => ({ success: false, quizId: puzzle, score: 0, total: 15, percentage: 0, passed: false, bestScore: 0, persisted: false, error });
  if ((puzzle !== "millionaire" && puzzle !== "kculture") || !z.string().uuid().safeParse(attemptId).success || questionIds.length !== 15 || selectedOptionIds.length !== 15 || new Set(questionIds).size !== 15) return invalid("This attempt could not be verified.");
  const bank = getQuestionBank(puzzle);
  const questions = questionIds.map((id) => bank.find((question) => question.id === id));
  if (questions.some((question) => !question) || selectedOptionIds.some((optionId, index) => !new RegExp(`^${questionIds[index]}:[0-3]$`).test(optionId))) return invalid("This attempt could not be verified.");
  if (puzzle === "millionaire" && questionIds.some((id, index) => id !== bank[index]?.id)) return invalid("This attempt could not be verified.");
  const loaded = await loadAuthorizedPuzzleProgress();
  if (!loaded) return invalid("This attempt is not authorized.");
  const saved = loaded.progress[attemptColumn(puzzle)];
  const storageAvailable = saved !== undefined;
  if (storageAvailable && (!isValidAttempt(saved, puzzle) || saved.attemptId !== attemptId || saved.questionIds.some((id, index) => id !== questionIds[index]))) return invalid("The saved attempt no longer matches this submission.");
  const selectedAnswers = selectedOptionIds.map((id) => Number(id.slice(id.lastIndexOf(":") + 1)));
  const score = questions.reduce((total, question, index) => total + (question?.correct === selectedAnswers[index] ? 1 : 0), 0);
  const storedBest = puzzle === "millionaire" ? loaded.progress.puzzle_millionaire_best_score : loaded.progress.puzzle_kculture_best_score;
  const durableBest = Number.isInteger(storedBest) ? storedBest : 0;
  const verificationRef = signQuizVerification({ userId: loaded.progress.user_id, quizId: puzzle, attemptId, score, expiresAt: Date.now() + 5 * 60 * 1000 });
  if (!verificationRef) return invalid("This result could not be prepared securely.");
  return { success: true, quizId: puzzle, score, total: 15, percentage: Math.round((score / 15) * 100), passed: score >= 10, bestScore: durableBest, persisted: false, verificationRef };
}

export async function persistVerifiedQuizResult(reference: string): Promise<{ ok: boolean; bestScore?: number; warning?: string }> {
  const payload = readQuizVerification(reference);
  if (!payload) return { ok: false, warning: "Your result was calculated, but it could not be saved just now." };
  const loaded = await loadAuthorizedPuzzleProgress();
  if (!loaded) return { ok: false, warning: "Your result was calculated, but it could not be saved just now." };
  const authorized = await authorizeProgress();
  if (!authorized || authorized.access.user.id !== payload.userId) return { ok: false, warning: "Your result was calculated, but it could not be saved just now." };
  const currentAttempt = loaded.progress[attemptColumn(payload.quizId)];
  const completedAt = payload.quizId === "millionaire" ? loaded.progress.puzzle_millionaire_completed_at : loaded.progress.puzzle_kculture_completed_at;
  if (!completedAt && (!isValidAttempt(currentAttempt, payload.quizId) || currentAttempt.attemptId !== payload.attemptId)) return { ok: false, warning: "Your result was calculated, but it could not be saved just now." };
  const storedBest = payload.quizId === "millionaire" ? loaded.progress.puzzle_millionaire_best_score : loaded.progress.puzzle_kculture_best_score;
  const durableBest = Number.isInteger(storedBest) ? storedBest : 0;
  const now = new Date().toISOString();
  const update = payload.quizId === "millionaire"
    ? { puzzle_millionaire_completed_at: loaded.progress.puzzle_millionaire_completed_at ?? now, puzzle_millionaire_best_score: Math.max(durableBest, payload.score), puzzle_millionaire_attempt_state: null }
    : { puzzle_kculture_completed_at: loaded.progress.puzzle_kculture_completed_at ?? now, puzzle_kculture_best_score: Math.max(durableBest, payload.score), puzzle_kculture_attempt_state: null };
  const { data, error } = await authorized.admin.from("user_journey_progress").update(update).eq("user_id", authorized.access.user.id).select("*").single();
  if (error || !data) {
    console.error("Verified puzzle result could not be persisted", { puzzle: payload.quizId, code: error?.code ?? "no_data" });
    return { ok: false, warning: "Your result was calculated, but it could not be saved just now." };
  }
  return { ok: true, bestScore: payload.quizId === "millionaire" ? data.puzzle_millionaire_best_score : data.puzzle_kculture_best_score };
}

export async function persistPuzzleRoomCompletion(): Promise<PuzzleRoomCompletionResult> {
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false, reason: "unauthorized" };
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return { ok: false, reason: "completion_write_failed" };
  if (!loaded.progress.storybook_completed_at || !loaded.progress.library_completed_at) {
    return { ok: false, reason: "missing_prerequisite" };
  }
  if (loaded.progress.puzzle_room_completed_at) {
    return { ok: true, alreadyCompleted: true, navigationMetadataSaved: false };
  }

  const { data: completed, error: completionError } = await authorized.admin
    .from("user_journey_progress")
    .update({ puzzle_room_completed_at: new Date().toISOString() })
    .eq("user_id", authorized.access.user.id)
    .is("puzzle_room_completed_at", null)
    .select("*")
    .maybeSingle();
  if (completionError) {
    console.error("Puzzle room completion operation failed", {
      operation: "persist_completion",
      code: completionError.code,
      alreadyCompleted: false,
    });
    return { ok: false, reason: "completion_write_failed" };
  }
  if (!completed || completed.user_id !== authorized.access.user.id) {
    const { data: current, error: reloadError } = await authorized.admin
      .from("user_journey_progress")
      .select("puzzle_room_completed_at")
      .eq("user_id", authorized.access.user.id)
      .maybeSingle();
    if (reloadError) {
      console.error("Puzzle room completion operation failed", {
        operation: "confirm_completion",
        code: reloadError.code,
        alreadyCompleted: false,
      });
    }
    if (current?.puzzle_room_completed_at) {
      return { ok: true, alreadyCompleted: true, navigationMetadataSaved: false };
    }
    return { ok: false, reason: "completion_write_failed" };
  }

  const { error: navigationError } = await authorized.admin.from("user_journey_progress").update({
    last_location: "world",
    last_world_destination: "puzzle-room",
  }).eq("user_id", authorized.access.user.id);
  if (navigationError) {
    console.error("Puzzle room completion operation failed", {
      operation: "save_navigation_metadata",
      code: navigationError.code,
      alreadyCompleted: false,
    });
  }
  return { ok: true, alreadyCompleted: false, navigationMetadataSaved: !navigationError };
}

export async function loadAuthorizedRadioProgress() {
  const loaded = await loadUserJourneyProgress();
  return loaded?.progress.storybook_completed_at
    && loaded.progress.library_completed_at
    && loaded.progress.puzzle_room_completed_at ? loaded : null;
}

export async function persistRadioCompletion(): Promise<RadioCompletionResult> {
  const authorized = await authorizeProgress();
  if (!authorized) return { ok: false, reason: "unauthorized" };
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return { ok: false, reason: "completion_write_failed" };
  if (!loaded.progress.storybook_completed_at
    || !loaded.progress.library_completed_at
    || !loaded.progress.puzzle_room_completed_at) {
    return { ok: false, reason: "missing_prerequisite" };
  }
  if (loaded.progress.radio_completed_at) {
    return { ok: true, alreadyCompleted: true, navigationMetadataSaved: false };
  }

  const { data: completed, error: completionError } = await authorized.admin
    .from("user_journey_progress")
    .update({ radio_completed_at: new Date().toISOString() })
    .eq("user_id", authorized.access.user.id)
    .is("radio_completed_at", null)
    .select("user_id,radio_completed_at")
    .maybeSingle();
  if (completionError) {
    console.error("Radio completion operation failed", {
      operation: "persist_completion",
      code: completionError.code,
      alreadyCompleted: false,
    });
    return { ok: false, reason: "completion_write_failed" };
  }
  if (!completed || completed.user_id !== authorized.access.user.id) {
    const { data: current, error: reloadError } = await authorized.admin
      .from("user_journey_progress")
      .select("radio_completed_at")
      .eq("user_id", authorized.access.user.id)
      .maybeSingle();
    if (reloadError) {
      console.error("Radio completion operation failed", {
        operation: "confirm_completion",
        code: reloadError.code,
        alreadyCompleted: false,
      });
    }
    if (current?.radio_completed_at) {
      return { ok: true, alreadyCompleted: true, navigationMetadataSaved: false };
    }
    return { ok: false, reason: "completion_write_failed" };
  }

  const { error: navigationError } = await authorized.admin
    .from("user_journey_progress")
    .update({
      last_location: "question_garden",
      last_world_destination: "question-garden",
    })
    .eq("user_id", authorized.access.user.id);
  if (navigationError) {
    console.error("Radio completion operation failed", {
      operation: "save_navigation_metadata",
      code: navigationError.code,
      alreadyCompleted: false,
    });
  }
  return { ok: true, alreadyCompleted: false, navigationMetadataSaved: !navigationError };
}

export async function saveSafeLocation(location: SafeLocation) {
  const parsed = locationSchema.safeParse(location);
  if (!parsed.success) return false;
  const authorized = await authorizeProgress();
  if (!authorized) return false;
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return false;
  if (parsed.data === "library" && !loaded.progress.storybook_completed_at) return false;
  if (parsed.data === "puzzle_room" && (!loaded.progress.storybook_completed_at || !loaded.progress.library_completed_at)) return false;
  if (parsed.data === "radio" && (!loaded.progress.storybook_completed_at || !loaded.progress.library_completed_at || !loaded.progress.puzzle_room_completed_at)) return false;
  if (parsed.data === "question_garden" && (!loaded.progress.storybook_completed_at || !loaded.progress.library_completed_at || !loaded.progress.puzzle_room_completed_at || !loaded.progress.radio_completed_at)) return false;
  const { error } = await authorized.admin.from("user_journey_progress").update({ last_location: parsed.data }).eq("user_id", authorized.access.user.id);
  return !error;
}

export async function saveWorldDestination(destination: string) {
  const parsed = worldDestinationSchema.safeParse(destination);
  if (!parsed.success) return false;
  const authorized = await authorizeProgress();
  if (!authorized) return false;
  const loaded = await loadOrCreateAuthorizedProgress(authorized);
  if (!loaded) return false;
  const { error } = await authorized.admin.from("user_journey_progress").update({
    last_location: "world",
    last_world_destination: parsed.data,
  }).eq("user_id", authorized.access.user.id);
  return !error;
}

export async function reconcileCompletionCookies(progress: UserJourneyProgress) {
  if (progress.storybook_completed_at) await markRoomCompleted(progress.user_id, "storybook");
  else await clearCompletedRoom("storybook");
  if (progress.library_completed_at && progress.storybook_completed_at) await markRoomCompleted(progress.user_id, "library");
  else await clearCompletedRoom("library");
}

export function deriveResumeDestination(progress: UserJourneyProgress, firstProgressRow: boolean) {
  if (firstProgressRow) return "/";
  if (progress.last_location === "storybook") return "/story";
  if (progress.last_location === "library" && progress.storybook_completed_at) return "/library";
  if (progress.last_location === "puzzle_room" && progress.storybook_completed_at && progress.library_completed_at) return "/puzzles";
  if (progress.last_location === "radio" && progress.storybook_completed_at && progress.library_completed_at && progress.puzzle_room_completed_at) return "/radio";
  if (progress.last_location === "question_garden" && progress.storybook_completed_at && progress.library_completed_at && progress.puzzle_room_completed_at && progress.radio_completed_at) return "/question-garden";
  return "/?view=world";
}
