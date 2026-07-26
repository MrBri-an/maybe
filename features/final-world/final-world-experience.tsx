"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  completeFinalWorldJourney,
  openFinalLetter,
  saveFinalLetterDraft,
  sealFinalLetter,
  withdrawFinalLetter,
  type FinalLetterView,
  type OpenedFinalLetter,
} from "@/app/the-world-i-can-give-you/actions";
import { JourneyProgressMenu } from "@/features/progression/journey-progress-menu";

const DEFAULT_TITLE = "The World I Can Give You";
const AUTOSAVE_DELAY = 900;
const STAR_LAYERS = [52, 28, 12] as const;
const FALLING_BLOOMS = 16;

function seededStyle(index: number, layer: number): CSSProperties {
  return {
    "--x": `${(index * 37 + layer * 17) % 101}%`,
    "--y": `${(index * 61 + layer * 29) % 97}%`,
    "--delay": `${-((index * 1.37 + layer) % 11).toFixed(2)}s`,
    "--duration": `${(4.6 + ((index * 13 + layer * 7) % 48) / 10).toFixed(1)}s`,
  } as CSSProperties;
}

function bloomStyle(index: number): CSSProperties {
  return {
    "--x": `${(index * 43 + 7) % 101}%`,
    "--y": `${8 + (index * 31) % 82}%`,
    "--drift": `${15 + (index * 17) % 41}px`,
    "--turn": `${80 + (index * 29) % 161}deg`,
    "--delay": `${-((index * 1.11) % 17).toFixed(2)}s`,
    "--duration": `${10 + (index * 7) % 9}s`,
  } as CSSProperties;
}

const IMPORTANT_LINES = [
  "you are worth the thought.",
  "you are worth the time.",
  "you are worth the effort.",
  "this is my world to you, jessica.",
  "the beginning of maybe.",
] as const;
const WORLD_MARKERS = ["▱", "♪", "✿", "▣", "✦", "♙", "●"] as const;

function LetterPaper({
  title,
  body,
  reader = false,
  paperRef,
  interacting = false,
  onScroll,
  onSelectionChange,
}: {
  title: string;
  body: string;
  reader?: boolean;
  paperRef?: RefObject<HTMLElement | null>;
  interacting?: boolean;
  onScroll?: () => void;
  onSelectionChange?: () => void;
}) {
  return (
    <article
      ref={paperRef}
      className={`final-letter-paper ${reader ? "is-reader" : ""} ${interacting ? "is-interacting" : ""}`}
      tabIndex={reader ? -1 : undefined}
      onScroll={onScroll}
      onPointerUp={onSelectionChange}
      onKeyUp={onSelectionChange}
    >
      <p className="final-letter-address">For Jessica</p>
      <h2>{title || DEFAULT_TITLE}</h2>
      <div>{body.split(/\n{2,}/).map((paragraph, paragraphIndex) => {
        const normalized = paragraph.replaceAll("**", "").trim().toLowerCase();
        const important = IMPORTANT_LINES.includes(normalized as (typeof IMPORTANT_LINES)[number]);
        const markerIndex = paragraphIndex % 2 === 1 ? Math.floor(paragraphIndex / 2) : -1;
        return <Fragment key={`${paragraphIndex}-${paragraph.slice(0, 12)}`}>
        <p className={important ? "is-important-line" : undefined} key={`${paragraphIndex}-${paragraph.slice(0, 12)}`}>
          {paragraph.split(/(\*\*.*?\*\*)/g).map((part, index) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={index}>{part.slice(2, -2)}</strong>
              : <Fragment key={index}>{part}</Fragment>)}
        </p>
        {reader && markerIndex >= 0 && markerIndex < WORLD_MARKERS.length
          ? <span className={`final-inline-reference is-marker-${markerIndex}`} aria-hidden="true">{WORLD_MARKERS[markerIndex]}</span>
          : null}
        </Fragment>
      })}</div>
      <footer>From Brian</footer>
    </article>
  );
}

function Envelope({ active = false, opening = false }: { active?: boolean; opening?: boolean }) {
  return (
    <article className={`final-world-envelope ${active ? "is-ready" : ""} ${opening ? "is-opening" : ""}`} aria-label="One sealed envelope for Jessica from Brian">
      <span className="envelope-paper" aria-hidden="true" />
      <span className="envelope-flap" aria-hidden="true" />
      <span className="envelope-fold is-left" aria-hidden="true" />
      <span className="envelope-fold is-right" aria-hidden="true" />
      <span className="envelope-botanical is-top" aria-hidden="true">❧</span>
      <span className="envelope-botanical is-bottom" aria-hidden="true">❧</span>
      <span className="envelope-wax" aria-hidden="true"><i /><i /><b>♥</b></span>
      <div className="envelope-label"><p>For Jessica</p><small>From Brian</small></div>
    </article>
  );
}

function AuthorExperience({
  initialLetter,
}: {
  initialLetter: Extract<FinalLetterView, { audience: "author" }>;
}) {
  const initialDraft = initialLetter.status === "none" ? null : initialLetter;
  const [letter, setLetter] = useState(initialLetter);
  const [editing, setEditing] = useState(initialLetter.status === "draft");
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState(initialDraft?.title ?? DEFAULT_TITLE);
  const [body, setBody] = useState(initialDraft?.body ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sealing, setSealing] = useState(false);
  const [message, setMessage] = useState("");
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const queuedRef = useRef<{ title: string; body: string; revision: number } | null>(null);
  const idleResolversRef = useRef<Array<() => void>>([]);
  const revisionRef = useRef(0);
  const mountedRef = useRef(true);
  const actionLockRef = useRef(false);

  const runSave = useCallback(async (draft: { title: string; body: string; revision: number }) => {
    if (inFlightRef.current) {
      queuedRef.current = draft;
      return;
    }
    inFlightRef.current = true;
    let current: typeof draft | null = draft;
    while (current) {
      if (current.title.trim() && current.body.trim()) {
        if (mountedRef.current) setSaveState("saving");
        const result = await saveFinalLetterDraft({ title: current.title, body: current.body });
        if (!mountedRef.current) break;
        if (result.ok) {
          if (current.revision === revisionRef.current) {
            setLetter(result.letter as Extract<FinalLetterView, { audience: "author" }>);
            setSaveState("saved");
            setMessage("Draft saved privately.");
          }
        } else if (current.revision === revisionRef.current) {
          setSaveState("error");
          setMessage(result.error);
        }
      }
      const queued = queuedRef.current;
      queuedRef.current = null;
      current = queued && queued.revision > current.revision ? queued : null;
    }
    inFlightRef.current = false;
    idleResolversRef.current.splice(0).forEach((resolve) => resolve());
  }, []);

  const waitForSaveIdle = useCallback(() => inFlightRef.current
    ? new Promise<void>((resolve) => idleResolversRef.current.push(resolve))
    : Promise.resolve(), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editing || !title.trim() || !body.trim()) return;
    revisionRef.current += 1;
    const revision = revisionRef.current;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void runSave({ title, body, revision });
    }, AUTOSAVE_DELAY);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [body, editing, runSave, title]);

  useEffect(() => {
    if (!preview) return;
    const closePreview = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(false);
    };
    document.addEventListener("keydown", closePreview);
    return () => document.removeEventListener("keydown", closePreview);
  }, [preview]);

  const saveNow = async () => {
    if (actionLockRef.current || !title.trim() || !body.trim()) return;
    actionLockRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    revisionRef.current += 1;
    await runSave({ title, body, revision: revisionRef.current });
    await waitForSaveIdle();
    actionLockRef.current = false;
  };

  const seal = async () => {
    if (actionLockRef.current || !title.trim() || !body.trim()) return;
    if (!window.confirm("Seal this letter for Jessica? Normal editing will no longer be available.")) return;
    actionLockRef.current = true;
    setSealing(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    revisionRef.current += 1;
    queuedRef.current = null;
    await waitForSaveIdle();
    const result = await sealFinalLetter({ title, body });
    if (result.ok) {
      setLetter(result.letter as Extract<FinalLetterView, { audience: "author" }>);
      setEditing(false);
      setPreview(false);
      setMessage("The letter is sealed and waiting for Jessica.");
      setSaveState("saved");
    } else {
      setSaveState("error");
      setMessage(result.error);
    }
    setSealing(false);
    actionLockRef.current = false;
  };

  const withdraw = async () => {
    if (actionLockRef.current || !window.confirm("Withdraw this sealed letter before Jessica opens it?")) return;
    actionLockRef.current = true;
    const result = await withdrawFinalLetter();
    if (result.ok) {
      setLetter({ audience: "author", status: "none" });
      setTitle(DEFAULT_TITLE);
      setBody("");
      setPreview(false);
      setMessage("The sealed letter was withdrawn.");
    } else setMessage(result.error);
    actionLockRef.current = false;
  };

  if (letter.status === "none" && !editing) {
    return <section className="final-author-panel"><p>One letter. Written privately, when you are ready.</p><button type="button" onClick={() => setEditing(true)}>Begin the letter</button></section>;
  }

  if (preview) {
    return <section className="final-letter-preview" aria-label="Author letter preview">
      <LetterPaper title={title} body={body} />
      <div className="final-letter-controls"><button type="button" onClick={() => setPreview(false)}>Return to {editing ? "editor" : "desk"}</button></div>
    </section>;
  }

  if (letter.status === "sealed" || letter.status === "opened") {
    return <section className="final-author-panel final-author-status">
      <div className="final-world-envelope-anchor"><Envelope active /></div>
      <h2>{letter.status === "opened" ? "Jessica opened your letter" : "Your letter is waiting for Jessica"}</h2>
      <p>{letter.status === "opened" && letter.openedAt ? `Opened ${new Date(letter.openedAt).toLocaleString()}` : letter.sealedAt ? `Sealed ${new Date(letter.sealedAt).toLocaleString()}` : "Sealed privately."}</p>
      <div className="final-letter-controls">
        <button type="button" onClick={() => setPreview(true)}>Preview authored letter</button>
        {letter.status === "sealed" ? <button type="button" className="is-danger" onClick={withdraw}>Withdraw letter</button> : null}
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>;
  }

  const incompleteReason = !title.trim() ? "Add a title before sealing." : !body.trim() ? "Write the letter before sealing." : "";
  return <section className="final-letter-editor" aria-label="Private final letter editor">
    <header><div><p>Private writing desk</p><h2>A letter, held only here.</h2></div><span className={`is-${saveState}`} role="status">{sealing ? "Sealing…" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "Private draft"}</span></header>
    <div className="final-stationery-sheet">
    <span className="final-stationery-flourish" aria-hidden="true">❧</span>
    <label>Title<input value={title} onChange={(event) => { setTitle(event.target.value); setSaveState("idle"); setMessage(""); }} maxLength={160} autoComplete="off" /></label>
    <label>Letter body<textarea value={body} onChange={(event) => { setBody(event.target.value); setSaveState("idle"); setMessage(""); }} maxLength={12000} rows={14} placeholder="Write what belongs only here…" /></label>
    <div className="final-letter-count">{body.length.toLocaleString()} / 12,000</div>
    </div>
    <div className="final-letter-controls">
      <button type="button" onClick={saveNow} disabled={!title.trim() || !body.trim() || sealing}>Save draft</button>
      <button type="button" onClick={() => setPreview(true)} disabled={!body.trim()}>Preview</button>
      <button type="button" className="is-primary" onClick={seal} disabled={Boolean(incompleteReason) || sealing} title={incompleteReason || "Save the latest words and seal the letter"}>Seal letter</button>
    </div>
    {incompleteReason ? <p className="final-seal-reason">{incompleteReason}</p> : null}
    {message ? <p className="final-letter-message" role={saveState === "error" ? "alert" : "status"}>{message}</p> : null}
  </section>;
}

function RecipientExperience({
  letter,
}: {
  letter: Extract<FinalLetterView, { audience: "recipient" }>;
}) {
  const [openedLetter, setOpenedLetter] = useState<OpenedFinalLetter | null>(null);
  const [phase, setPhase] = useState<"closed" | "opening" | "reading" | "error">("closed");
  const [message, setMessage] = useState("");
  const [interacting, setInteracting] = useState(false);
  const openLockRef = useRef(false);
  const minimumTimerRef = useRef<number | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const paperRef = useRef<HTMLElement>(null);

  useEffect(() => () => {
    if (minimumTimerRef.current !== null) window.clearTimeout(minimumTimerRef.current);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
  }, []);

  const open = async () => {
    if (openLockRef.current) return;
    openLockRef.current = true;
    setPhase("opening");
    setMessage("Opening your private letter…");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minimumAnimation = new Promise<void>((resolve) => {
      minimumTimerRef.current = window.setTimeout(resolve, reducedMotion ? 80 : 820);
    });
    const [result] = await Promise.all([openFinalLetter(), minimumAnimation]);
    minimumTimerRef.current = null;
    if (result.ok) {
      setOpenedLetter(result.letter);
      setPhase("reading");
      setMessage("Your letter is open.");
      window.requestAnimationFrame(() => paperRef.current?.focus());
    } else {
      setPhase("error");
      setMessage(result.error);
    }
    openLockRef.current = false;
  };

  const pauseForScroll = () => {
    setInteracting(true);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => setInteracting(false), 500);
  };

  const syncSelection = () => {
    const selection = window.getSelection();
    setInteracting(Boolean(selection && !selection.isCollapsed && paperRef.current?.contains(selection.anchorNode)));
  };

  if (letter.status === "waiting") {
    return <section className="final-recipient-waiting"><div className="final-world-envelope-anchor is-muted"><Envelope /></div><h2>Some words are still being written for you.</h2><p>This quiet room will keep them private until they are ready.</p></section>;
  }

  if (phase === "reading" && openedLetter) {
    return <section className="final-recipient-reader" aria-label="Your opened letter">
      <div className="final-reader-envelope" aria-hidden="true"><Envelope active /></div>
      <LetterPaper title={openedLetter.title} body={openedLetter.body} reader paperRef={paperRef} interacting={interacting} onScroll={pauseForScroll} onSelectionChange={syncSelection} />
      <div className="final-reader-actions">
        <Link href="/?view=world">Return to World</Link>
      </div>
      <p className="sr-only" role="status">{message}</p>
    </section>;
  }

  const previouslyOpened = letter.status === "opened";
  return <section className={`final-recipient-envelope is-${phase}`} aria-busy={phase === "opening"}>
    <div className="final-world-envelope-anchor"><Envelope active opening={phase === "opening"} /></div>
    <button type="button" className="final-world-open-placeholder" onClick={open} disabled={phase === "opening"} aria-label={previouslyOpened ? "Read the letter again" : "Open my letter"}>
      {phase === "opening" ? "Opening…" : previouslyOpened ? "Read the letter again" : "Open my letter"}
    </button>
    <p id="final-recipient-note" className="final-world-placeholder-note" role={phase === "error" ? "alert" : "status"}>{message || (previouslyOpened ? "The letter remains here whenever you want to return." : "Only you can open this letter.")}</p>
  </section>;
}

export function FinalWorldExperience({ initialLetter, finalWorldCompleted }: { initialLetter: FinalLetterView; finalWorldCompleted: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [completed, setCompleted] = useState(finalWorldCompleted);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [completionMoment, setCompletionMoment] = useState(false);
  const completionLockRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);
  const completionDialogRef = useRef<HTMLDivElement>(null);
  const completionTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const syncVisibility = () => setHidden(document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    if (!completionOpen) return;
    const trigger = completionTriggerRef.current;
    completionDialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCompletionOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = completionDialogRef.current?.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [completionOpen]);

  useEffect(() => () => {
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
  }, []);

  const completeJourney = async () => {
    if (completed) {
      setCompletionOpen(true);
      return;
    }
    if (completionLockRef.current) return;
    completionLockRef.current = true;
    setCompletionPending(true);
    setCompletionError("");
    const result = await completeFinalWorldJourney();
    if (result.ok) {
      setCompleted(true);
      setCompletionMoment(true);
      setCompletionOpen(true);
      completionTimerRef.current = window.setTimeout(() => setCompletionMoment(false), 1500);
    } else setCompletionError(result.error);
    setCompletionPending(false);
    completionLockRef.current = false;
  };

  return (
    <main className={`final-world-room ${hidden ? "is-paused" : ""} ${completed ? "is-journey-complete" : ""} ${completionMoment ? "is-completing" : ""}`}>
      <div className="final-world-sky" aria-hidden="true"><span className="final-world-moon" /></div>
      <div className="final-world-stars" aria-hidden="true">
        {STAR_LAYERS.map((count, layer) => <div className={`star-layer is-layer-${layer}`} key={layer}>
          {Array.from({ length: count }, (_, index) => <i className={layer === 2 && index % 3 === 0 ? "is-cross" : ""} style={seededStyle(index, layer)} key={index} />)}
        </div>)}
      </div>
      <div className="final-world-falling-blooms" aria-hidden="true">
        {Array.from({ length: FALLING_BLOOMS }, (_, index) => <i className={index % 5 === 0 ? "is-flower" : `is-petal is-tone-${index % 4}`} style={bloomStyle(index)} key={index}>{index % 5 === 0 ? "✿" : ""}</i>)}
      </div>
      <div className="final-world-constellations" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
      <div className="final-world-curtain" aria-hidden="true" />
      <header className="final-world-toolbar">
        <Link href="/?view=world">Return to World</Link>
        <button ref={completionTriggerRef} type="button" disabled={completionPending} aria-busy={completionPending} onClick={() => void completeJourney()}>{completionPending ? "Completing…" : completed ? "Journey complete" : "Complete journey"}</button>
        <JourneyProgressMenu storybookCompleted libraryCompleted puzzleRoomCompleted radioCompleted questionGardenCompleted galleryCompleted herUniverseCompleted maybeDaysCompleted ourCornerCompleted finalWorldCompleted={completed} />
      </header>
      {completionError ? <p className="final-completion-error" role="alert">{completionError}</p> : null}
      <section className="final-world-copy">
        <p>The tenth world</p>
        <h1>The World I Can Give You</h1>
        <blockquote>People promise the world all the time. I wanted to give you one I could actually make.</blockquote>
      </section>
      <section className="final-world-desk" aria-label="A private writing desk">
        <div className="final-world-path" aria-hidden="true" />
        <div className="final-world-lamp float-object" aria-hidden="true"><i /><span /></div>
        <div className="final-world-flowers float-object" aria-hidden="true"><i /><i /><i /></div>
        <div className="final-world-ink float-object" aria-hidden="true"><i /></div>
        {initialLetter.audience === "author"
          ? <AuthorExperience initialLetter={initialLetter} />
          : <RecipientExperience letter={initialLetter} />}
      </section>
      <div className="final-world-fireflies" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</div>
      <div className="final-world-papers" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
      {completionOpen ? <div className="final-world-completion" role="presentation">
        <div ref={completionDialogRef} className="room-completion-panel" role="dialog" aria-modal="true" aria-labelledby="final-completion-title" tabIndex={-1}>
          <span aria-hidden="true">✦</span>
          <div>
            <h2 id="final-completion-title">The world is yours now</h2>
            <p>Every room will remain open, every memory will remain waiting, and every new beginning can still become part of this world.</p>
            {completionError ? <p role="alert">{completionError}</p> : null}
            <div className="room-completion-actions">
              <Link href="/?view=world">Return to the World</Link>
              <button type="button" onClick={() => setCompletionOpen(false)}>Visit the Final Letter</button>
              <Link href="/story">Begin again from the Storybook</Link>
            </div>
          </div>
        </div>
      </div> : null}
    </main>
  );
}
