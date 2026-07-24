export const QUESTION_GARDEN_CATEGORIES = [
  "How We Began",
  "Little Things",
  "Dreams and the Future",
  "You, Me and Us",
  "Fun and Unexpected",
] as const;

export type QuestionGardenCategory = (typeof QUESTION_GARDEN_CATEGORIES)[number];
export type GardenQuestionState = "seed" | "bud" | "bloom";
export type GardenResponseType = "long_text" | "short_text" | "choice";
export type GardenReaction = "heart" | "laugh" | "sparkle" | "emotional";

export type GardenQuestionPreview = {
  id: string;
  category: QuestionGardenCategory;
  prompt: string;
  responseType: GardenResponseType;
  options: string[] | null;
  sortOrder: number;
  sourceType: "curated" | "custom";
  personalNote: string | null;
  isPlanter: boolean;
  hasAnyAnswer: boolean;
  state: GardenQuestionState;
  ownStatus: "draft" | "submitted" | "skipped" | null;
  ownSubmitted: boolean;
  partnerSubmitted: boolean;
};

export type GardenBed = {
  category: QuestionGardenCategory;
  questions: GardenQuestionPreview[];
  counts: Record<GardenQuestionState, number>;
};

export type QuestionGardenFoundation = {
  beds: GardenBed[];
  counts: Record<GardenQuestionState, number>;
  lastCategory: QuestionGardenCategory | null;
  lastQuestionId: string | null;
};

export type GardenAnswerValue = {
  answerText: string;
  selectedOption: string | null;
};

export type GardenOwnAnswer = GardenAnswerValue & {
  status: "draft" | "submitted" | "skipped";
  updatedAt: string;
};

export type GardenRevealedAnswer = GardenAnswerValue & {
  owner: "you" | "partner";
  followUpNote: string | null;
  updatedAt: string;
};

export type GardenReactionView = { owner: "you" | "partner"; reaction: GardenReaction };

export type GardenQuestionDetail = {
  id: string;
  category: QuestionGardenCategory;
  prompt: string;
  responseType: GardenResponseType;
  options: string[] | null;
  state: GardenQuestionState;
  ownAnswer: GardenOwnAnswer | null;
  ownSubmitted: boolean;
  partnerSubmitted: boolean;
  revealedAnswers: GardenRevealedAnswer[] | null;
  reactions: GardenReactionView[];
  bloomDate: string | null;
};

export type GardenQuestionSummary = {
  id: string;
  state: GardenQuestionState;
  ownStatus: "draft" | "submitted" | "skipped" | null;
  ownSubmitted: boolean;
  partnerSubmitted: boolean;
};

export type GardenDraftResult =
  | { ok: true; updatedAt: string; status: "draft" | "submitted" }
  | { ok: false; reason: "unauthorized" | "invalid" | "sealed" | "conflict" | "unavailable"; currentUpdatedAt?: string };
