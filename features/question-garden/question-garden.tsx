"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { archiveQuestionGardenQuestion, completeQuestionGardenJourney, loadQuestionGardenQuestion, saveQuestionGardenPosition } from "@/app/question-garden/actions";
import { CelestialBackground } from "@/components/motion/celestial-background";
import type { GardenBed, GardenQuestionDetail, GardenQuestionPreview, GardenQuestionState, GardenQuestionSummary, QuestionGardenFoundation } from "@/lib/question-garden/contracts";
import { QuestionPanel } from "@/features/question-garden/question-panel";
import { PlantQuestionPanel } from "@/features/question-garden/plant-question-panel";
import { RoomCompletionPanel } from "@/features/progression/room-completion-panel";

const BED_POSITIONS = [
  { x: 18, y: 24 },
  { x: 80, y: 25 },
  { x: 88, y: 70 },
  { x: 50, y: 88 },
  { x: 12, y: 69 },
] as const;
const FIREFLIES = Array.from({ length: 10 }, (_, index) => ({
  x: 8 + ((index * 31) % 86),
  y: 12 + ((index * 23) % 76),
  delay: `${(index % 5) * -.8}s`,
}));
const PETALS = Array.from({ length: 7 }, (_, index) => ({
  x: 13 + ((index * 17) % 74),
  delay: `${index * -1.2}s`,
}));

export function QuestionGarden({ foundation, gardenCompleted }: { foundation: QuestionGardenFoundation; gardenCompleted: boolean }) {
  const [garden, setGarden] = useState(foundation);
  const [activeBed, setActiveBed] = useState<GardenBed | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<GardenQuestionDetail | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionLoadFailed, setQuestionLoadFailed] = useState(false);
  const [celebratingReveal, setCelebratingReveal] = useState(false);
  const [planting, setPlanting] = useState<GardenQuestionPreview | null | undefined>(undefined);
  const detailCache = useRef(new Map<string, GardenQuestionDetail>());
  const activeQuestionId = useRef<string | null>(null);

  useEffect(() => {
    if (!celebratingReveal) return;
    const timer = setTimeout(() => setCelebratingReveal(false), 1800);
    return () => clearTimeout(timer);
  }, [celebratingReveal]);
  useEffect(() => {
    const edit = (event: Event) => setPlanting((event as CustomEvent<GardenQuestionPreview>).detail);
    window.addEventListener("garden-edit-question", edit);
    return () => window.removeEventListener("garden-edit-question", edit);
  }, []);

  const enterBed = (bed: GardenBed) => {
    setActiveBed(bed);
    void saveQuestionGardenPosition(bed.category, null);
  };
  const openQuestion = async (question: GardenQuestionPreview) => {
    const cached = detailCache.current.get(question.id);
    activeQuestionId.current = question.id;
    setActiveQuestion(cached ?? questionShell(question));
    setQuestionLoading(!cached);
    setQuestionLoadFailed(false);
    void saveQuestionGardenPosition(question.category, question.id);
    const result = await loadQuestionGardenQuestion(question.id);
    if (result.ok) {
      const accepted = cacheQuestionDetail(detailCache.current, result.detail);
      if (activeQuestionId.current === question.id && !cached) {
        setActiveQuestion(accepted);
        setQuestionLoading(false);
      }
    } else if (activeQuestionId.current === question.id && !cached) {
      setQuestionLoading(false);
      setQuestionLoadFailed(true);
    }
  };
  const updateQuestion = (summary: GardenQuestionSummary, detail?: GardenQuestionDetail) => {
    const previous = garden.beds.flatMap((bed) => bed.questions).find((question) => question.id === summary.id);
    if (summary.state === "bloom" && previous?.state !== "bloom") setCelebratingReveal(true);
    setGarden((current) => {
      const beds = current.beds.map((bed) => {
        const questions = bed.questions.map((question) => question.id === summary.id ? {
          ...question,
          state: summary.state,
          ownStatus: summary.ownStatus,
          ownSubmitted: summary.ownSubmitted,
          partnerSubmitted: summary.partnerSubmitted,
        } : question);
        return { ...bed, questions, counts: countStates(questions) };
      });
      return { ...current, beds, counts: countStates(beds.flatMap((bed) => bed.questions)) };
    });
    setActiveBed((current) => {
      if (!current) return current;
      const questions = current.questions.map((question) => question.id === summary.id ? { ...question, state: summary.state, ownStatus: summary.ownStatus, ownSubmitted: summary.ownSubmitted, partnerSubmitted: summary.partnerSubmitted } : question);
      return { ...current, questions, counts: countStates(questions) };
    });
    if (detail) {
      cacheQuestionDetail(detailCache.current, detail);
      setActiveQuestion(detail);
    }
  };
  const closeQuestion = () => {
    activeQuestionId.current = null;
    setActiveQuestion(null);
    setQuestionLoading(false);
    setQuestionLoadFailed(false);
  };

  return <main className={`question-garden ${celebratingReveal ? "is-revealing" : ""} ${planting !== undefined ? "is-planting" : ""}`}>
    <CelestialBackground room="garden" moonProgress={1} />
    <div className="garden-fireflies" aria-hidden="true">{FIREFLIES.map((firefly, index) => <i key={index} style={{ left: `${firefly.x}%`, top: `${firefly.y}%`, animationDelay: firefly.delay }} />)}</div>
    <div className="garden-petals" aria-hidden="true">{PETALS.map((petal, index) => <i key={index} style={{ left: `${petal.x}%`, animationDelay: petal.delay }} />)}</div>
    <header className="garden-toolbar"><Link href="/?view=world">← Back to World</Link><div><button type="button" onClick={() => setPlanting(null)}>Plant a question</button></div></header>
    <section className="garden-intro">
      <p>World 05 · A private place to wonder</p>
      <h1>Question Garden</h1>
      <span>Nothing here is a test. Every question is optional, and every answer can take its own time.</span>
      <GardenLegend counts={garden.counts} />
      {garden.lastCategory ? <button className="garden-resume" type="button" onClick={() => { const bed = garden.beds.find((item) => item.category === garden.lastCategory); if (bed) enterBed(bed); }}>Continue where you left off</button> : null}
    </section>

    {!activeBed ? <GardenMap beds={garden.beds} onEnter={enterBed} /> : null}
    {activeBed ? <GardenBedPanel bed={activeBed} lastQuestionId={garden.lastQuestionId} onOpen={openQuestion} onBack={() => setActiveBed(null)} /> : null}
    {activeQuestion ? <QuestionPanel key={`${activeQuestion.id}:${questionLoading ? "loading" : "ready"}`} initialDetail={activeQuestion} loading={questionLoading} loadFailed={questionLoadFailed} onClose={closeQuestion} onChange={updateQuestion} /> : null}
    {planting !== undefined ? <PlantQuestionPanel initial={planting} onClose={() => setPlanting(undefined)} onSaved={() => window.location.reload()} /> : null}
    {!activeBed ? <GardenCompletionPanel alreadyCompleted={gardenCompleted} /> : null}
  </main>;
}

function countStates(questions: { state: GardenQuestionState }[]) {
  return {
    seed: questions.filter((question) => question.state === "seed").length,
    bud: questions.filter((question) => question.state === "bud").length,
    bloom: questions.filter((question) => question.state === "bloom").length,
  };
}

function questionShell(question: GardenQuestionPreview): GardenQuestionDetail {
  return {
    id: question.id,
    category: question.category,
    prompt: question.prompt,
    responseType: question.responseType,
    options: question.options,
    state: question.state,
    ownAnswer: null,
    ownSubmitted: question.ownSubmitted,
    partnerSubmitted: question.partnerSubmitted,
    revealedAnswers: null,
    reactions: [],
    bloomDate: null,
  };
}

function cacheQuestionDetail(cache: Map<string, GardenQuestionDetail>, incoming: GardenQuestionDetail) {
  const current = cache.get(incoming.id);
  const currentUpdatedAt = current?.ownAnswer?.updatedAt ? Date.parse(current.ownAnswer.updatedAt) : 0;
  const incomingUpdatedAt = incoming.ownAnswer?.updatedAt ? Date.parse(incoming.ownAnswer.updatedAt) : 0;
  if (current?.state === "bloom" && incoming.state !== "bloom") return current;
  if (current && currentUpdatedAt > incomingUpdatedAt && incoming.state !== "bloom") return current;
  cache.set(incoming.id, incoming);
  return incoming;
}

function GardenLegend({ counts }: { counts: Record<GardenQuestionState, number> }) {
  return <div className="garden-legend" aria-label="Garden state summary">
    <span><i className="is-seed" />Seed <b>{counts.seed}</b></span>
    <span><i className="is-bud" />Bud <b>{counts.bud}</b></span>
    <span><i className="is-bloom" />Bloom <b>{counts.bloom}</b></span>
  </div>;
}

function GardenMap({ beds, onEnter }: { beds: GardenBed[]; onEnter: (bed: GardenBed) => void }) {
  return <section className="garden-map" aria-label="Question Garden beds">
    <svg className="garden-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {BED_POSITIONS.map((position, index) => <path key={index} d={`M50 50 Q${50 + (position.x - 50) * .35} ${50 + (position.y - 50) * .15} ${position.x} ${position.y}`} />)}
    </svg>
    <div className="garden-heart-tree" aria-hidden="true"><i /><b>♡</b><span /><span /><span /></div>
    {beds.map((bed, index) => <article className={`garden-bed garden-bed-${index + 1}`} key={bed.category} style={{ "--bed-x": `${BED_POSITIONS[index].x}%`, "--bed-y": `${BED_POSITIONS[index].y}%` } as CSSProperties}>
      <div className="garden-flowers" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <p>Garden bed {index + 1}</p>
      <h2>{bed.category}</h2>
      <GardenLegend counts={bed.counts} />
      <button type="button" onClick={() => onEnter(bed)}>Enter Garden Bed</button>
    </article>)}
  </section>;
}

function GardenBedPanel({ bed, lastQuestionId, onOpen, onBack }: { bed: GardenBed; lastQuestionId: string | null; onOpen: (question: GardenQuestionPreview) => void; onBack: () => void }) {
  return <section className="garden-panel" aria-labelledby="garden-bed-title">
    <button className="garden-panel-back" type="button" onClick={onBack}>← Garden map</button>
    <header><p>A quiet bed of questions</p><h2 id="garden-bed-title">{bed.category}</h2><span>Choose any seed when you feel ready. Skipping is always allowed.</span><GardenLegend counts={bed.counts} /></header>
    <div className="garden-question-list">
      {bed.questions.map((question, index) => <article key={question.id} className={`garden-question is-${question.state} ${lastQuestionId === question.id ? "is-last-opened" : ""}`}>
        <span aria-hidden="true">{question.state === "seed" ? "•" : question.state === "bud" ? "❀" : "✿"}</span>
        <div><small>{question.state === "bloom" ? "Both answered" : question.ownSubmitted ? "Answered" : question.partnerSubmitted ? "One answer is sealed" : "Unanswered"} · {String(index + 1).padStart(2, "0")}</small><h3>{question.prompt}</h3>{question.personalNote ? <p>{question.personalNote}</p> : null}{question.responseType === "choice" && question.options ? <p>{question.options.join(" · ")}</p> : null}<em>{question.state === "bloom" ? "Both answers have bloomed." : question.ownSubmitted ? "Your answer is safely planted." : question.partnerSubmitted ? "One answer is waiting for your side." : question.ownStatus === "draft" ? "Your saved thought is waiting." : question.ownStatus === "skipped" ? "Skipped for now. You can answer whenever you like." : "Untouched and waiting without pressure."}</em><button type="button" onClick={() => void onOpen(question)}>{question.state === "bloom" ? "View answers" : question.ownSubmitted ? "Edit answer" : "Answer gently"}</button>{question.isPlanter && !question.hasAnyAnswer ? <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("garden-edit-question", { detail: question }))}>Edit planted question</button> : null}{question.isPlanter ? <button type="button" onClick={async () => { if (window.confirm("Archive this planted question?")) { const result = await archiveQuestionGardenQuestion(question.id); if (result.ok) window.location.reload(); } }}>Archive question</button> : null}</div>
      </article>)}
    </div>
  </section>;
}

function GardenCompletionPanel({ alreadyCompleted }: { alreadyCompleted: boolean }) {
  const router = useRouter(); const pathname = usePathname();
  const lock = useRef(false); const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { if (fallback.current) clearTimeout(fallback.current); }, [pathname]);
  const complete = async () => {
    if (lock.current) return; lock.current = true; setPending(true); setError(null);
    try {
      const result = await completeQuestionGardenJourney();
      if (result.ok) { router.replace("/?view=world"); fallback.current = setTimeout(() => { if (window.location.pathname === "/question-garden") window.location.assign("/?view=world"); }, 1500); return; }
    } catch {
      // The warm, generic error below intentionally hides transport and database details.
    }
    lock.current = false; setPending(false); setError("The next path could not be saved just now.");
  };
  return <RoomCompletionPanel title="Ready for another path?" message="This garden will keep growing whenever either of you has something to ask. You do not need to answer every question before continuing." primary={alreadyCompleted ? <Link href="/?view=world" prefetch>Continue the journey</Link> : <button type="button" disabled={pending} aria-busy={pending} onClick={() => void complete()}>{pending ? "Continuing…" : "Continue the journey"}</button>}>{error ? <p role="alert">{error}</p> : null}</RoomCompletionPanel>;
}
