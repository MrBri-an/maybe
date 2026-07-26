"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  addHerUniverseMessage,
  loadCelestialObjectWords,
  setHerUniverseReaction,
  updateHerUniverseMessage,
} from "@/app/her-universe/actions";
import { CURATED_UNIVERSE_MESSAGES } from "@/lib/her-universe/curated-messages";
import type {
  HerUniverseMessageView,
  HerUniverseObjectDetail,
  HerUniverseObjectView,
} from "@/lib/her-universe/contracts";

type ObjectInteriorProps = {
  object: HerUniverseObjectView;
  index: number;
  total: number;
  caption: string;
  cached?: HerUniverseObjectDetail;
  adjacentSlugs: string[];
  onCache: (slug: string, detail: HerUniverseObjectDetail) => void;
  onPrevious: () => void;
  onNext: () => void;
  onReturn: () => void;
};

function safeError(error: string) {
  if (error === "unauthorized") return "Your session could not be authorized.";
  if (error === "invalid") return "Add a comment before saving.";
  if (error === "forbidden") return "Only the author can change this comment.";
  return "Your comment could not be saved just now. Your words are still here.";
}

function useDialogLifecycle(onClose: () => void, pending: boolean) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = document.querySelector<HTMLElement>(".her-panel-backdrop:last-of-type .her-message-panel");
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, [tabindex]:not([tabindex='-1'])");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, pending]);
}

function floatStyle(index: number) {
  return {
    "--word-duration": `${3 + (index % 4)}s`,
    "--word-x": `${6 + (index % 4) * 3}px`,
    "--word-y": `${12 + (index % 5) * 3}px`,
    "--word-rotate": `${1 + (index % 3)}deg`,
    "--word-delay": `${-.4 - (index % 6) * .53}s`,
  } as CSSProperties;
}

export function ObjectInterior({
  object,
  index,
  total,
  caption,
  cached,
  adjacentSlugs,
  onCache,
  onPrevious,
  onNext,
  onReturn,
}: ObjectInteriorProps) {
  const [detail, setDetail] = useState<HerUniverseObjectDetail | null>(cached ?? null);
  const [loadError, setLoadError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const requestVersion = useRef(0);
  const curated = CURATED_UNIVERSE_MESSAGES[object.slug] ?? [];

  useEffect(() => {
    if (cached) return;
    const version = ++requestVersion.current;
    const requestedSlugs = [object.slug, ...adjacentSlugs].filter((slug, item, list) => list.indexOf(slug) === item);
    void loadCelestialObjectWords(requestedSlugs).then((result) => {
      if (version !== requestVersion.current) return;
      if (!result.ok) {
        setLoadError("Shared comments could not be gathered just now.");
        return;
      }
      Object.entries(result.details).forEach(([slug, nextDetail]) => onCache(slug, nextDetail));
      setDetail(result.details[object.slug] ?? { messages: [] });
    });
    return () => { requestVersion.current += 1; };
  }, [adjacentSlugs, cached, object.slug, onCache]);

  const updateDetail = (next: HerUniverseObjectDetail) => {
    setDetail(next);
    onCache(object.slug, next);
  };

  const replaceMessage = (message: HerUniverseMessageView) => {
    if (!detail) return;
    updateDetail({ messages: detail.messages.map((current) => current.ref === message.ref ? message : current) });
  };

  return (
    <section className={`her-words-world is-${object.objectType}`} aria-labelledby="her-words-title">
      <div className="her-words-environment" aria-hidden="true"><i /><i /><i /><span /><span /></div>
      <header className="her-words-header">
        <p>{object.objectType.replace("_", " ")}</p>
        <h1 id="her-words-title">{object.name}</h1>
        <span>{object.slug === "north-star" ? "This is the light everything else seems to lead back to." : object.slug === "unnamed-star" ? "There are still stories, thoughts and versions of you I have not met." : caption}</span>
        <small>Light {index + 1} of {total}</small>
      </header>

      <MessageSection title="Words written into this universe" className="is-curated">
        {curated.map((message, messageIndex) => (
          <div className="her-word-cell" key={message}>
            <CuratedWord body={message} index={messageIndex} />
          </div>
        ))}
      </MessageSection>

      <MessageSection title="Words we have added" className="is-shared" busy={!detail && !loadError}>
        {!detail && !loadError ? Array.from({ length: 2 }, (_, item) => <i key={item} className="her-word-skeleton" aria-hidden="true" />) : null}
        {loadError ? <p className="her-words-empty">{loadError}</p> : null}
        {detail && !detail.messages.length ? <p className="her-words-empty">No shared comments yet. You can leave the first one.</p> : null}
        {detail?.messages.map((message, messageIndex) => (
          <div className="her-word-cell" key={message.ref}>
            <SharedWord
              message={message}
              index={messageIndex + curated.length}
              onReplace={replaceMessage}
              announce={setAnnouncement}
            />
          </div>
        ))}
      </MessageSection>

      <div className="her-words-actions">
        <button type="button" onClick={() => setComposerOpen(true)}>Drop a comment</button>
      </div>
      <nav className="her-object-navigation" aria-label="Celestial object navigation">
        <button type="button" onClick={onPrevious}>Previous object</button>
        <button type="button" onClick={onReturn}>Universe map</button>
        <button type="button" onClick={onNext}>Next object</button>
      </nav>

      {composerOpen ? <MessageComposer
        slug={object.slug}
        onClose={() => setComposerOpen(false)}
        onSaved={(message) => {
          updateDetail({ messages: [...(detail?.messages ?? []), message] });
          setAnnouncement("Your comment joined this universe.");
          setComposerOpen(false);
        }}
      /> : null}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </section>
  );
}

function MessageSection({ title, className, busy, children }: { title: string; className: string; busy?: boolean; children: ReactNode }) {
  return <section className={`her-message-section ${className}`} aria-labelledby={`section-${className}`}>
    <h2 id={`section-${className}`}>{title}</h2>
    <div className="her-floating-wall" aria-busy={busy}>{children}</div>
  </section>;
}

function CuratedWord({ body, index }: { body: string; index: number }) {
  const [hearted, setHearted] = useState(false);
  return <article className="her-floating-word is-curated" style={floatStyle(index)} tabIndex={0}>
    <p>{body}</p>
    <footer className="her-word-footer">
      <span>Written into this universe</span>
      <button type="button" className="her-heart-button" aria-label={hearted ? "Remove heart" : "Heart this message"} aria-pressed={hearted} onClick={() => setHearted((current) => !current)}>
        <span aria-hidden="true">{hearted ? "❤️" : "♡"}</span><small>{hearted ? 1 : 0}</small>
      </button>
    </footer>
  </article>;
}

function SharedWord({ message, index, onReplace, announce }: {
  message: HerUniverseMessageView;
  index: number;
  onReplace: (message: HerUniverseMessageView) => void;
  announce: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);

  const toggleHeart = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    const wasHearted = message.ownReaction === "heart";
    const optimistic = {
      ...message,
      ownReaction: wasHearted ? null : "heart" as const,
      reactionCount: Math.max(0, message.reactionCount + (wasHearted ? -1 : 1)),
    };
    onReplace(optimistic);
    try {
      const result = await setHerUniverseReaction(message.ref, wasHearted ? null : "heart");
      if (!result.ok) {
        onReplace(message);
        announce(safeError(result.error));
      } else {
        announce(wasHearted ? "Your heart was removed." : "Your heart was added.");
      }
    } catch {
      onReplace(message);
      announce("Your heart could not be updated just now.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  return (
    <article className={`her-floating-word is-shared ${editing ? "is-editing" : ""}`} style={floatStyle(index)} tabIndex={0}>
      <p>{message.body}</p>
      <footer className="her-word-footer">
        <span>{message.isOwn ? "Added by you" : `Added by ${message.authorLabel}`}</span>
        <div>
          <button type="button" className="her-heart-button" disabled={pending} aria-label={message.ownReaction === "heart" ? "Remove heart" : "Heart this comment"} aria-pressed={message.ownReaction === "heart"} onClick={() => void toggleHeart()}>
            <span aria-hidden="true">{message.ownReaction === "heart" ? "❤️" : "♡"}</span><small>{message.reactionCount}</small>
          </button>
          {message.isOwn ? <button type="button" className="her-edit-button" onClick={() => setEditing(true)}>Edit</button> : null}
        </div>
      </footer>
      {editing ? <MessageComposer
        initial={message}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          onReplace(updated);
          announce("Your comment was updated.");
          setEditing(false);
        }}
      /> : null}
    </article>
  );
}

function MessageComposer({ slug, initial, onClose, onSaved }: {
  slug?: string;
  initial?: HerUniverseMessageView;
  onClose: () => void;
  onSaved: (message: HerUniverseMessageView) => void;
}) {
  const [body, setBody] = useState(initial?.body ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  useDialogLifecycle(onClose, pending);

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const result = initial
        ? await updateHerUniverseMessage(initial.ref, body, initial.animationVariant)
        : await addHerUniverseMessage(slug ?? "", body, "drift");
      if (!result.ok || !result.message) {
        setError(safeError(result.ok ? "unavailable" : result.error));
        return;
      }
      onSaved(result.message);
    } catch {
      setError("Your comment could not be saved just now. Your words are still here.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  return <div className="her-panel-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <section className="her-message-panel" role="dialog" aria-modal="true" aria-label={initial ? "Edit comment" : "Drop a comment"}>
      <header>
        <div><p>{initial ? "Edit your comment" : "A little note for this light"}</p><h2>{initial ? "Make it feel true to you" : "Drop a comment"}</h2></div>
        <button type="button" disabled={pending} onClick={onClose} aria-label="Close">×</button>
      </header>
      <label>What would you like to add?<textarea autoFocus maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write something warm and true…" /></label>
      <span>{body.length}/4000</span>
      {error ? <p role="alert">{error}</p> : null}
      <footer>
        <button type="button" disabled={pending} onClick={onClose}>Keep for later</button>
        <button type="button" disabled={pending || !body.trim()} onClick={() => void save()}>{pending ? "Adding…" : initial ? "Save changes" : "Add comment"}</button>
      </footer>
    </section>
  </div>;
}
