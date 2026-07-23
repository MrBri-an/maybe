import type { Json } from "@/lib/supabase/database.types";
import type { QuizId } from "./question-banks";

export type SavedQuizAttempt = {
  version: 1;
  quizId: QuizId;
  attemptId: string;
  questionIds: string[];
  optionOrderByQuestion: Record<string, string[]>;
  answersByQuestion: Record<string, string>;
  selectedOptionId: string | null;
  currentQuestionIndex: number;
  usedLifelines: string[];
  eliminatedOptionsByQuestion: Record<string, string[]>;
  secondChanceQuestionId?: string | null;
  seed?: string;
  startedAt: string;
  updatedAt: string;
};

export type VerifiedQuizResult = {
  success: boolean;
  quizId: QuizId;
  score: number;
  total: 15;
  percentage: number;
  passed: boolean;
  bestScore: number;
  persisted: boolean;
  persistenceWarning?: string;
  verificationRef?: string;
  error?: string;
};

export function attemptAsJson(attempt: SavedQuizAttempt): Json {
  return attempt as unknown as Json;
}
