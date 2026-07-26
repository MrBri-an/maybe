export type MaybeDayCategory = "conversation" | "creative" | "games" | "music" | "photos" | "watch-together";
export type MaybeDayStatus = "selected" | "started" | "completed" | "skipped";

export type MaybeDayActivityView = {
  slug: string;
  title: string;
  prompt: string;
  category: MaybeDayCategory;
  iconKey: string;
  estimatedMinutes: number | null;
  requiresVoice: boolean;
  requiresVideo: boolean;
};

export type MaybeDayCheckinView = {
  label: "you" | "Brian" | "Jessica";
  confirmed: boolean;
  isOwn: boolean;
};

export type MaybeDayCommentView = {
  ref: string;
  body: string;
  authorLabel: "you" | "Brian" | "Jessica";
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MaybeDayDrawView = {
  ref: string;
  status: MaybeDayStatus;
  selectedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  skipReason: string | null;
  selectedBy: "you" | "Brian" | "Jessica";
  activity: MaybeDayActivityView;
  checkins: MaybeDayCheckinView[];
  comments: MaybeDayCommentView[];
  heartCount: number;
  ownHeart: boolean;
};

export type MaybeDayHistoryPage = {
  items: MaybeDayDrawView[];
  nextCursor: string | null;
};

export type MaybeDaysStateResult =
  | {
    ok: true;
    activities: MaybeDayActivityView[];
    activeDraw: MaybeDayDrawView | null;
    completed: MaybeDayHistoryPage;
    skipped: MaybeDayHistoryPage;
  }
  | { ok: false; error: string };

export type MaybeDayDrawResult =
  | { ok: true; draw: MaybeDayDrawView }
  | { ok: false; error: string };

export type MaybeDayHistoryResult =
  | { ok: true; page: MaybeDayHistoryPage }
  | { ok: false; error: string };

export type MaybeDayCommentResult =
  | { ok: true; comment: MaybeDayCommentView }
  | { ok: false; error: string };

export type MaybeDayMutationResult =
  | { ok: true }
  | { ok: false; error: string };
