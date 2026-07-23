"use server";

import { clearQuizAttempt, loadAuthorizedPuzzleProgress, loadQuizAttempt, persistPuzzleRoomCompletion, persistPuzzleState, persistVerifiedQuizResult, saveQuizAttempt, saveSafeLocation, startQuizAttempt, verifyQuizAttempt, type PuzzleId } from "@/lib/progression/user-progress";
import type { QuizId } from "@/features/puzzles/quiz/question-banks";
import type { SavedQuizAttempt } from "@/features/puzzles/quiz/contracts";

export async function loadPuzzleProgress() {
  const loaded = await loadAuthorizedPuzzleProgress();
  if (!loaded) return { ok: false as const };
  const progress = loaded.progress;
  return {
    ok: true as const,
    progress: {
      millionaireCompleted: Boolean(progress.puzzle_millionaire_completed_at),
      kcultureCompleted: Boolean(progress.puzzle_kculture_completed_at),
      constellationCompleted: Boolean(progress.puzzle_constellation_completed_at),
      millionaireSkipped: Boolean(progress.puzzle_millionaire_skipped_at),
      kcultureSkipped: Boolean(progress.puzzle_kculture_skipped_at),
      constellationSkipped: Boolean(progress.puzzle_constellation_skipped_at),
      roomCompleted: Boolean(progress.puzzle_room_completed_at),
      millionaireBestScore: progress.puzzle_millionaire_best_score,
      kcultureBestScore: progress.puzzle_kculture_best_score,
    },
  };
}

export async function startQuiz(puzzle: QuizId) {
  return startQuizAttempt(puzzle);
}
export async function loadQuiz(puzzle: QuizId) {
  return loadQuizAttempt(puzzle);
}
export async function saveQuiz(attempt: SavedQuizAttempt, expectedUpdatedAt: string) {
  return saveQuizAttempt(attempt, expectedUpdatedAt);
}
export async function clearQuiz(puzzle: QuizId) {
  return clearQuizAttempt(puzzle);
}
export async function submitQuizAttempt(puzzle: QuizId, attemptId: string, questionIds: string[], selectedOptionIds: string[]) {
  return verifyQuizAttempt(puzzle, attemptId, questionIds, selectedOptionIds);
}
export async function persistQuizResult(reference: string) {
  return persistVerifiedQuizResult(reference);
}

export async function markPuzzleCompleted(puzzle: PuzzleId) {
  const result = await persistPuzzleState(puzzle, "completed");
  return result.ok ? { ok: true as const } : { ok: false as const, error: "That discovery could not be saved just now." };
}

export async function markPuzzleSkipped(puzzle: PuzzleId) {
  const result = await persistPuzzleState(puzzle, "skipped");
  if (puzzle === "millionaire" || puzzle === "kculture") await clearQuizAttempt(puzzle);
  return result.ok ? { ok: true as const } : { ok: false as const, error: "That choice could not be saved just now." };
}

export async function completePuzzleRoomJourney() {
  const result = await persistPuzzleRoomCompletion();
  if (result.ok) return result;
  return {
    ...result,
    error: result.reason === "unauthorized"
      ? "Please sign in with an approved account to continue."
      : result.reason === "missing_prerequisite"
        ? "Complete the earlier journey rooms before continuing."
        : "The next step could not be saved. Please try again.",
  };
}

export async function recordPuzzleRoomLocation() {
  return saveSafeLocation("puzzle_room");
}
