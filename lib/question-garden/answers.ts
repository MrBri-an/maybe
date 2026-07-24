import "server-only";

import { z } from "zod";
import { authorizeQuestionGarden } from "@/lib/question-garden/foundation";
import {
  QUESTION_GARDEN_CATEGORIES,
  type GardenDraftResult,
  type GardenQuestionDetail,
  type GardenQuestionState,
  type GardenQuestionSummary,
  type GardenReactionView,
  type QuestionGardenCategory,
} from "@/lib/question-garden/contracts";

const questionIdSchema = z.string().uuid();
const draftSchema = z.object({
  questionId: questionIdSchema,
  answerText: z.string().max(5000),
  selectedOption: z.string().max(120).nullable(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
});

type AuthorizedGarden = NonNullable<Awaited<ReturnType<typeof authorizeQuestionGarden>>>;

async function loadQuestion(authorized: AuthorizedGarden, questionId: string) {
  const { data } = await authorized.admin.from("question_garden_questions")
    .select("id,category,prompt,response_type,options")
    .eq("id", questionId).eq("active", true).maybeSingle();
  if (!data || !QUESTION_GARDEN_CATEGORIES.includes(data.category as QuestionGardenCategory)) return null;
  const options = Array.isArray(data.options) && data.options.every((option) => typeof option === "string")
    ? data.options as string[]
    : null;
  return { ...data, category: data.category as QuestionGardenCategory, options };
}

function validValue(question: NonNullable<Awaited<ReturnType<typeof loadQuestion>>>, answerText: string, selectedOption: string | null, submitting: boolean) {
  if (question.response_type === "choice") {
    return answerText === "" && (selectedOption === null ? !submitting : Boolean(question.options?.includes(selectedOption)));
  }
  if (selectedOption !== null) return false;
  const limit = question.response_type === "short_text" ? 500 : 5000;
  return answerText.length <= limit && (!submitting || answerText.trim().length > 0);
}

async function safeSummary(authorized: AuthorizedGarden, questionId: string): Promise<GardenQuestionSummary> {
  const { data: rows } = await authorized.admin.from("question_garden_answers")
    .select("user_id,status,revealed_at")
    .eq("question_id", questionId);
  const own = rows?.find((row) => row.user_id === authorized.access.user.id);
  const submitted = (rows ?? []).filter((row) => row.status === "submitted");
  const revealed = submitted.filter((row) => row.revealed_at);
  const state: GardenQuestionState = submitted.length === 0 ? "seed" : submitted.length >= 2 && revealed.length >= 2 ? "bloom" : "bud";
  return {
    id: questionId,
    state,
    ownStatus: own?.status ?? null,
    ownSubmitted: own?.status === "submitted",
    partnerSubmitted: submitted.some((row) => row.user_id !== authorized.access.user.id),
  };
}

export async function loadGardenQuestion(questionId: string): Promise<{ ok: true; detail: GardenQuestionDetail } | { ok: false; reason: "unauthorized" | "unavailable" }> {
  const parsed = questionIdSchema.safeParse(questionId);
  const authorized = await authorizeQuestionGarden();
  if (!authorized) return { ok: false, reason: "unauthorized" };
  if (!parsed.success) return { ok: false, reason: "unavailable" };
  return loadAuthorizedGardenQuestion(authorized, parsed.data);
}

async function loadAuthorizedGardenQuestion(
  authorized: AuthorizedGarden,
  questionId: string,
  knownQuestion?: NonNullable<Awaited<ReturnType<typeof loadQuestion>>>,
): Promise<{ ok: true; detail: GardenQuestionDetail } | { ok: false; reason: "unavailable" }> {
  const question = knownQuestion ?? await loadQuestion(authorized, questionId);
  if (!question) return { ok: false, reason: "unavailable" };
  const [{ data: states }, { data: ownPrivate }] = await Promise.all([
    authorized.admin.from("question_garden_answers")
      .select("user_id,status,submitted_at,revealed_at")
      .eq("question_id", questionId),
    authorized.admin.from("question_garden_answers")
      .select("status,answer_text,selected_option,updated_at")
      .eq("question_id", questionId)
      .eq("user_id", authorized.access.user.id)
      .maybeSingle(),
  ]);
  const ownState = states?.find((row) => row.user_id === authorized.access.user.id);
  const submitted = (states ?? []).filter((row) => row.status === "submitted");
  const mutuallyRevealed = submitted.length >= 2 && submitted.every((row) => row.revealed_at);

  let revealedAnswers: GardenQuestionDetail["revealedAnswers"] = null;
  let bloomDate: string | null = null;
  let reactions: GardenReactionView[] = [];
  if (mutuallyRevealed) {
    const [{ data: answers }, { data: reactionRows }] = await Promise.all([
      authorized.admin.from("question_garden_answers")
        .select("user_id,answer_text,selected_option,follow_up_note,revealed_at,updated_at")
        .eq("question_id", questionId)
        .eq("status", "submitted")
        .not("revealed_at", "is", null),
      authorized.admin.from("question_garden_reactions")
        .select("user_id,reaction").eq("question_id", questionId),
    ]);
    if ((answers?.length ?? 0) >= 2) {
      revealedAnswers = answers!.map((answer) => ({
        owner: answer.user_id === authorized.access.user.id ? "you" : "partner",
        answerText: answer.answer_text ?? "",
        selectedOption: answer.selected_option,
        followUpNote: answer.follow_up_note,
        updatedAt: answer.updated_at,
      }));
      bloomDate = answers![0].revealed_at;
    }
    reactions = (reactionRows ?? []).map((reaction) => ({
      owner: reaction.user_id === authorized.access.user.id ? "you" : "partner",
      reaction: reaction.reaction,
    }));
  }

  return {
    ok: true,
    detail: {
      id: question.id,
      category: question.category,
      prompt: question.prompt,
      responseType: question.response_type,
      options: question.options,
      state: mutuallyRevealed ? "bloom" : submitted.length > 0 ? "bud" : "seed",
      ownAnswer: ownPrivate ? {
        status: ownPrivate.status,
        answerText: ownPrivate.answer_text ?? "",
        selectedOption: ownPrivate.selected_option,
        updatedAt: ownPrivate.updated_at,
      } : null,
      ownSubmitted: ownState?.status === "submitted",
      partnerSubmitted: submitted.some((row) => row.user_id !== authorized.access.user.id),
      revealedAnswers,
      reactions,
      bloomDate,
    },
  };
}

function summaryFromDetail(detail: GardenQuestionDetail): GardenQuestionSummary {
  return {
    id: detail.id,
    state: detail.state,
    ownStatus: detail.ownAnswer?.status ?? null,
    ownSubmitted: detail.ownSubmitted,
    partnerSubmitted: detail.partnerSubmitted,
  };
}

export async function persistGardenDraft(input: unknown): Promise<GardenDraftResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const authorized = await authorizeQuestionGarden();
  if (!authorized) return { ok: false, reason: "unauthorized" };
  const question = await loadQuestion(authorized, parsed.data.questionId);
  if (!question || !validValue(question, parsed.data.answerText, parsed.data.selectedOption, false)) return { ok: false, reason: "invalid" };
  const { data: existing } = await authorized.admin.from("question_garden_answers")
    .select("id,status,updated_at,revealed_at")
    .eq("question_id", question.id).eq("user_id", authorized.access.user.id).maybeSingle();
  if (existing?.revealed_at) return { ok: false, reason: "sealed" };
  if ((existing?.updated_at ?? null) !== parsed.data.expectedUpdatedAt) {
    return { ok: false, reason: "conflict", currentUpdatedAt: existing?.updated_at };
  }
  const value = { answer_text: parsed.data.answerText || null, selected_option: parsed.data.selectedOption };
  if (!existing) {
    const { data, error } = await authorized.admin.from("question_garden_answers").insert({
      question_id: question.id, user_id: authorized.access.user.id, status: "draft", ...value,
    }).select("updated_at").maybeSingle();
    if (error || !data) {
      if (error) {
        console.error("Question Garden answer operation failed", {
          operation: "create_draft",
          code: error.code,
        });
      }
      const { data: current } = await authorized.admin.from("question_garden_answers")
        .select("updated_at").eq("question_id", question.id).eq("user_id", authorized.access.user.id).maybeSingle();
      return current ? { ok: false, reason: "conflict", currentUpdatedAt: current.updated_at } : { ok: false, reason: "unavailable" };
    }
    return { ok: true, updatedAt: data.updated_at, status: "draft" };
  }
  const status = existing.status === "submitted" ? "submitted" as const : "draft" as const;
  const { data, error } = await authorized.admin.from("question_garden_answers").update({ status, ...value })
    .eq("id", existing.id).eq("updated_at", existing.updated_at).select("updated_at").maybeSingle();
  if (error) {
    console.error("Question Garden answer operation failed", {
      operation: status === "submitted" ? "update_submitted_answer" : "update_draft",
      code: error.code,
    });
    return { ok: false, reason: "unavailable" };
  }
  if (!data) {
    const { data: current } = await authorized.admin.from("question_garden_answers")
      .select("updated_at").eq("id", existing.id).maybeSingle();
    return { ok: false, reason: "conflict", currentUpdatedAt: current?.updated_at };
  }
  return { ok: true, updatedAt: data.updated_at, status };
}

export async function submitGardenAnswer(input: unknown) {
  const parsed = draftSchema.omit({ expectedUpdatedAt: true }).safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: "invalid" as const };
  const authorized = await authorizeQuestionGarden();
  if (!authorized) return { ok: false as const, reason: "unauthorized" as const };
  const question = await loadQuestion(authorized, parsed.data.questionId);
  if (!question || !validValue(question, parsed.data.answerText, parsed.data.selectedOption, true)) return { ok: false as const, reason: "invalid" as const };
  const { error } = await authorized.admin.rpc("submit_question_garden_answer", {
    p_question_id: question.id,
    p_user_id: authorized.access.user.id,
    p_answer_text: question.response_type === "choice" ? null : parsed.data.answerText,
    p_selected_option: question.response_type === "choice" ? parsed.data.selectedOption : null,
  });
  if (error) {
    console.error("Question Garden answer operation failed", { operation: "submit_answer", code: error.code });
    return { ok: false as const, reason: "unavailable" as const };
  }
  const detail = await loadAuthorizedGardenQuestion(authorized, question.id, question);
  return detail.ok ? { ok: true as const, detail: detail.detail, summary: summaryFromDetail(detail.detail) } : detail;
}

export async function updateSealedGardenAnswer(input: unknown) {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: "invalid" as const };
  const authorized = await authorizeQuestionGarden();
  if (!authorized) return { ok: false as const, reason: "unauthorized" as const };
  const question = await loadQuestion(authorized, parsed.data.questionId);
  if (!question || !validValue(question, parsed.data.answerText, parsed.data.selectedOption, true)) {
    return { ok: false as const, reason: "invalid" as const };
  }
  const { data: existing, error: loadError } = await authorized.admin.from("question_garden_answers")
    .select("id,status,submitted_at,revealed_at,updated_at")
    .eq("question_id", question.id)
    .eq("user_id", authorized.access.user.id)
    .maybeSingle();
  if (loadError) return { ok: false as const, reason: "unavailable" as const };
  if (!existing || existing.status !== "submitted") return { ok: false as const, reason: "invalid" as const };
  if (existing.revealed_at) return { ok: false as const, reason: "sealed" as const };
  if (existing.updated_at !== parsed.data.expectedUpdatedAt) {
    return { ok: false as const, reason: "conflict" as const, currentUpdatedAt: existing.updated_at };
  }
  const value = question.response_type === "choice"
    ? { answer_text: null, selected_option: parsed.data.selectedOption }
    : { answer_text: parsed.data.answerText, selected_option: null };
  const { data: updated, error } = await authorized.admin.from("question_garden_answers")
    .update(value)
    .eq("id", existing.id)
    .eq("user_id", authorized.access.user.id)
    .eq("status", "submitted")
    .is("revealed_at", null)
    .eq("updated_at", existing.updated_at)
    .select("updated_at,submitted_at,status,revealed_at")
    .maybeSingle();
  if (error) {
    console.error("Question Garden answer operation failed", { operation: "update_sealed_answer", code: error.code });
    return { ok: false as const, reason: "unavailable" as const };
  }
  if (!updated) {
    const { data: current } = await authorized.admin.from("question_garden_answers")
      .select("updated_at,revealed_at").eq("id", existing.id).maybeSingle();
    return current?.revealed_at
      ? { ok: false as const, reason: "sealed" as const }
      : { ok: false as const, reason: "conflict" as const, currentUpdatedAt: current?.updated_at };
  }
  const detail = await loadAuthorizedGardenQuestion(authorized, question.id, question);
  return detail.ok
    ? {
        ok: true as const,
        detail: detail.detail,
        summary: summaryFromDetail(detail.detail),
        updatedAt: updated.updated_at,
        submittedAt: updated.submitted_at,
      }
    : detail;
}

export async function skipGardenAnswer(questionId: string) {
  const parsed = questionIdSchema.safeParse(questionId);
  const authorized = await authorizeQuestionGarden();
  if (!authorized) return { ok: false as const, reason: "unauthorized" as const };
  if (!parsed.success || !(await loadQuestion(authorized, parsed.data))) return { ok: false as const, reason: "invalid" as const };
  const { data: existing } = await authorized.admin.from("question_garden_answers")
    .select("id,revealed_at").eq("question_id", parsed.data).eq("user_id", authorized.access.user.id).maybeSingle();
  if (existing?.revealed_at) return { ok: false as const, reason: "sealed" as const };
  const query = existing
    ? authorized.admin.from("question_garden_answers").update({ status: "skipped" }).eq("id", existing.id)
    : authorized.admin.from("question_garden_answers").insert({ question_id: parsed.data, user_id: authorized.access.user.id, status: "skipped" });
  const { error } = await query;
  if (error) return { ok: false as const, reason: "unavailable" as const };
  return { ok: true as const, summary: await safeSummary(authorized, parsed.data) };
}

export async function persistGardenPosition(category: string, questionId: string | null) {
  const authorized = await authorizeQuestionGarden();
  const parsedCategory = z.enum(QUESTION_GARDEN_CATEGORIES).safeParse(category);
  const parsedQuestion = questionId === null ? null : questionIdSchema.safeParse(questionId);
  if (!authorized || !parsedCategory.success || (parsedQuestion && !parsedQuestion.success)) return false;
  const { error } = await authorized.admin.from("question_garden_member_state").upsert({
    user_id: authorized.access.user.id,
    last_category: parsedCategory.data,
    last_question_id: parsedQuestion?.data ?? null,
    last_visited_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  return !error;
}

const reactionSchema = z.enum(["heart", "laugh", "sparkle", "emotional"]);
async function isBloom(authorized: AuthorizedGarden, questionId: string) {
  const { data } = await authorized.admin.from("question_garden_answers")
    .select("user_id,revealed_at").eq("question_id", questionId).eq("status", "submitted");
  return (data?.length ?? 0) >= 2 && data!.every((answer) => answer.revealed_at);
}
async function safeReactions(authorized: AuthorizedGarden, questionId: string): Promise<GardenReactionView[]> {
  const { data } = await authorized.admin.from("question_garden_reactions")
    .select("user_id,reaction").eq("question_id", questionId);
  return (data ?? []).map((item) => ({ owner: item.user_id === authorized.access.user.id ? "you" : "partner", reaction: item.reaction }));
}

export async function persistGardenReaction(questionId: string, reaction: string) {
  const authorized = await authorizeQuestionGarden();
  const parsedId = questionIdSchema.safeParse(questionId);
  const parsedReaction = reactionSchema.safeParse(reaction);
  if (!authorized) return { ok: false as const, reason: "unauthorized" as const };
  if (!parsedId.success || !parsedReaction.success || !(await isBloom(authorized, parsedId.data))) return { ok: false as const, reason: "invalid" as const };
  const { error } = await authorized.admin.from("question_garden_reactions").upsert({
    question_id: parsedId.data, user_id: authorized.access.user.id, reaction: parsedReaction.data,
  }, { onConflict: "question_id,user_id" });
  if (error) return { ok: false as const, reason: "unavailable" as const };
  return { ok: true as const, reactions: await safeReactions(authorized, parsedId.data) };
}

export async function persistGardenFollowUp(questionId: string, note: string) {
  const authorized = await authorizeQuestionGarden();
  const parsedId = questionIdSchema.safeParse(questionId);
  const parsedNote = z.string().max(2000).safeParse(note);
  if (!authorized) return { ok: false as const, reason: "unauthorized" as const };
  if (!parsedId.success || !parsedNote.success || !(await isBloom(authorized, parsedId.data))) return { ok: false as const, reason: "invalid" as const };
  const { data, error } = await authorized.admin.from("question_garden_answers")
    .update({ follow_up_note: parsedNote.data || null })
    .eq("question_id", parsedId.data).eq("user_id", authorized.access.user.id).not("revealed_at", "is", null)
    .select("updated_at").maybeSingle();
  return error || !data ? { ok: false as const, reason: "unavailable" as const } : { ok: true as const, updatedAt: data.updated_at };
}

const customQuestionSchema = z.object({
  id: questionIdSchema.nullable(),
  category: z.enum(QUESTION_GARDEN_CATEGORIES),
  prompt: z.string().trim().min(1).max(500),
  responseType: z.enum(["long_text", "short_text", "choice"]),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(8).nullable(),
  personalNote: z.string().max(1000),
});
export async function persistCustomGardenQuestion(input: unknown) {
  const parsed = customQuestionSchema.safeParse(input);
  const authorized = await authorizeQuestionGarden();
  if (!authorized) return { ok: false as const, reason: "unauthorized" as const };
  if (!parsed.success || (parsed.data.responseType === "choice") !== Boolean(parsed.data.options)) return { ok: false as const, reason: "invalid" as const };
  if (parsed.data.options && new Set(parsed.data.options.map((option) => option.toLowerCase())).size !== parsed.data.options.length) return { ok: false as const, reason: "invalid" as const };
  const value = {
    category: parsed.data.category, prompt: parsed.data.prompt, response_type: parsed.data.responseType,
    options: parsed.data.options, personal_note: parsed.data.personalNote || null,
  };
  if (parsed.data.id) {
    const { data: existing } = await authorized.admin.from("question_garden_questions")
      .select("id,source_type,planted_by_user_id").eq("id", parsed.data.id).maybeSingle();
    if (!existing || existing.source_type !== "custom" || existing.planted_by_user_id !== authorized.access.user.id) return { ok: false as const, reason: "unauthorized" as const };
    const { count } = await authorized.admin.from("question_garden_answers").select("id", { count: "exact", head: true }).eq("question_id", existing.id);
    if ((count ?? 0) > 0) return { ok: false as const, reason: "frozen" as const };
    const { data, error } = await authorized.admin.from("question_garden_questions").update(value).eq("id", existing.id).select("id").maybeSingle();
    return error || !data ? { ok: false as const, reason: "unavailable" as const } : { ok: true as const, id: data.id };
  }
  const { data: last } = await authorized.admin.from("question_garden_questions").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await authorized.admin.from("question_garden_questions").insert({
    ...value, source_type: "custom", planted_by_user_id: authorized.access.user.id, sort_order: Math.min((last?.sort_order ?? 25) + 1, 10000),
  }).select("id").maybeSingle();
  if (error?.code === "23505") return { ok: false as const, reason: "duplicate" as const };
  return error || !data ? { ok: false as const, reason: "unavailable" as const } : { ok: true as const, id: data.id };
}

export async function archiveCustomGardenQuestion(questionId: string) {
  const parsed = questionIdSchema.safeParse(questionId);
  const authorized = await authorizeQuestionGarden();
  if (!authorized) return { ok: false as const, reason: "unauthorized" as const };
  if (!parsed.success) return { ok: false as const, reason: "invalid" as const };
  const { data, error } = await authorized.admin.from("question_garden_questions").update({
    active: false, archived_at: new Date().toISOString(),
  }).eq("id", parsed.data).eq("source_type", "custom").eq("planted_by_user_id", authorized.access.user.id).select("id").maybeSingle();
  return error || !data ? { ok: false as const, reason: "unavailable" as const } : { ok: true as const };
}

export async function persistQuestionGardenCompletion() {
  const authorized = await authorizeQuestionGarden();
  if (!authorized) return { ok: false as const, reason: "unauthorized" as const };
  if (authorized.progress.question_garden_completed_at) return { ok: true as const, alreadyCompleted: true, navigationMetadataSaved: false };
  const { data, error } = await authorized.admin.from("user_journey_progress")
    .update({ question_garden_completed_at: new Date().toISOString() })
    .eq("user_id", authorized.access.user.id).is("question_garden_completed_at", null).select("user_id").maybeSingle();
  if (error) return { ok: false as const, reason: "completion_write_failed" as const };
  if (data?.user_id !== authorized.access.user.id) {
    const { data: current } = await authorized.admin.from("user_journey_progress")
      .select("question_garden_completed_at").eq("user_id", authorized.access.user.id).maybeSingle();
    if (current?.question_garden_completed_at) return { ok: true as const, alreadyCompleted: true, navigationMetadataSaved: false };
    return { ok: false as const, reason: "completion_write_failed" as const };
  }
  return { ok: true as const, alreadyCompleted: false, navigationMetadataSaved: false };
}
