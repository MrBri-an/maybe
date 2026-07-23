"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { completePuzzleRoomJourney, markPuzzleCompleted, markPuzzleSkipped, recordPuzzleRoomLocation, startQuiz } from "@/app/puzzles/actions";
import { CelestialBackground } from "@/components/motion/celestial-background";
import { JourneyProgressMenu } from "@/features/progression/journey-progress-menu";
import { RoomCompletionPanel } from "@/features/progression/room-completion-panel";
import { QuizEngine } from "@/features/puzzles/quiz/quiz-engine";
import type { QuizId } from "@/features/puzzles/quiz/question-banks";
import type { SavedQuizAttempt, VerifiedQuizResult } from "@/features/puzzles/quiz/contracts";
import type { PuzzleId } from "@/lib/progression/user-progress";
import type { UserJourneyProgress } from "@/lib/supabase/database.types";

type PuzzleState = "not_started" | "in_progress" | "completed" | "skipped";
const letters = ["J", "E", "S", "S", "I", "C", "A"] as const;
const starPoints = [[12, 30], [27, 16], [42, 35], [56, 18], [68, 40], [82, 20], [91, 37]] as const;

function initialStates(progress: UserJourneyProgress): Record<PuzzleId, PuzzleState> {
  return {
    millionaire: progress.puzzle_millionaire_completed_at ? "completed" : progress.puzzle_millionaire_skipped_at ? "skipped" : "not_started",
    kculture: progress.puzzle_kculture_completed_at ? "completed" : progress.puzzle_kculture_skipped_at ? "skipped" : "not_started",
    constellation: progress.puzzle_constellation_completed_at ? "completed" : progress.puzzle_constellation_skipped_at ? "skipped" : "not_started",
  };
}

export function PuzzleRoom({ initialProgress, initialAttempts }: { initialProgress: UserJourneyProgress; initialAttempts: Record<QuizId, SavedQuizAttempt | null> }) {
  const reduceMotion = Boolean(useReducedMotion());
  const [active, setActive] = useState<PuzzleId | null>(null);
  const [states, setStates] = useState(() => initialStates(initialProgress));
  const [bestScores, setBestScores] = useState({ millionaire: initialProgress.puzzle_millionaire_best_score, kculture: initialProgress.puzzle_kculture_best_score });
  const [attempts, setAttempts] = useState(initialAttempts);
  const [resultPersisted, setResultPersisted] = useState<Record<QuizId, boolean | null>>({ millionaire: null, kculture: null });
  const [opening, setOpening] = useState<QuizId | null>(null);
  const startLock = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { void recordPuzzleRoomLocation(); }, []);
  const saveState = async (id: PuzzleId, state: "completed" | "skipped") => {
    const result = state === "completed" ? await markPuzzleCompleted(id) : await markPuzzleSkipped(id);
    if (result.ok) setStates((current) => ({ ...current, [id]: state }));
    else setNotice(result.error);
    return result.ok;
  };
  const open = async (id: PuzzleId, replace = false) => {
    if ((id === "millionaire" || id === "kculture") && !attempts[id]) {
      if (startLock.current) return;
      startLock.current = true; setOpening(id);
      const result = await startQuiz(id);
      startLock.current = false; setOpening(null);
      if (!result.ok) { setNotice("This challenge could not be started just now."); return; }
      setAttempts((current) => ({ ...current, [id]: result.attempt }));
      setResultPersisted((current) => ({ ...current, [id]: null }));
      if (!result.persisted) setNotice("This attempt is available now, but it could not be saved for another session.");
    } else if ((id === "millionaire" || id === "kculture") && replace) {
      if (startLock.current) return;
      if (!window.confirm("Start this challenge again? Your unfinished attempt will be replaced.")) return;
      startLock.current = true; setOpening(id);
      const result = await startQuiz(id);
      startLock.current = false; setOpening(null);
      if (!result.ok) { setNotice("This challenge could not be restarted just now."); return; }
      setAttempts((current) => ({ ...current, [id]: result.attempt }));
      setResultPersisted((current) => ({ ...current, [id]: null }));
    }
    setStates((current) => ({ ...current, [id]: current[id] === "not_started" ? "in_progress" : current[id] }));
    setActive(id);
  };
  const completeQuiz = (id: QuizId, result: VerifiedQuizResult) => {
    setResultPersisted((current) => ({ ...current, [id]: result.persisted }));
    if (result.persisted) {
      setStates((current) => ({ ...current, [id]: "completed" }));
      setBestScores((current) => ({ ...current, [id]: Math.max(current[id], result.bestScore) }));
    } else {
      setNotice(result.persistenceWarning ?? "Your result was calculated, but it could not be saved just now.");
    }
  };

  return <main className="puzzle-room">
    <CelestialBackground room="puzzles" moonProgress={.78} />
    <div className="puzzle-constellation-lines" aria-hidden="true"><i /><i /><i /></div>
    <header className="puzzle-room-toolbar"><Link href="/?view=world">← Back to World</Link><JourneyProgressMenu storybookCompleted libraryCompleted puzzleRoomCompleted={Boolean(initialProgress.puzzle_room_completed_at)} /></header>
    <motion.section className="puzzle-room-hero" initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }} animate={{ opacity: 1, y: 0 }}><p>World 03 · Optional discoveries</p><h1>Puzzle Room</h1><span>A quiet celestial chamber for clues, hidden light, and small discoveries. Follow any curiosity—or simply continue when you are ready.</span><div className="puzzle-pedestal" aria-hidden="true"><i>✦</i><b /></div></motion.section>
    {notice ? <p className="puzzle-room-notice" role="status">{notice}</p> : null}
    <section className="puzzle-selection" aria-labelledby="discoveries-title"><header><p>Choose freely</p><h2 id="discoveries-title">Three little discoveries</h2></header><div className="puzzle-card-grid">
      <PuzzleCard number="01" title="The Millionaire Mind Challenge" objective="Fifteen increasingly difficult questions of logic, probability and deduction." state={states.millionaire} bestScore={bestScores.millionaire} attempt={attempts.millionaire} pending={opening === "millionaire"} onOpen={() => void open("millionaire")} onStartOver={() => void open("millionaire", true)} />
      <PuzzleCard number="02" title="BTS & K-Culture Challenge" objective="A fifteen-question journey through BTS, Korean cinema and K-Drama." state={states.kculture} bestScore={bestScores.kculture} attempt={attempts.kculture} pending={opening === "kculture"} onOpen={() => void open("kculture")} onStartOver={() => void open("kculture", true)} />
      <PuzzleCard number="03" title="Jessica in the Stars" objective="Connect the glowing stars in the correct order to reveal Jessica’s name." state={states.constellation} onOpen={() => open("constellation")} />
    </div></section>
    {active === "millionaire" || active === "kculture" ? <QuizFrame id={active} attempt={attempts[active]!} best={bestScores[active]} close={() => setActive(null)} finish={() => { if (resultPersisted[active]) setAttempts((current) => ({ ...current, [active]: null })); setActive(null); }} skip={async () => { await saveState(active, "skipped"); setAttempts((current) => ({ ...current, [active]: null })); setActive(null); }} complete={(result) => completeQuiz(active, result)} retry={async () => { const fresh = await startQuiz(active); if (!fresh.ok) return null; setResultPersisted((current) => ({ ...current, [active]: null })); setAttempts((current) => ({ ...current, [active]: fresh.attempt })); return fresh.attempt; }} /> : null}
    {active === "constellation" ? <ConstellationPuzzle state={states.constellation} close={() => setActive(null)} save={saveState} reduceMotion={reduceMotion} /> : null}
    <PuzzleJourneyPanel alreadyCompleted={Boolean(initialProgress.puzzle_room_completed_at)} />
  </main>;
}

function PuzzleCard({ number, title, objective, state, bestScore, attempt, pending = false, onOpen, onStartOver }: { number: string; title: string; objective: string; state: PuzzleState; bestScore?: number; attempt?: SavedQuizAttempt | null; pending?: boolean; onOpen: () => void; onStartOver?: () => void }) {
  const completed = state === "completed";
  const label = completed ? "Completed" : attempt ? "In progress" : state === "not_started" ? "Not started" : state === "skipped" ? "Skipped for now" : "In progress";
  const action = completed && attempt ? "Resume replay" : completed ? "Replay" : attempt ? "Resume" : state === "skipped" ? "Visit again" : "Start";
  return <article className={`puzzle-discovery-card is-${state}`}><span>{number}</span><div><small>{label}</small><h3>{title}</h3><p>{objective}</p>{attempt ? <b className="puzzle-best-score">Question {attempt.currentQuestionIndex + 1} of 15</b> : null}{bestScore !== undefined && completed ? <b className="puzzle-best-score">Best score: {bestScore}/15</b> : null}<button type="button" onClick={onOpen} disabled={pending} aria-busy={pending}>{pending ? "Opening challenge…" : action}</button>{completed && attempt && onStartOver ? <button type="button" className="puzzle-start-over" onClick={onStartOver} disabled={pending}>Start over</button> : null}<em>Skipping is always available</em></div></article>;
}

function QuizFrame({ id, attempt, best, close, finish, skip, complete, retry }: { id: QuizId; attempt: SavedQuizAttempt; best: number; close: () => void; finish: () => void; skip: () => Promise<void>; complete: (result: VerifiedQuizResult) => void; retry: () => Promise<SavedQuizAttempt | null> }) {
  const title = id === "millionaire" ? "The Millionaire Mind Challenge" : "BTS & K-Culture Challenge";
  const objective = id === "millionaire" ? "Think carefully through fifteen questions. No timer—only curiosity." : "Explore BTS, Korean cinema and K-Drama across fifteen questions.";
  return <PuzzleFrame title={title} objective={objective} close={close}><div className={`quiz-chamber quiz-chamber-${id}`} aria-hidden="true"><i /><i /><i /></div><QuizEngine key={attempt.attemptId} quiz={id} initialAttempt={attempt} initialBestScore={best} onSkip={skip} onComplete={complete} onReturn={finish} onRetry={retry} /></PuzzleFrame>;
}

function PuzzleFrame({ title, objective, children, close }: { title: string; objective: string; children: React.ReactNode; close: () => void }) {
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; document.addEventListener("keydown", escape); return () => document.removeEventListener("keydown", escape); }, [close]);
  return <div className="puzzle-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="puzzle-dialog puzzle-quiz-dialog" role="dialog" aria-modal="true" aria-labelledby="active-puzzle-title"><header><div><p>Optional discovery</p><h2 id="active-puzzle-title">{title}</h2><span>{objective}</span></div><button type="button" onClick={close} aria-label="Close puzzle">×</button></header>{children}</section></div>;
}

function ConstellationPuzzle({ state, close, save, reduceMotion }: { state: PuzzleState; close: () => void; save: (id: PuzzleId, state: "completed" | "skipped") => Promise<boolean>; reduceMotion: boolean }) {
  const [connected, setConnected] = useState<number[]>(state === "completed" ? letters.map((_, index) => index) : []);
  const [hint, setHint] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputLock = useRef(false);
  const complete = connected.length === letters.length;
  const choose = (index: number) => {
    if (inputLock.current || index !== connected.length) return;
    inputLock.current = true;
    const next = [...connected, index]; setConnected(next); inputLock.current = false;
    if (next.length === letters.length) { setSaving(true); void save("constellation", "completed").finally(() => setSaving(false)); }
  };
  return <PuzzleFrame title="Jessica in the Stars" objective="Connect the glowing stars in the correct order to reveal Jessica’s name." close={close}><div className={`constellation-puzzle ${complete ? "is-complete" : ""}`}><svg viewBox="0 0 100 55" aria-hidden="true">{connected.slice(1).map((point, index) => <motion.line key={point} x1={starPoints[index][0]} y1={starPoints[index][1]} x2={starPoints[point][0]} y2={starPoints[point][1]} initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} />)}</svg>{letters.map((letter, index) => <button key={index} type="button" style={{ left: `${starPoints[index][0]}%`, top: `${(starPoints[index][1] / 55) * 100}%` }} className={connected.includes(index) ? "is-connected" : ""} onClick={() => choose(index)} disabled={index !== connected.length} aria-label={`${letter}, point ${index + 1}`}>{letter}</button>)}</div><div className="constellation-order" aria-label="Keyboard constellation controls">{letters.map((letter, index) => <button key={index} type="button" onClick={() => choose(index)} disabled={index !== connected.length}>{index + 1}. {letter}</button>)}</div>{hint ? <p className="puzzle-hint">Follow the letters from left to right: J, E, S, S, I, C, A.</p> : null}<p className="puzzle-feedback" aria-live="polite">{complete ? "Jessica is written softly across the stars." : `${connected.length} of ${letters.length} stars connected.`}</p><div className="puzzle-actions"><button type="button" onClick={() => setConnected((current) => current.slice(0, -1))} disabled={connected.length === 0 || saving}>Undo last</button><button type="button" onClick={() => setConnected([])} disabled={saving}>Reset</button><button type="button" onClick={() => setHint(true)}>Hint</button><button type="button" disabled={saving} aria-busy={saving} onClick={async () => { if (saving) return; setSaving(true); await save("constellation", "skipped"); close(); }}>Skip for now</button></div></PuzzleFrame>;
}

function PuzzleJourneyPanel({ alreadyCompleted }: { alreadyCompleted: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const lock = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    };
  }, [pathname]);

  if (alreadyCompleted) {
    return <RoomCompletionPanel title="The next destination is open" message="Puzzle Room is complete. Jessica’s Radio is ready whenever you want to continue." primary={<Link href="/radio" prefetch>Continue the journey</Link>} />;
  }

  const continueJourney = async () => {
    if (lock.current) return;
    lock.current = true;
    setIsContinuing(true);
    setError(null);

    try {
      const result = await completePuzzleRoomJourney();
      if (result.ok) {
        setError(null);
        router.replace("/radio");
        fallbackTimer.current = setTimeout(() => {
          if (window.location.pathname === "/puzzles") {
            window.location.assign("/radio");
          }
        }, 1500);
        return;
      }
      setError(result.error);
    } catch {
      setError("The next step could not be saved. Please try again.");
    } finally {
      if (!fallbackTimer.current) {
        setIsContinuing(false);
        lock.current = false;
      }
    }
  };
  return <RoomCompletionPanel title="Ready for the next discovery?" message="You can solve every puzzle, try only the ones that interest you, or return another time. Nothing here must be completed before the journey continues." primary={<button type="button" onClick={() => void continueJourney()} disabled={isContinuing} aria-busy={isContinuing}>{isContinuing ? "Continuing…" : "Continue the journey"}</button>}>{error ? <p role="alert">{error}</p> : null}</RoomCompletionPanel>;
}
