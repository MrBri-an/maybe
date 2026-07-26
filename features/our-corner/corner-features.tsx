"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadOurCornerMoods,
  loadOurCornerShareItems,
  setOurCornerMood,
  shareOurCornerItem,
} from "@/app/our-corner/actions";
import type {
  CornerMessageView,
  CornerMood,
  CornerMoodView,
  CornerShareItem,
  CornerShareKind,
} from "@/lib/our-corner/contracts";

const MOODS: CornerMood[] = ["Happy", "Calm", "Tired", "Missing you", "Stressed", "Excited", "Quiet"];
const MOOD_ICONS: Record<CornerMood, string> = {
  Happy: "☀",
  Calm: "◌",
  Tired: "☾",
  "Missing you": "♡",
  Stressed: "≈",
  Excited: "✦",
  Quiet: "·",
};
const KINDS: { kind: CornerShareKind; label: string }[] = [
  { kind: "gallery", label: "Gallery" },
  { kind: "radio", label: "Jessica’s Radio" },
  { kind: "maybe-days", label: "Maybe Days" },
  { kind: "her-universe", label: "Her Universe" },
];

export function CornerMoodControl() {
  const [moods, setMoods] = useState<CornerMoodView[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const ownMood = moods.find((item) => item.isOwn)?.mood ?? null;

  const sync = useCallback(async () => {
    const current = ++version.current;
    const result = await loadOurCornerMoods();
    if (current === version.current && result.ok) setMoods(result.moods);
  }, []);

  useEffect(() => {
    void sync();
    const visible = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      version.current += 1;
      document.removeEventListener("visibilitychange", visible);
    };
  }, [sync]);

  const update = async (mood: CornerMood | null) => {
    if (pending) return;
    setPending(true);
    setError("");
    const previous = moods;
    setMoods((current) => [
      ...current.filter((item) => !item.isOwn),
      ...(mood ? [{ mood, authorLabel: "you" as const, isOwn: true }] : []),
    ]);
    const result = await setOurCornerMood(mood);
    if (!result.ok) {
      setMoods(previous);
      setError(result.error);
    }
    setPending(false);
  };

  return (
    <div className="corner-mood-control">
      <span aria-hidden="true">{ownMood ? MOOD_ICONS[ownMood] : "○"}</span>
      <label>
        <span className="sr-only">Current mood</span>
        <select aria-label="Current mood" value={ownMood ?? ""} disabled={pending} onChange={(event) => void update((event.target.value || null) as CornerMood | null)}>
          <option value="">No mood</option>
          {MOODS.map((mood) => <option key={mood}>{mood}</option>)}
        </select>
      </label>
      {moods.filter((item) => !item.isOwn).map((item) => <small key={item.authorLabel}>{item.authorLabel}: {MOOD_ICONS[item.mood]} {item.mood}</small>)}
      {error ? <span className="sr-only" role="alert">{error}</span> : null}
    </div>
  );
}

export function CornerSharePicker({ replyRef, onShared, onClose }: {
  replyRef?: string;
  onShared: (message: CornerMessageView) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<CornerShareKind>("gallery");
  const [items, setItems] = useState<CornerShareItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState("");
  const [error, setError] = useState("");
  const request = useRef(0);

  const load = useCallback(async (nextKind: CornerShareKind, offset: number) => {
    const current = ++request.current;
    const result = await loadOurCornerShareItems(nextKind, offset);
    if (current === request.current) {
      if (result.ok) {
        setItems((existing) => offset ? [...existing, ...result.page.items] : result.page.items);
        setCursor(result.page.nextCursor);
      } else setError(result.error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(kind, 0), 0);
    return () => {
      clearTimeout(timer);
      request.current += 1;
    };
  }, [kind, load]);

  const share = async (item: CornerShareItem) => {
    if (sending) return;
    setSending(item.ref);
    setError("");
    const result = await shareOurCornerItem(crypto.randomUUID(), item.ref, replyRef);
    if (result.ok) {
      onShared(result.message);
      onClose();
    } else setError(result.error);
    setSending("");
  };

  return (
    <section className="corner-share-picker" role="dialog" aria-modal="true" aria-label="Share from another world">
      <header><strong>Share something from your worlds</strong><button type="button" onClick={onClose}>Close</button></header>
      <nav aria-label="World to share from">{KINDS.map((item) => <button type="button" aria-pressed={kind === item.kind} key={item.kind} onClick={() => {
        setItems([]);
        setCursor(0);
        setLoading(true);
        setKind(item.kind);
      }}>{item.label}</button>)}</nav>
      <div className="corner-share-results">
        {items.map((item) => <button className="corner-feature-float" type="button" key={item.ref} disabled={Boolean(sending)} onClick={() => void share(item)}><strong>{item.title}</strong><span>{item.detail}</span></button>)}
        {!loading && !items.length ? <p>Nothing is available to share from here yet.</p> : null}
      </div>
      {cursor !== null ? <button type="button" disabled={loading} onClick={() => { setLoading(true); void load(kind, cursor); }}>{loading ? "Loading…" : "Load more"}</button> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
