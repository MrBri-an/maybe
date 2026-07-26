"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  addMaybeDayComment,
  archiveMaybeDayComment,
  completeMaybeDaysJourney,
  confirmMaybeDayParticipation,
  loadMaybeDaysHistory,
  loadMaybeDaysState,
  openMaybeJar,
  pickAnotherMaybeDay,
  setMaybeDayHeart,
  startMaybeDay,
  updateMaybeDayComment,
} from "@/app/maybe-days/actions";
import { CelestialBackground } from "@/components/motion/celestial-background";
import { JourneyProgressMenu } from "@/features/progression/journey-progress-menu";
import { RoomCompletionPanel } from "@/features/progression/room-completion-panel";
import type {
  MaybeDayActivityView,
  MaybeDayCommentView,
  MaybeDayDrawView,
  MaybeDayHistoryPage,
} from "@/lib/maybe-days/contracts";

const notePlaceholders = [
  { icon: "♫", label: "Listen together" }, { icon: "◌", label: "Talk a little longer" },
  { icon: "✎", label: "Make something small" }, { icon: "▣", label: "Share a view" },
  { icon: "✦", label: "Play from anywhere" }, { icon: "☾", label: "A quiet call" },
];
const activityIcons: Record<string, string> = {
  heart: "♥", message: "◌", music: "♫", camera: "▣", film: "▶", gamepad: "✦",
  book: "▤", moon: "☾", star: "★", palette: "◒", coffee: "♨", sparkles: "✧",
};
const emptyPage: MaybeDayHistoryPage = { items: [], nextCursor: null };

export function MaybeDaysExperience({ maybeDaysCompleted: initiallyCompleted }: { maybeDaysCompleted: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [activities, setActivities] = useState<MaybeDayActivityView[]>([]);
  const [activeDraw, setActiveDraw] = useState<MaybeDayDrawView | null>(null);
  const [viewerDraw, setViewerDraw] = useState<MaybeDayDrawView | null>(null);
  const [completed, setCompleted] = useState<MaybeDayHistoryPage>(emptyPage);
  const [skipped, setSkipped] = useState<MaybeDayHistoryPage>(emptyPage);
  const [shuffling, setShuffling] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pendingAction, setPendingAction] = useState<"open" | "start" | "checkin" | "another" | "heart" | "history" | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ drawRef: string; initial?: MaybeDayCommentView } | null>(null);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [maybeDaysCompleted, setMaybeDaysCompleted] = useState(initiallyCompleted);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [completionPanelOpen, setCompletionPanelOpen] = useState(true);
  const actionLock = useRef(false);
  const requestVersion = useRef(0);
  const openingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnToJarLock = useRef(false);
  const returnToJarFrame = useRef<number | null>(null);
  const jarSectionRef = useRef<HTMLElement>(null);
  const activityCache = useMemo(() => new Map(activities.map((activity) => [activity.slug, activity])), [activities]);

  const applyDraw = useCallback((draw: MaybeDayDrawView) => {
    setViewerDraw((current) => current?.ref === draw.ref ? draw : current);
    setActiveDraw((current) => current?.ref === draw.ref ? (draw.status === "selected" || draw.status === "started" ? draw : null) : current);
    setCompleted((current) => ({ ...current, items: current.items.map((item) => item.ref === draw.ref ? draw : item) }));
    setSkipped((current) => ({ ...current, items: current.items.map((item) => item.ref === draw.ref ? draw : item) }));
  }, []);

  const applySharedState = useCallback((result: Awaited<ReturnType<typeof loadMaybeDaysState>>) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setActivities(result.activities);
    setActiveDraw(result.activeDraw);
    setCompleted(result.completed);
    setSkipped(result.skipped);
    setViewerDraw((current) => {
      if (!current) return null;
      const refreshed = [result.activeDraw, ...result.completed.items, ...result.skipped.items].find((draw) => draw?.ref === current.ref);
      return refreshed ?? current;
    });
  }, []);

  const refreshSharedState = useCallback(async (announce = false) => {
    const version = ++requestVersion.current;
    const result = await loadMaybeDaysState();
    if (version !== requestVersion.current) return;
    applySharedState(result);
    if (announce && result.ok) setAnnouncement("Shared activity state refreshed.");
  }, [applySharedState]);

  useEffect(() => {
    const updateVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      if (isVisible) void refreshSharedState();
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("focus", updateVisibility);
    return () => {
      requestVersion.current += 1;
      if (openingTimer.current) clearTimeout(openingTimer.current);
      if (returnToJarFrame.current !== null) cancelAnimationFrame(returnToJarFrame.current);
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("focus", updateVisibility);
    };
  }, [refreshSharedState]);

  const beginAction = (action: typeof pendingAction) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    requestVersion.current += 1;
    setPendingAction(action);
    setError("");
    return true;
  };
  const finishAction = () => {
    setPendingAction(null);
    setShuffling(false);
    actionLock.current = false;
  };

  const openJar = async () => {
    if (!beginAction("open")) return;
    setShuffling(true);
    setOpening(true);
    try {
      const revealDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 620;
      const animationReady = new Promise<void>((resolve) => {
        openingTimer.current = setTimeout(resolve, revealDelay);
      });
      const [result] = await Promise.all([openMaybeJar(), animationReady]);
      if (!result.ok) return setError(result.error);
      setActiveDraw(result.draw);
      setViewerDraw(result.draw);
      setAnnouncement("The Maybe Jar chose a shared activity.");
    } catch {
      setError("The jar could not choose a note just now. Please try again.");
    } finally {
      if (openingTimer.current) clearTimeout(openingTimer.current);
      openingTimer.current = null;
      setOpening(false);
      finishAction();
    }
  };

  const startActivity = async () => {
    if (!viewerDraw || !beginAction("start")) return;
    try {
      const result = await startMaybeDay(viewerDraw.ref);
      if (!result.ok) return setError(result.error);
      applyDraw(result.draw);
      setAnnouncement("The shared activity has started.");
    } catch {
      setError("The activity could not be started just now.");
    } finally { finishAction(); }
  };

  const confirmPart = async () => {
    if (!viewerDraw || !beginAction("checkin")) return;
    const previous = viewerDraw;
    applyDraw({ ...viewerDraw, checkins: viewerDraw.checkins.map((item) => item.isOwn ? { ...item, confirmed: true } : item) });
    try {
      const result = await confirmMaybeDayParticipation(viewerDraw.ref);
      if (!result.ok) {
        applyDraw(previous);
        return setError(result.error);
      }
      applyDraw(result.draw);
      if (result.draw.status === "completed") {
        setActiveDraw(null);
        setCompleted((current) => ({ ...current, items: [result.draw, ...current.items.filter((item) => item.ref !== result.draw.ref)] }));
        setAnnouncement("Both parts are confirmed. This activity is complete.");
      } else setAnnouncement("Your part is confirmed.");
    } catch {
      applyDraw(previous);
      setError("Your confirmation could not be saved just now.");
    } finally { finishAction(); }
  };

  const pickAnother = async (reason: string) => {
    if (!viewerDraw || !beginAction("another")) return;
    const previous = viewerDraw;
    setShuffling(true);
    try {
      const result = await pickAnotherMaybeDay(viewerDraw.ref, reason);
      if (!result.ok) return setError(result.error);
      const passed = { ...previous, status: "skipped" as const, skippedAt: new Date().toISOString(), skipReason: reason.trim() || null };
      setSkipped((current) => ({ ...current, items: [passed, ...current.items.filter((item) => item.ref !== passed.ref)] }));
      setActiveDraw(result.draw);
      setViewerDraw(result.draw);
      setSkipOpen(false);
      setAnnouncement("That activity was saved for now, and the jar chose another.");
    } catch {
      setError("The jar could not choose another note just now.");
    } finally { finishAction(); }
  };

  const toggleHeart = async () => {
    if (!viewerDraw || !beginAction("heart")) return;
    const previous = viewerDraw;
    const nextActive = !viewerDraw.ownHeart;
    applyDraw({ ...viewerDraw, ownHeart: nextActive, heartCount: Math.max(0, viewerDraw.heartCount + (nextActive ? 1 : -1)) });
    try {
      const result = await setMaybeDayHeart(viewerDraw.ref, nextActive);
      if (!result.ok) {
        applyDraw(previous);
        return setError(result.error);
      }
      setAnnouncement(nextActive ? "Your heart was added." : "Your heart was removed.");
    } catch {
      applyDraw(previous);
      setError("Your heart could not be updated just now.");
    } finally { finishAction(); }
  };

  const saveComment = (comment: MaybeDayCommentView) => {
    if (!viewerDraw) return;
    const exists = viewerDraw.comments.some((item) => item.ref === comment.ref);
    applyDraw({ ...viewerDraw, comments: exists ? viewerDraw.comments.map((item) => item.ref === comment.ref ? comment : item) : [...viewerDraw.comments, comment] });
    setCommentTarget(null);
    setAnnouncement(exists ? "Your comment was updated." : "Your comment was shared.");
  };
  const archiveComment = async (comment: MaybeDayCommentView) => {
    if (!viewerDraw || actionLock.current) return;
    actionLock.current = true;
    const previous = viewerDraw;
    applyDraw({ ...viewerDraw, comments: viewerDraw.comments.filter((item) => item.ref !== comment.ref) });
    try {
      const result = await archiveMaybeDayComment(comment.ref);
      if (!result.ok) {
        applyDraw(previous);
        return setError(result.error);
      }
      setAnnouncement("Your comment was archived.");
    } finally { actionLock.current = false; }
  };

  const loadMore = async (status: "completed" | "skipped") => {
    const page = status === "completed" ? completed : skipped;
    if (!page.nextCursor || !beginAction("history")) return;
    try {
      const result = await loadMaybeDaysHistory(status, page.nextCursor);
      if (!result.ok) return setError(result.error);
      const update = (current: MaybeDayHistoryPage) => ({ items: [...current.items, ...result.page.items], nextCursor: result.page.nextCursor });
      if (status === "completed") setCompleted(update);
      else setSkipped(update);
    } finally { finishAction(); }
  };

  const navigable = useMemo(() => [activeDraw, ...completed.items, ...skipped.items].filter((item): item is MaybeDayDrawView => Boolean(item)), [activeDraw, completed.items, skipped.items]);
  const viewerIndex = viewerDraw ? navigable.findIndex((item) => item.ref === viewerDraw.ref) : -1;
  const completeJourney = async () => {
    if (completionPending) return;
    setCompletionPending(true);
    setCompletionError("");
    try {
      const result = await completeMaybeDaysJourney();
      if (!result.ok) return setCompletionError(result.error);
      setMaybeDaysCompleted(true);
      router.replace("/?view=world");
    } catch {
      setCompletionError("The next step could not be saved. Please try again.");
    } finally {
      setCompletionPending(false);
    }
  };
  const returnToJar = () => {
    if (returnToJarLock.current) return;
    returnToJarLock.current = true;
    setViewerDraw(null);
    setSkipOpen(false);
    setCommentTarget(null);
    setError("");
    setCompletionError("");
    setCompletionPanelOpen(false);
    returnToJarFrame.current = requestAnimationFrame(() => {
      jarSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      returnToJarFrame.current = null;
    });
  };

  return <main className={`maybe-days-shell ${visible ? "" : "is-paused"} ${shuffling ? "is-shuffling" : ""} ${opening ? "is-opening" : ""}`}>
    <CelestialBackground room="maybe-days" moonProgress={.86} />
    <div className="maybe-days-twilight" aria-hidden="true"><i /><i /><i /></div>
    <nav className="maybe-days-nav" aria-label="Maybe Days navigation">
      <Link href="/?view=world">Return to World</Link>
      <JourneyProgressMenu storybookCompleted libraryCompleted puzzleRoomCompleted radioCompleted questionGardenCompleted galleryCompleted herUniverseCompleted maybeDaysCompleted={maybeDaysCompleted} />
    </nav>
    <section ref={jarSectionRef} className="maybe-days-intro" aria-labelledby="maybe-days-title">
      <p>World eight · made for any distance</p><h1 id="maybe-days-title">Maybe Days</h1>
      <blockquote>Some days begin with a plan. Others begin with a simple maybe.</blockquote>
      {!viewerDraw ? <JarView opening={opening} pending={pendingAction === "open"} activityCount={activityCache.size} onOpen={() => void openJar()} /> : <ActivityViewer
        draw={viewerDraw} pending={pendingAction} error={error}
        previous={viewerIndex > 0 ? navigable[viewerIndex - 1] : null}
        next={viewerIndex >= 0 && viewerIndex < navigable.length - 1 ? navigable[viewerIndex + 1] : null}
        onStart={() => void startActivity()} onConfirm={() => void confirmPart()} onHeart={() => void toggleHeart()}
        onSkip={() => setSkipOpen(true)} onComment={(initial) => setCommentTarget({ drawRef: viewerDraw.ref, initial })}
        onArchive={(comment) => void archiveComment(comment)}
        onPrevious={() => setViewerDraw(navigable[viewerIndex - 1] ?? null)}
        onNext={() => setViewerDraw(navigable[viewerIndex + 1] ?? null)}
        onReturn={() => { setViewerDraw(null); setError(""); }}
      />}
      {!viewerDraw && error ? <p className="maybe-days-error" role="alert">{error}</p> : null}
    </section>
    <HistorySection title="Activities we completed" items={completed.items} empty="Completed activities will gather here." onOpen={setViewerDraw} nextCursor={completed.nextCursor} loading={pendingAction === "history"} onMore={() => void loadMore("completed")} />
    <HistorySection title="Activities we passed for now" items={skipped.items} empty="Activities you pass will remain safely here." onOpen={setViewerDraw} nextCursor={skipped.nextCursor} loading={pendingAction === "history"} onMore={() => void loadMore("skipped")} />
    {completionPanelOpen ? <RoomCompletionPanel
      title="The jar will keep gathering maybes"
      message="Every completed activity can stay here as part of your shared history, and the jar will always be ready with another."
      primary={maybeDaysCompleted
        ? <Link href="/?view=world" prefetch>Continue the journey</Link>
        : <button type="button" disabled={completionPending} aria-busy={completionPending} onClick={() => void completeJourney()}>{completionPending ? "Continuing…" : "Continue the journey"}</button>}
      secondary={<button type="button" onClick={returnToJar}>Return to the Maybe Jar</button>}
    >{completionError ? <p role="alert">{completionError}</p> : null}</RoomCompletionPanel> : null}
    {skipOpen && viewerDraw ? <SkipDialog pending={pendingAction === "another"} onClose={() => setSkipOpen(false)} onConfirm={(reason) => void pickAnother(reason)} /> : null}
    {commentTarget ? <CommentDialog target={commentTarget} onClose={() => setCommentTarget(null)} onSaved={saveComment} /> : null}
    <span className="sr-only" aria-live="polite">{announcement}</span>
  </main>;
}

function JarView({ opening, pending, activityCount, onOpen }: { opening: boolean; pending: boolean; activityCount: number; onOpen: () => void }) {
  return <><div className="maybe-jar-stage"><div className="maybe-note-grid" aria-hidden="true">{notePlaceholders.map((note, index) => <div className="maybe-note-anchor" key={note.label}><span style={{ "--maybe-note": index } as CSSProperties}><i>{note.icon}</i><small>{note.label}</small></span></div>)}</div><button type="button" className="maybe-jar-button" aria-label="Open the Maybe Jar" aria-busy={pending} disabled={pending} onClick={onOpen}><span className="maybe-jar"><span className="maybe-jar-lid" /><span className="maybe-jar-glass"><i /><i /><i /><strong>{opening ? "opening…" : "maybe"}</strong></span></span></button></div><button type="button" className="maybe-jar-action" aria-busy={pending} disabled={pending} onClick={onOpen}>{pending ? "Opening the jar…" : "Open the Maybe Jar"}</button><small>{activityCount ? `${activityCount} long-distance ideas are waiting inside.` : "The jar is gathering gentle things you can do together from anywhere."}</small></>;
}

function ActivityViewer({ draw, pending, error, previous, next, onStart, onConfirm, onHeart, onSkip, onComment, onArchive, onPrevious, onNext, onReturn }: {
  draw: MaybeDayDrawView; pending: string | null; error: string; previous: MaybeDayDrawView | null; next: MaybeDayDrawView | null;
  onStart: () => void; onConfirm: () => void; onHeart: () => void; onSkip: () => void; onComment: (comment?: MaybeDayCommentView) => void;
  onArchive: (comment: MaybeDayCommentView) => void; onPrevious: () => void; onNext: () => void; onReturn: () => void;
}) {
  const ownCheckin = draw.checkins.find((item) => item.isOwn);
  return <div className="maybe-activity-anchor"><article className="maybe-activity-card" data-status={draw.status} aria-labelledby="maybe-activity-title">
    <div className="maybe-activity-icon" aria-hidden="true">{activityIcons[draw.activity.iconKey] ?? "✦"}</div>
    <div className="maybe-activity-copy"><p>{draw.activity.category.replace("-", " ")}</p><h2 id="maybe-activity-title">{draw.activity.title}</h2><blockquote>{draw.activity.prompt}</blockquote><ul><li>Status: {draw.status}</li>{draw.activity.estimatedMinutes ? <li>About {draw.activity.estimatedMinutes} minutes</li> : null}{draw.activity.requiresVoice ? <li>Voice-friendly</li> : null}{draw.activity.requiresVideo ? <li>Video-friendly</li> : null}</ul><ActivityDates draw={draw} /></div>
    {draw.status === "started" || draw.status === "completed" ? <div className="maybe-checkins"><h3>Our check-ins</h3>{draw.checkins.map((item) => <span key={item.label} className={item.confirmed ? "is-confirmed" : ""}><i aria-hidden="true">{item.confirmed ? "✓" : "○"}</i>{item.label === "you" ? "You" : item.label}: {item.confirmed ? "confirmed" : "waiting"}</span>)}</div> : null}
    <div className="maybe-viewer-actions">
      {draw.status === "selected" ? <button type="button" disabled={Boolean(pending)} onClick={onStart}>{pending === "start" ? "Starting…" : "Start activity"}</button> : null}
      {draw.status === "started" && !ownCheckin?.confirmed ? <button type="button" disabled={Boolean(pending)} onClick={onConfirm}>{pending === "checkin" ? "Confirming…" : "I did my part"}</button> : null}
      {draw.status === "selected" ? <button type="button" disabled={Boolean(pending)} onClick={onSkip}>Pick another</button> : null}
      <button type="button" className="maybe-heart" disabled={Boolean(pending)} aria-pressed={draw.ownHeart} onClick={onHeart}><span aria-hidden="true">{draw.ownHeart ? "❤️" : "♡"}</span> {draw.heartCount}</button>
      <button type="button" disabled={Boolean(pending)} onClick={() => onComment()}>Add comment</button>
    </div>
    <section className="maybe-comments" aria-labelledby="maybe-comments-title"><h3 id="maybe-comments-title">Shared comments</h3>{draw.comments.length ? <div>{draw.comments.map((comment, index) => <div className="maybe-comment-cell" key={comment.ref}><article style={{ "--comment-index": index } as CSSProperties} tabIndex={0}><p>{comment.body}</p><footer><span>Added by {comment.authorLabel}</span>{comment.isOwn ? <span><button type="button" onClick={() => onComment(comment)}>Edit</button><button type="button" onClick={() => onArchive(comment)}>Archive</button></span> : null}</footer></article></div>)}</div> : <p>No comments yet. Add a little note when you feel like it.</p>}</section>
    <nav className="maybe-history-navigation" aria-label="Activity history navigation">{previous ? <button type="button" onClick={onPrevious}>Previous</button> : null}<button type="button" className="maybe-return-jar" onClick={onReturn}>Return to Maybe Jar</button>{next ? <button type="button" onClick={onNext}>Next</button> : null}</nav>
    {error ? <p className="maybe-days-error" role="alert">{error}</p> : null}
  </article></div>;
}

function ActivityDates({ draw }: { draw: MaybeDayDrawView }) {
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <dl className="maybe-activity-dates"><div><dt>Selected</dt><dd>{format(draw.selectedAt)} by {draw.selectedBy}</dd></div>{draw.startedAt ? <div><dt>Started</dt><dd>{format(draw.startedAt)}</dd></div> : null}{draw.completedAt ? <div><dt>Completed</dt><dd>{format(draw.completedAt)}</dd></div> : null}{draw.skippedAt ? <div><dt>Passed for now</dt><dd>{format(draw.skippedAt)}{draw.skipReason ? ` · ${draw.skipReason}` : ""}</dd></div> : null}</dl>;
}

function HistorySection({ title, items, empty, onOpen, nextCursor, loading, onMore }: { title: string; items: MaybeDayDrawView[]; empty: string; onOpen: (draw: MaybeDayDrawView) => void; nextCursor?: string | null; loading?: boolean; onMore?: () => void }) {
  return <section className="maybe-history-section"><header><h2>{title}</h2><span>{items.length}</span></header>{items.length ? <div className="maybe-history-grid">{items.map((draw, index) => <div className="maybe-history-cell" key={draw.ref}><button type="button" style={{ "--history-index": index } as CSSProperties} onClick={() => onOpen(draw)}><i aria-hidden="true">{activityIcons[draw.activity.iconKey] ?? "✦"}</i><span><strong>{draw.activity.title}</strong><small>{draw.status} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(draw.selectedAt))}</small><em>{draw.comments.length} comment{draw.comments.length === 1 ? "" : "s"} · {draw.heartCount} heart{draw.heartCount === 1 ? "" : "s"}</em></span></button></div>)}</div> : <p>{empty}</p>}{nextCursor && onMore ? <button type="button" className="maybe-history-more" disabled={loading} onClick={onMore}>{loading ? "Loading…" : "Load more"}</button> : null}</section>;
}

function useDialog(onClose: () => void, pending: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),textarea,[tabindex]:not([tabindex='-1'])");
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = previous; };
  }, [onClose, pending]);
  return ref;
}

function SkipDialog({ pending, onClose, onConfirm }: { pending: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(""); const ref = useDialog(onClose, pending);
  return <div className="maybe-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><div ref={ref} className="maybe-dialog" role="dialog" aria-modal="true" aria-labelledby="skip-title" tabIndex={-1}><h2 id="skip-title">Pick another activity?</h2><p>This one will stay in “Activities we passed for now.”</p><label>Optional reason<textarea maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><footer><button type="button" disabled={pending} onClick={onClose}>Keep this one</button><button type="button" disabled={pending} onClick={() => onConfirm(reason)}>{pending ? "Choosing…" : "Pass and pick another"}</button></footer></div></div>;
}

function CommentDialog({ target, onClose, onSaved }: { target: { drawRef: string; initial?: MaybeDayCommentView }; onClose: () => void; onSaved: (comment: MaybeDayCommentView) => void }) {
  const [body, setBody] = useState(target.initial?.body ?? ""); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const lock = useRef(false); const ref = useDialog(onClose, pending);
  const save = async () => { if (lock.current) return; lock.current = true; setPending(true); setError(""); try { const result = target.initial ? await updateMaybeDayComment(target.initial.ref, body) : await addMaybeDayComment(target.drawRef, body); if (!result.ok) return setError(result.error); onSaved(result.comment); } catch { setError("Your comment could not be saved just now. Your words are still here."); } finally { lock.current = false; setPending(false); } };
  return <div className="maybe-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><div ref={ref} className="maybe-dialog" role="dialog" aria-modal="true" aria-labelledby="comment-title" tabIndex={-1}><h2 id="comment-title">{target.initial ? "Edit your comment" : "Add a shared comment"}</h2><p>A little note for this activity, visible to both of you.</p><label>Comment<textarea autoFocus maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} /></label>{error ? <p role="alert">{error}</p> : null}<footer><button type="button" disabled={pending} onClick={onClose}>Cancel</button><button type="button" disabled={pending || !body.trim()} onClick={() => void save()}>{pending ? "Saving…" : "Save comment"}</button></footer></div></div>;
}
