"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { persistQuizResult, saveQuiz, submitQuizAttempt } from "@/app/puzzles/actions";
import type { SavedQuizAttempt, VerifiedQuizResult } from "./contracts";
import { getQuestionBank, type QuizId } from "./question-banks";

export function QuizEngine({ quiz, initialAttempt, onComplete, onReturn, onRetry, onSkip, initialBestScore }: {
  quiz: QuizId; initialAttempt: SavedQuizAttempt; onComplete: (result: VerifiedQuizResult) => void; onReturn: () => void; onRetry: () => Promise<SavedQuizAttempt | null>; onSkip: () => Promise<void>; initialBestScore: number;
}) {
  const questions = useMemo(() => initialAttempt.questionIds.map((id) => getQuestionBank(quiz).find((item) => item.id === id)!).filter(Boolean), [initialAttempt.questionIds, quiz]);
  const initialAnswers = initialAttempt.questionIds.map((id) => initialAttempt.answersByQuestion[id]).filter((id): id is string => Boolean(id));
  const [attempt, setAttempt] = useState(initialAttempt);
  const [index, setIndex] = useState(initialAttempt.currentQuestionIndex);
  const [selected, setSelected] = useState<string | null>(initialAttempt.selectedOptionId);
  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [feedback, setFeedback] = useState("");
  const [confirmed, setConfirmed] = useState(Boolean(initialAttempt.answersByQuestion[initialAttempt.questionIds[initialAttempt.currentQuestionIndex]]));
  const [finalReady, setFinalReady] = useState(initialAttempt.currentQuestionIndex === 14 && Boolean(initialAttempt.answersByQuestion[initialAttempt.questionIds[14]]));
  const [removed, setRemoved] = useState<string[]>(initialAttempt.eliminatedOptionsByQuestion[initialAttempt.questionIds[initialAttempt.currentQuestionIndex]] ?? []);
  const [hint, setHint] = useState(initialAttempt.usedLifelines.includes(`hint:${initialAttempt.questionIds[initialAttempt.currentQuestionIndex]}`));
  const [lifelines, setLifelines] = useState({
    fifty: initialAttempt.usedLifelines.includes("fifty"),
    hint: initialAttempt.usedLifelines.some((item) => item === "hint" || item.startsWith("hint:")),
    second: initialAttempt.usedLifelines.includes("second"),
    secondArmed: initialAttempt.usedLifelines.includes("second-armed"),
  });
  const [result, setResult] = useState<VerifiedQuizResult | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [persistencePending, setPersistencePending] = useState(false);
  const [pending, startTransition] = useTransition();
  const interactionLock = useRef(false);
  const submissionLock = useRef(false);
  const saveActive = useRef(false);
  const latestSave = useRef<SavedQuizAttempt | null>(null);
  const attemptRef = useRef(initialAttempt);
  const serverVersionRef = useRef(initialAttempt.updatedAt);
  const advanceTimer = useRef<number | null>(null);
  const persistenceStarted = useRef<string | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const question = questions[index];
  const optionOrder = attempt.optionOrderByQuestion[question.id];
  const labels = ["A", "B", "C", "D"];

  useEffect(() => { if (result) resultHeading.current?.focus(); }, [result]);
  useEffect(() => () => { if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current); }, []);
  useEffect(() => {
    const reference = result?.verificationRef;
    if (!reference || result.persisted || persistenceStarted.current === reference) return;
    persistenceStarted.current = reference;
    setPersistencePending(true);
    void persistQuizResult(reference).then((saved) => {
      setPersistencePending(false);
      if (saved.ok) {
        setResult((current) => current ? { ...current, persisted: true, bestScore: saved.bestScore ?? current.bestScore, persistenceWarning: undefined } : current);
        if (result) onComplete({ ...result, persisted: true, bestScore: saved.bestScore ?? result.bestScore, persistenceWarning: undefined });
      } else {
        setResult((current) => current ? { ...current, persisted: false, persistenceWarning: saved.warning } : current);
      }
    });
  }, [onComplete, result]);

  const queueSave = (next: SavedQuizAttempt) => {
    latestSave.current = next;
    if (saveActive.current) return;
    saveActive.current = true;
    void (async () => {
      while (latestSave.current) {
        const pendingSave = latestSave.current; latestSave.current = null;
        const response = await saveQuiz(pendingSave, serverVersionRef.current);
        if (response.ok) {
          serverVersionRef.current = response.attempt.updatedAt;
          attemptRef.current = { ...attemptRef.current, updatedAt: response.attempt.updatedAt };
          setAttempt((current) => ({ ...current, updatedAt: response.attempt.updatedAt }));
          setSaveNotice("");
        } else {
          setSaveNotice(response.stale ? "This attempt changed elsewhere. Reopen it to continue safely." : "Progress could not be saved just now. Your quiz remains open.");
        }
      }
      saveActive.current = false;
    })();
  };
  const snapshot = (changes: Partial<SavedQuizAttempt>) => {
    const next = { ...attemptRef.current, ...changes, updatedAt: serverVersionRef.current };
    attemptRef.current = next; setAttempt(next); queueSave(next); return next;
  };
  const optionIndex = (optionId: string) => Number(optionId.slice(optionId.lastIndexOf(":") + 1));
  const correctOptionId = `${question.id}:${question.correct}`;

  const fifty = () => {
    if (interactionLock.current || lifelines.fifty) return;
    interactionLock.current = true;
    const eliminated = optionOrder.filter((id) => id !== correctOptionId).slice(0, 2);
    const nextUsed = [...attempt.usedLifelines, "fifty"];
    setRemoved(eliminated); setLifelines((current) => ({ ...current, fifty: true }));
    snapshot({ usedLifelines: nextUsed, eliminatedOptionsByQuestion: { ...attempt.eliminatedOptionsByQuestion, [question.id]: eliminated } });
    interactionLock.current = false;
  };
  const revealHint = () => {
    if (interactionLock.current || lifelines.hint) return;
    interactionLock.current = true;
    const nextUsed = [...attempt.usedLifelines, `hint:${question.id}`]; setHint(true); setLifelines((current) => ({ ...current, hint: true })); snapshot({ usedLifelines: nextUsed }); interactionLock.current = false;
  };
  const armSecond = () => {
    if (quiz !== "millionaire" || interactionLock.current || lifelines.second || lifelines.secondArmed) return;
    interactionLock.current = true;
    const nextUsed = [...attempt.usedLifelines, "second-armed"]; setLifelines((current) => ({ ...current, secondArmed: true })); snapshot({ usedLifelines: nextUsed, secondChanceQuestionId: question.id }); interactionLock.current = false;
  };
  const choose = (optionId: string) => {
    if (confirmed || removed.includes(optionId)) return;
    setSelected(optionId); snapshot({ selectedOptionId: optionId });
  };
  const confirm = () => {
    if (interactionLock.current || confirmed || !selected) return;
    interactionLock.current = true;
    if (selected !== correctOptionId && lifelines.secondArmed && !lifelines.second) {
      const eliminated = [...removed, selected];
      const nextUsed = attempt.usedLifelines.filter((item) => item !== "second-armed").concat("second");
      setRemoved(eliminated); setSelected(null); setFeedback("Second Chance used. That option has stepped aside—choose once more."); setLifelines((current) => ({ ...current, second: true, secondArmed: false }));
      snapshot({ selectedOptionId: null, usedLifelines: nextUsed, secondChanceQuestionId: question.id, eliminatedOptionsByQuestion: { ...attempt.eliminatedOptionsByQuestion, [question.id]: eliminated } });
      interactionLock.current = false; return;
    }
    const nextAnswers = [...answers, selected];
    const answerMap = { ...attempt.answersByQuestion, [question.id]: selected };
    setAnswers(nextAnswers); setConfirmed(true); setFeedback(selected === correctOptionId ? "Correct. The path ahead is glowing." : `Not this time. The correct answer is ${question.options[question.correct]}.`);
    if (index < 14) {
      const activeAttemptId = attempt.attemptId;
      advanceTimer.current = window.setTimeout(() => {
        if (attemptRef.current.attemptId !== activeAttemptId) return;
        advanceTimer.current = null;
        const nextIndex = index + 1; const nextQuestionId = attempt.questionIds[nextIndex]; const nextSelected = answerMap[nextQuestionId] ?? null;
        setIndex(nextIndex); setSelected(nextSelected); setConfirmed(Boolean(nextSelected)); setFeedback(""); setRemoved(attempt.eliminatedOptionsByQuestion[nextQuestionId] ?? []); setHint(false);
        snapshot({ answersByQuestion: answerMap, currentQuestionIndex: nextIndex, selectedOptionId: nextSelected });
        interactionLock.current = false;
        window.requestAnimationFrame(() => questionHeading.current?.focus());
      }, 425);
    } else {
      snapshot({ answersByQuestion: answerMap, selectedOptionId: selected });
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null;
        setFinalReady(true);
        interactionLock.current = false;
      }, 425);
    }
  };
  const submitResult = () => {
    if (submissionLock.current || !confirmed || index !== 14) return;
    submissionLock.current = true;
    startTransition(async () => {
      const submittedAnswers = attempt.questionIds.map((id) => attemptRef.current.answersByQuestion[id] ?? "");
      const verified = await submitQuizAttempt(quiz, attempt.attemptId, attempt.questionIds, submittedAnswers);
      if (verified.success) setResult(verified);
      else setFeedback(verified.error ?? "This result could not be verified. Your attempt is still available.");
      submissionLock.current = false;
    });
  };
  const retry = async () => {
    if (interactionLock.current) return;
    interactionLock.current = true;
    const fresh = await onRetry();
    if (fresh) {
      attemptRef.current = fresh; serverVersionRef.current = fresh.updatedAt; setAttempt(fresh); setIndex(0); setSelected(null); setAnswers([]); setFeedback(""); setConfirmed(false); setFinalReady(false); setRemoved([]); setHint(false); setLifelines({ fifty: false, hint: false, second: false, secondArmed: false }); setResult(null); setSaveNotice("");
    }
    interactionLock.current = false;
  };
  const skip = async () => { if (interactionLock.current || leaving) return; interactionLock.current = true; setLeaving(true); await onSkip(); };
  const keyOptions = (event: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const enabled = optionOrder.filter((id) => !removed.includes(id)); const current = enabled.indexOf(selected ?? ""); const option = enabled[(current + direction + enabled.length) % enabled.length];
    if (option) { choose(option); optionRefs.current[optionIndex(option)]?.focus(); }
  };

  if (result) {
    const millionaireMessage = result.score <= 7 ? "That was a difficult round. Your next attempt may surprise you." : result.score <= 9 ? "Very close. One more sharp attempt could change everything." : result.score <= 12 ? "Challenge passed. That was some seriously sharp thinking." : "Brilliant. The Millionaire Mind Challenge has officially met its match.";
    const cultureMessage = result.score <= 7 ? "That was a challenging round. There is still more BTS and K-culture fun to discover." : result.score <= 9 ? "So close. One more round could turn this into a perfect comeback." : result.score <= 12 ? "Challenge passed. Your BTS and K-culture knowledge is seriously impressive." : "Outstanding. You clearly know your BTS and K-culture world.";
    return <section className="quiz-result"><p>{result.passed ? "Passed" : "Not passed yet"}</p><h3 ref={resultHeading} tabIndex={-1}>{result.score} out of 15</h3><strong>{result.percentage}%</strong><span>{quiz === "millionaire" ? millionaireMessage : cultureMessage}</span>{result.persisted ? <small>Best score: {Math.max(initialBestScore, result.bestScore)}/15</small> : <p className="quiz-save-warning" role="status">{result.persistenceWarning ?? "Saving result…"}</p>}<div className="puzzle-actions"><button type="button" onClick={retry} disabled={persistencePending}>Retry challenge</button><button type="button" onClick={onReturn} disabled={persistencePending}>Finish and return</button></div></section>;
  }

  const score = answers.reduce((total, id, answerIndex) => total + (optionIndex(id) === questions[answerIndex]?.correct ? 1 : 0), 0);
  return <section className={`quiz-engine quiz-${quiz}`} aria-labelledby="quiz-question"><header className="quiz-status" aria-live="polite"><div><small>{question.category}</small><strong>Question {index + 1} of 15</strong></div><span>Current score {score}</span></header>{saveNotice ? <p className="quiz-save-warning" role="status">{saveNotice}</p> : null}<div className="quiz-layout"><ol className="quiz-ladder" aria-label="Question ladder">{questions.map((_, step) => <li key={step} className={step === index ? "is-current" : step < index ? "is-past" : ""}>{step + 1}</li>)}</ol><div className="quiz-main"><h3 id="quiz-question" ref={questionHeading} tabIndex={-1}>{question.question}</h3><div className="quiz-options" role="radiogroup" aria-label={`Answers for question ${index + 1}`} onKeyDown={keyOptions}>{optionOrder.map((optionId, displayIndex) => <button key={optionId} ref={(node) => { optionRefs.current[optionIndex(optionId)] = node; }} type="button" role="radio" aria-checked={selected === optionId} disabled={confirmed || removed.includes(optionId)} onClick={() => choose(optionId)}><b>{labels[displayIndex]}</b><span>{removed.includes(optionId) ? "Unavailable" : question.options[optionIndex(optionId)]}</span></button>)}</div>{hint ? <p className="quiz-hint"><strong>{quiz === "millionaire" ? "The stars suggest" : "K-Culture hint"}</strong>{question.hint}</p> : null}<p className="quiz-feedback" aria-live="polite">{pending ? "Calculating your result…" : feedback}</p><div className="quiz-lifelines" aria-label="Lifelines"><button type="button" onClick={fifty} disabled={lifelines.fifty || confirmed} aria-pressed={lifelines.fifty}>50:50 · {lifelines.fifty ? "Used" : "Available"}</button><button type="button" onClick={revealHint} disabled={lifelines.hint || confirmed} aria-pressed={lifelines.hint}>{quiz === "millionaire" ? "Ask the Stars" : "K-Culture Hint"} · {lifelines.hint ? "Used" : "Available"}</button>{quiz === "millionaire" ? <button type="button" onClick={armSecond} disabled={lifelines.second || lifelines.secondArmed || confirmed} aria-pressed={lifelines.secondArmed || lifelines.second}>Second Chance · {lifelines.second ? "Used" : lifelines.secondArmed ? "Ready" : "Available"}</button> : null}</div><div className="puzzle-actions">{!(index === 14 && confirmed) ? <button type="button" onClick={confirm} disabled={!selected || confirmed || pending} aria-busy={pending}>Confirm answer</button> : null}{index === 14 && finalReady ? <button type="button" onClick={submitResult} disabled={pending} aria-busy={pending}>See result</button> : null}<button type="button" onClick={skip} disabled={leaving || pending} aria-busy={leaving}>Skip for now</button></div></div></div></section>;
}
