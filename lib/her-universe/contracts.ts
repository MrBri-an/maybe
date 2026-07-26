export type HerUniverseObjectType =
  | "sun"
  | "moon"
  | "galaxy"
  | "planet"
  | "nebula"
  | "constellation"
  | "ocean_moon"
  | "north_star"
  | "star";

export type HerUniverseObjectView = {
  slug: string;
  objectType: HerUniverseObjectType;
  name: string;
  caption: string;
  visualVariant: string;
  sortOrder: number;
  visited: boolean;
};

export type HerUniverseVisitResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "unavailable" };

export type HerUniverseAnimationVariant = "drift" | "orbit" | "glow" | "rise";
export type HerUniverseReaction = "heart" | "star" | "moon" | "spark";

export type HerUniverseMessageView = {
  ref: string;
  body: string;
  animationVariant: HerUniverseAnimationVariant;
  isOwn: boolean;
  authorLabel: "Brian" | "Jessica";
  ownReaction: HerUniverseReaction | null;
  reactionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type HerUniverseObjectDetail = {
  messages: HerUniverseMessageView[];
};

export type HerUniverseDetailResult =
  | { ok: true; details: Record<string, HerUniverseObjectDetail> }
  | { ok: false; error: "unauthorized" | "not_found" | "unavailable" };

export type HerUniverseMutationResult =
  | { ok: true; message?: HerUniverseMessageView; value?: string; active?: boolean }
  | { ok: false; error: "unauthorized" | "invalid" | "not_found" | "forbidden" | "unavailable" };
