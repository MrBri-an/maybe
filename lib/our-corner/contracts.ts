export type CornerMessageKind = "text" | "voice" | "shared";

export type CornerReplyView = {
  ref: string;
  senderLabel: "you" | "Brian" | "Jessica";
  excerpt: string;
  kind: CornerMessageKind;
};

export type CornerMessageView = {
  ref: string;
  clientMessageId: string;
  kind: CornerMessageKind;
  body: string | null;
  senderLabel: "you" | "Brian" | "Jessica";
  isOwn: boolean;
  reply: CornerReplyView | null;
  heartCount: number;
  ownHeart: boolean;
  readByMe: boolean;
  readByOther: boolean;
  createdAt: string;
  editedAt: string | null;
  archivedAt: string | null;
  voice: { durationSeconds: number; sizeBytes: number; mimeType: string; waveform: number[] } | null;
  shared: { type: "gallery" | "radio" | "maybe-days" | "her-universe"; title: string; detail: string; href: string; available: boolean } | null;
};

export type CornerMessagePage = {
  messages: CornerMessageView[];
  nextCursor: string | null;
};

export type CornerStateResult =
  | { ok: true; conversationRef: string; peerLabel: "Brian" | "Jessica"; page: CornerMessagePage }
  | { ok: false; error: string };

export type CornerMessageResult =
  | { ok: true; message: CornerMessageView }
  | { ok: false; error: string };

export type CornerMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export type CornerVoicePreparation =
  | { ok: true; signedUrl: string; ticket: string }
  | { ok: false; error: string };

export type CornerVoiceUrlResult =
  | { ok: true; signedUrl: string; expiresAt: string }
  | { ok: false; error: string };

export type CornerShareKind = "gallery" | "radio" | "maybe-days" | "her-universe";
export type CornerShareItem = { ref: string; kind: CornerShareKind; title: string; detail: string };
export type CornerSharePage = { items: CornerShareItem[]; nextCursor: number | null };

export type CornerPinView = { message: CornerMessageView; pinnedAt: string };
export type CornerDailyNoteView = { body: string; authorLabel: "you" | "Brian" | "Jessica"; isOwn: boolean; updatedAt: string };
export type CornerMood = "Happy" | "Calm" | "Tired" | "Missing you" | "Stressed" | "Excited" | "Quiet";
export type CornerMoodView = { mood: CornerMood; authorLabel: "you" | "Brian" | "Jessica"; isOwn: boolean };
export type CornerFeaturesResult =
  | { ok: true; pins: CornerPinView[]; notes: CornerDailyNoteView[]; moods: CornerMoodView[] }
  | { ok: false; error: string };
