"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reactToQuestionGardenBloom, saveQuestionGardenDraft, saveQuestionGardenFollowUp, skipQuestionGardenQuestion, submitQuestionGardenAnswer, updateQuestionGardenSealedAnswer } from "@/app/question-garden/actions";
import type { GardenAnswerValue, GardenQuestionDetail, GardenQuestionSummary } from "@/lib/question-garden/contracts";

type SaveStatus = "idle" | "saving" | "saved" | "failed" | "conflict" | "sealed" | "invalid" | "unauthorized";

function sameAnswer(left: GardenAnswerValue, right: GardenAnswerValue) {
  return left.answerText === right.answerText && left.selectedOption === right.selectedOption;
}

function hasAnswer(value: GardenAnswerValue, responseType: GardenQuestionDetail["responseType"]) {
  return responseType === "choice"
    ? value.selectedOption !== null
    : value.answerText.trim().length > 0;
}

export function QuestionPanel({ initialDetail, loading = false, loadFailed = false, onClose, onChange }: {
  initialDetail: GardenQuestionDetail;
  loading?: boolean;
  loadFailed?: boolean;
  onClose: () => void;
  onChange: (summary: GardenQuestionSummary, detail?: GardenQuestionDetail) => void;
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [answerText, setAnswerText] = useState(initialDetail.ownAnswer?.answerText ?? "");
  const [selectedOption, setSelectedOption] = useState(initialDetail.ownAnswer?.selectedOption ?? null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ownRevealed = initialDetail.revealedAnswers?.find((answer) => answer.owner === "you");
  const [followUp, setFollowUp] = useState(ownRevealed?.followUpNote ?? "");
  const [noteStatus, setNoteStatus] = useState<SaveStatus>("idle");
  const [reactionPending, setReactionPending] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const expectedUpdatedAt = useRef(initialDetail.ownAnswer?.updatedAt ?? null);
  const latest = useRef<GardenAnswerValue>({ answerText, selectedOption });
  const lastSaved = useRef<GardenAnswerValue>({ answerText, selectedOption });
  const dirty = useRef(false);
  const queued = useRef(false);
  const submitLock = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = { answerText, selectedOption };
  }, [answerText, selectedOption]);

  const saveDraft = useCallback((): Promise<boolean> => {
    if (detail.state === "bloom" || detail.ownSubmitted) return Promise.resolve(true);
    if (!dirty.current || sameAnswer(latest.current, lastSaved.current)) return Promise.resolve(true);
    if (!hasAnswer(latest.current, detail.responseType)) return Promise.resolve(true);
    queued.current = true;
    if (inFlight.current) return inFlight.current;
    const run = async () => {
      let saved = true;
      while (queued.current) {
        queued.current = false;
        const snapshot = { ...latest.current };
        setSaveStatus("saving");
        let result: Awaited<ReturnType<typeof saveQuestionGardenDraft>>;
        try {
          result = await saveQuestionGardenDraft({
            questionId: detail.id,
            ...snapshot,
            expectedUpdatedAt: expectedUpdatedAt.current,
          });
        } catch {
          saved = false;
          setSaveStatus("failed");
          break;
        }
        if (result.ok) {
          expectedUpdatedAt.current = result.updatedAt;
          lastSaved.current = snapshot;
          dirty.current = !sameAnswer(snapshot, latest.current);
          setSaveStatus("saved");
          setError(null);
          if (dirty.current) queued.current = true;
        } else {
          saved = false;
          setSaveStatus(result.reason === "unavailable" ? "failed" : result.reason);
          break;
        }
      }
      return saved;
    };
    const promise = run().finally(() => { inFlight.current = null; });
    inFlight.current = promise;
    return promise;
  }, [detail.id, detail.ownSubmitted, detail.responseType, detail.state]);

  useEffect(() => {
    if (detail.ownSubmitted || !dirty.current || sameAnswer(latest.current, lastSaved.current) || !hasAnswer(latest.current, detail.responseType)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void saveDraft(); }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [answerText, detail.ownSubmitted, detail.responseType, saveDraft, selectedOption]);

  useEffect(() => {
    if (detail.state !== "bloom" || followUp === (ownRevealed?.followUpNote ?? "")) return;
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      setNoteStatus("saving");
      const result = await saveQuestionGardenFollowUp(detail.id, followUp);
      setNoteStatus(result.ok ? "saved" : "failed");
    }, 800);
    return () => { if (noteTimer.current) clearTimeout(noteTimer.current); };
  }, [detail.id, detail.state, followUp, ownRevealed?.followUpNote]);

  useEffect(() => {
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>("button, textarea, input, [href]");
    focusable?.[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); void saveDraft().then((saved) => { if (saved) onClose(); }); return; }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (timer.current) clearTimeout(timer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      queued.current = false;
      dirty.current = false;
    };
  }, [onClose, saveDraft]);

  const submit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    setSaveStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    queued.current = false;
    const snapshot = { ...latest.current };
    try {
      if (!detail.ownSubmitted && inFlight.current && !(await inFlight.current)) return;
      const result = detail.ownSubmitted
        ? await updateQuestionGardenSealedAnswer({
            questionId: detail.id,
            ...snapshot,
            expectedUpdatedAt: expectedUpdatedAt.current,
          })
        : await submitQuestionGardenAnswer({ questionId: detail.id, ...snapshot });
      if (!result.ok) {
        setSaveStatus(result.reason === "unavailable" ? "failed" : result.reason);
        setError(result.reason === "invalid"
          ? "Add a valid answer before saving."
          : result.reason === "conflict"
            ? "This answer changed in another session. Reopen it before saving again."
            : result.reason === "sealed"
              ? "This flower has already bloomed, so its answers can no longer be changed."
              : result.reason === "unauthorized"
                ? "Please sign in with an approved account before saving."
                : "Your answer could not be saved just now.");
        return;
      }
      expectedUpdatedAt.current = result.detail.ownAnswer?.updatedAt ?? expectedUpdatedAt.current;
      lastSaved.current = snapshot;
      dirty.current = false;
      queued.current = false;
      setError(null);
      onChange(result.summary, result.detail);
      onClose();
    } catch {
      setSaveStatus("failed");
      setError("Your answer could not be saved just now.");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };
  const skip = async () => {
    if ((answerText || selectedOption) && !window.confirm("Keep this saved thought and skip the question for now?")) return;
    if (!(await saveDraft())) { setError("Save this thought before skipping so none of your words are lost."); return; }
    const result = await skipQuestionGardenQuestion(detail.id);
    if (result.ok) { onChange(result.summary); onClose(); }
    else setError("This question could not be skipped just now.");
  };
  const answerLater = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (await saveDraft()) onClose();
    else setError("Your words are still here. Try saving once more before returning to the Garden.");
  };
  const maxLength = detail.responseType === "short_text" ? 500 : 5000;
  const react = async (reaction: "heart" | "laugh" | "sparkle" | "emotional") => {
    if (reactionPending) return;
    setReactionPending(true);
    const result = await reactToQuestionGardenBloom(detail.id, reaction);
    if (result.ok) setDetail((current) => ({ ...current, reactions: result.reactions }));
    else setError("That reaction could not be saved just now.");
    setReactionPending(false);
  };

  return <div className={`garden-question-overlay ${detail.state === "bloom" ? "is-recognition" : ""}`} role="presentation">
    <section ref={panelRef} className="garden-question-panel" role="dialog" aria-modal="true" aria-labelledby="garden-question-title">
      <header><p>{detail.category}</p><h2 id="garden-question-title">{detail.prompt}</h2><span>{detail.state === "seed" ? "Seed" : detail.state === "bud" ? "Bud" : "Bloom"}</span></header>
      {loading ? <div className="garden-detail-loading" role="status"><span aria-hidden="true" />Loading your side of this flower…</div> : null}
      {loadFailed ? <div className="garden-detail-loading" role="alert">This question could not be opened just now.<button type="button" onClick={onClose}>Return to Garden</button></div> : null}
      {!loading && !loadFailed ? <>
      {detail.state !== "bloom" ? <button className="garden-panel-return" type="button" onClick={() => void answerLater()}>Return to Garden</button> : null}
      {detail.state === "bloom" && detail.revealedAnswers ? <div className="garden-reveal" aria-live="polite">
        <p className="garden-reveal-announcement">Both answers are safely revealed.</p>
        <div>{detail.revealedAnswers.map((answer) => <article key={answer.owner}><small>{answer.owner === "you" ? "Your answer" : "Their answer"}</small><p>{answer.selectedOption ?? answer.answerText}</p></article>)}</div>
        {detail.bloomDate ? <time dateTime={detail.bloomDate}>Bloomed {new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(detail.bloomDate))}</time> : null}
        <fieldset className="garden-reactions" disabled={reactionPending}><legend>React to this bloom</legend>{([
          ["heart", "❤️", "Heart"], ["laugh", "✦", "Made me laugh"], ["sparkle", "✨", "Magical"], ["emotional", "◉", "Emotional"],
        ] as const).map(([value, symbol, label]) => <button key={value} type="button" aria-pressed={detail.reactions.some((reaction) => reaction.owner === "you" && reaction.reaction === value)} onClick={() => void react(value)}><span aria-hidden="true">{symbol}</span>{label}</button>)}</fieldset>
        {detail.reactions.length ? <p className="garden-reaction-summary">{detail.reactions.map((reaction) => `${reaction.owner === "you" ? "You" : "Partner"}: ${reaction.reaction}`).join(" · ")}</p> : null}
        <label className="garden-follow-up">Your follow-up note<textarea value={followUp} maxLength={2000} rows={4} onChange={(event) => setFollowUp(event.target.value)} onBlur={async () => { if (noteTimer.current) clearTimeout(noteTimer.current); setNoteStatus("saving"); const result = await saveQuestionGardenFollowUp(detail.id, followUp); setNoteStatus(result.ok ? "saved" : "failed"); }} /></label>
        <p className={`garden-save-status is-${noteStatus}`} role="status">{noteStatus === "saving" ? "Saving…" : noteStatus === "saved" ? "Your follow-up is safe here." : noteStatus === "failed" ? "Your note is still here, but it could not be saved just now." : "A follow-up is optional."}</p>
        {detail.revealedAnswers.find((answer) => answer.owner === "partner")?.followUpNote ? <article className="garden-partner-note"><small>Their follow-up</small><p>{detail.revealedAnswers.find((answer) => answer.owner === "partner")!.followUpNote}</p></article> : null}
        <button type="button" onClick={onClose}>Return to Garden</button>
      </div> : <div className="garden-answer-form">
        {detail.partnerSubmitted && !detail.ownSubmitted ? <p className="garden-sealed-note">One answer is safely sealed. This flower is waiting for your side.</p> : null}
        {detail.ownSubmitted ? <p className="garden-sealed-note">Your answer is safely sealed. You may still edit it until the flower blooms.</p> : null}
        {detail.responseType === "choice" ? <fieldset><legend>Choose one response</legend>{detail.options?.map((option) => <label key={option}><input type="radio" name={`garden-${detail.id}`} checked={selectedOption === option} onChange={() => { latest.current = { answerText, selectedOption: option }; dirty.current = true; setSaveStatus("idle"); setError(null); setSelectedOption(option); }} /> <span>{option}</span></label>)}</fieldset> : <>
          <label htmlFor="garden-answer">Your answer</label>
          <textarea id="garden-answer" value={answerText} maxLength={maxLength} rows={detail.responseType === "short_text" ? 3 : 8} onChange={(event) => { const value = event.target.value; latest.current = { answerText: value, selectedOption }; dirty.current = true; setSaveStatus("idle"); setError(null); setAnswerText(value); }} onBlur={() => { if (!detail.ownSubmitted && dirty.current) void saveDraft(); }} />
          <small aria-live="polite">{answerText.length} of {maxLength} characters</small>
        </>}
        <p className={`garden-save-status is-${saveStatus}`} role="status" aria-live="polite">{saveStatus === "saving" ? detail.ownSubmitted ? "Saving changes…" : "Planting your answer…" : saveStatus === "saved" ? "Your thought is safe here." : saveStatus === "conflict" ? "This answer changed in another session. Your words are still here; reopen the question before saving again." : saveStatus === "sealed" ? "This flower has already bloomed, so its answers can no longer be changed." : saveStatus === "invalid" ? "Check this response before saving it." : saveStatus === "unauthorized" ? "Please sign in with an approved account before saving." : saveStatus === "failed" ? "Your words are still here, but they could not be saved just now." : detail.ownSubmitted ? "Your sealed answer can be changed until this flower blooms." : "Drafts save quietly while you write."}</p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="garden-answer-actions">
          {!detail.ownSubmitted ? <button type="button" onClick={() => void saveDraft()} disabled={saveStatus === "saving"}>Save draft</button> : null}
          <button type="button" onClick={() => void answerLater()}>Answer later</button>
          {!detail.ownSubmitted ? <button type="button" onClick={() => void skip()}>Skip this question</button> : null}
          <button type="button" onClick={() => void submit()} disabled={submitting} aria-busy={submitting}>{submitting ? detail.ownSubmitted ? "Saving…" : "Submitting…" : detail.ownSubmitted ? "Save changes" : "Submit and seal"}</button>
        </div>
      </div>}
      </> : null}
    </section>
  </div>;
}
