"use server";

import { archiveCustomGardenQuestion, loadGardenQuestion, persistCustomGardenQuestion, persistGardenDraft, persistGardenFollowUp, persistGardenPosition, persistGardenReaction, persistQuestionGardenCompletion, skipGardenAnswer, submitGardenAnswer, updateSealedGardenAnswer } from "@/lib/question-garden/answers";

export async function loadQuestionGardenQuestion(questionId: string) {
  return loadGardenQuestion(questionId);
}
export async function saveQuestionGardenDraft(input: unknown) {
  return persistGardenDraft(input);
}
export async function submitQuestionGardenAnswer(input: unknown) {
  return submitGardenAnswer(input);
}
export async function updateQuestionGardenSealedAnswer(input: unknown) {
  return updateSealedGardenAnswer(input);
}
export async function skipQuestionGardenQuestion(questionId: string) {
  return skipGardenAnswer(questionId);
}
export async function saveQuestionGardenPosition(category: string, questionId: string | null) {
  return persistGardenPosition(category, questionId);
}
export async function reactToQuestionGardenBloom(questionId: string, reaction: string) {
  return persistGardenReaction(questionId, reaction);
}
export async function saveQuestionGardenFollowUp(questionId: string, note: string) {
  return persistGardenFollowUp(questionId, note);
}
export async function saveCustomQuestionGardenQuestion(input: unknown) {
  return persistCustomGardenQuestion(input);
}
export async function archiveQuestionGardenQuestion(questionId: string) {
  return archiveCustomGardenQuestion(questionId);
}
export async function completeQuestionGardenJourney() {
  return persistQuestionGardenCompletion();
}
