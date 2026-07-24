import "server-only";

import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  QUESTION_GARDEN_CATEGORIES,
  type GardenQuestionPreview,
  type GardenQuestionState,
  type QuestionGardenCategory,
  type QuestionGardenFoundation,
} from "@/lib/question-garden/contracts";

export async function authorizeQuestionGarden() {
  const access = await getAuthenticatedAccess();
  if (!access.ok || !(await hasPassedExperienceGate(access.user.id))) return null;
  const journey = await loadUserJourneyProgress();
  if (!journey?.progress.storybook_completed_at
    || !journey.progress.library_completed_at
    || !journey.progress.puzzle_room_completed_at
    || !journey.progress.radio_completed_at) return null;
  const admin = createAdminSupabaseClient();
  return admin ? { access, admin, progress: journey.progress } : null;
}

function safeOptions(value: unknown) {
  return Array.isArray(value) && value.every((option) => typeof option === "string")
    ? value.slice(0, 8)
    : null;
}

export async function loadQuestionGardenFoundation(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeQuestionGarden>>>,
): Promise<QuestionGardenFoundation> {
  const [{ data: questions, error: questionError }, { data: answerStates, error: answerError }, { data: memberState }] = await Promise.all([
    authorized.admin
      .from("question_garden_questions")
      .select("id,category,prompt,response_type,options,personal_note,planted_by_user_id,source_type,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    authorized.admin
      .from("question_garden_answers")
      .select("question_id,user_id,status,revealed_at"),
    authorized.admin
      .from("question_garden_member_state")
      .select("last_category,last_question_id")
      .eq("user_id", authorized.access.user.id)
      .maybeSingle(),
  ]);

  if (questionError) {
    console.error("Question Garden foundation operation failed", { operation: "load_questions", code: questionError.code });
  }
  if (answerError) {
    console.error("Question Garden foundation operation failed", { operation: "load_answer_states", code: answerError.code });
  }

  const stateByQuestion = new Map<string, { submitted: Set<string>; revealed: Set<string> }>();
  const ownStatusByQuestion = new Map<string, "draft" | "submitted" | "skipped">();
  for (const answer of answerStates ?? []) {
    const state = stateByQuestion.get(answer.question_id) ?? { submitted: new Set<string>(), revealed: new Set<string>() };
    if (answer.status === "submitted") state.submitted.add(answer.user_id);
    if (answer.status === "submitted" && answer.revealed_at) state.revealed.add(answer.user_id);
    if (answer.user_id === authorized.access.user.id) ownStatusByQuestion.set(answer.question_id, answer.status);
    stateByQuestion.set(answer.question_id, state);
  }

  const previews: GardenQuestionPreview[] = (questions ?? []).flatMap((question) => {
    if (!QUESTION_GARDEN_CATEGORIES.includes(question.category as QuestionGardenCategory)) return [];
    const answerState = stateByQuestion.get(question.id);
    const submittedCount = answerState?.submitted.size ?? 0;
    const state: GardenQuestionState = submittedCount === 0
      ? "seed"
      : submittedCount >= 2 && (answerState?.revealed.size ?? 0) >= 2
        ? "bloom"
        : "bud";
    return [{
      id: question.id,
      category: question.category as QuestionGardenCategory,
      prompt: question.prompt,
      responseType: question.response_type,
      options: safeOptions(question.options),
      sortOrder: question.sort_order,
      sourceType: question.source_type,
      personalNote: question.personal_note,
      isPlanter: question.planted_by_user_id === authorized.access.user.id,
      hasAnyAnswer: Boolean(answerState && (answerState.submitted.size > 0 || ownStatusByQuestion.has(question.id))),
      state,
      ownStatus: ownStatusByQuestion.get(question.id) ?? null,
      ownSubmitted: Boolean(answerState?.submitted.has(authorized.access.user.id)),
      partnerSubmitted: Boolean([...(answerState?.submitted ?? [])].some((userId) => userId !== authorized.access.user.id)),
    }];
  });

  const beds = QUESTION_GARDEN_CATEGORIES.map((category) => {
    const categoryQuestions = previews.filter((question) => question.category === category);
    return {
      category,
      questions: categoryQuestions,
      counts: {
        seed: categoryQuestions.filter((question) => question.state === "seed").length,
        bud: categoryQuestions.filter((question) => question.state === "bud").length,
        bloom: categoryQuestions.filter((question) => question.state === "bloom").length,
      },
    };
  });
  return {
    beds,
    counts: {
      seed: previews.filter((question) => question.state === "seed").length,
      bud: previews.filter((question) => question.state === "bud").length,
      bloom: previews.filter((question) => question.state === "bloom").length,
    },
    lastCategory: QUESTION_GARDEN_CATEGORIES.includes(memberState?.last_category as QuestionGardenCategory) ? memberState!.last_category as QuestionGardenCategory : null,
    lastQuestionId: memberState?.last_question_id ?? null,
  };
}

export async function recordQuestionGardenVisit(
  authorized: NonNullable<Awaited<ReturnType<typeof authorizeQuestionGarden>>>,
) {
  const now = new Date().toISOString();
  const { error: stateError } = await authorized.admin.from("question_garden_member_state").upsert({
    user_id: authorized.access.user.id,
    last_visited_at: now,
  }, { onConflict: "user_id" });
  if (stateError) {
    console.error("Question Garden foundation operation failed", { operation: "record_visit", code: stateError.code });
  }
  const { error: locationError } = await authorized.admin.from("user_journey_progress").update({
    last_location: "question_garden",
    last_world_destination: "question-garden",
  }).eq("user_id", authorized.access.user.id);
  if (locationError) {
    console.error("Question Garden foundation operation failed", { operation: "record_location", code: locationError.code });
  }
}
